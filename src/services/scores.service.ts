import { ObjectId } from 'mongodb'
import databaseServices from '~/services/database.services'
import { IScores } from '~/models/schemas/scores.schema'
import { IScoreHistory } from '~/models/schemas/scoreHistory.schema'
import { BehaviorFlag, IIssuer, KYCStatus, SocialLinkSubDocument } from '~/models/schemas/issuer.schema'
import { scoreWeightsConfig, SOCIAL_SCORE_WEIGHTS, TIER_THRESHOLDS, TierType } from '~/constants/scores'
import { httpStatusCode } from '~/core/httpStatusCode'
import { ErrorWithStatus } from '~/utils/error.utils'

interface ScoreValue {
  score: number
  note?: string
}

type ScoreResult = number | ScoreValue

const getScoreValue = (result: ScoreResult): number => {
  if (typeof result === 'number') return result
  return result.score
}

class ScoresService {
  private calculateTier(totalScore: number): TierType {
    for (const [tier, threshold] of Object.entries(TIER_THRESHOLDS)) {
      if (totalScore >= threshold) {
        return tier as TierType
      }
    }
    return 'new_issuer'
  }

  private calculateStakingScore(stakedAmount: number): number {
    // Base score calculation using logarithmic scale
    // 15,000 STAR = 15 points, 150,000 STAR = 20 points, 1,500,000 STAR = 25 points
    const baseScore = Math.min(Math.log10(stakedAmount + 1) * 8.33, Number(scoreWeightsConfig.staking))
    return Math.round(baseScore * 100) / 100
  }

  private calculateWalletBehaviorScore(flags: BehaviorFlag[]): { score: number; note: string } {
    if (!flags.length) {
      return {
        score: Number(scoreWeightsConfig.walletBehavior),
        note: `Clean wallet history (${Number(scoreWeightsConfig.walletBehavior)}/${Number(scoreWeightsConfig.walletBehavior)} points)`
      }
    }

    const now = new Date()
    let totalPenalty = 0
    const flagDetails: string[] = []

    // Group flags by severity for better calculation
    const severityGroups = flags.reduce(
      (acc, flag) => {
        const key = flag.severity.toString()
        if (!acc[key]) acc[key] = []
        acc[key].push(flag)
        return acc
      },
      {} as Record<string, BehaviorFlag[]>
    )

    Object.entries(severityGroups).forEach(([severity, flagsInGroup]) => {
      const severityNum = parseInt(severity)
      const daysSinceOldest = Math.min(
        ...flagsInGroup.map((f) => (now.getTime() - f.detectedAt.getTime()) / (1000 * 60 * 60 * 24))
      )

      // Time decay: flags lose impact over time
      const recencyMultiplier = Math.max(0.1, 1 - daysSinceOldest / 365)

      // Progressive penalty: multiple flags of same severity have diminishing returns
      const flagCount = flagsInGroup.length
      const basePenalty = (severityNum / 5) * 8 // Max 8 points per severity level
      const diminishingFactor = Math.log(flagCount + 1) / Math.log(2) // Logarithmic decrease

      const penalty = basePenalty * recencyMultiplier * diminishingFactor
      totalPenalty += penalty

      flagDetails.push(`${flagCount} severity-${severityNum} flag(s)`)
    })

    const finalScore = Math.max(0, Math.round((Number(scoreWeightsConfig.walletBehavior) - totalPenalty) * 100) / 100)

    return {
      score: finalScore,
      note: `${flagDetails.join(', ')} (-${Math.round(totalPenalty * 100) / 100} penalty)`
    }
  }

  private calculateSocialScore(socialLinks: SocialLinkSubDocument[]): number {
    if (!socialLinks.length) return 0

    // Calculate total weight from verified social accounts
    const totalWeight = socialLinks.reduce((sum, link) => {
      const weight = SOCIAL_SCORE_WEIGHTS[link.provider] || 0
      return sum + weight
    }, 0)

    // Base points from weights
    const basePoints = Math.min(totalWeight * 5, Number(scoreWeightsConfig.social))

    // Bonus points for account age
    const now = new Date()
    let ageBonus = 0

    socialLinks.forEach((link) => {
      const accountAge = (now.getTime() - link.verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (accountAge > 180) ageBonus += 0.5 // 6 months
      if (accountAge > 365) ageBonus += 0.5 // 1 year
    })

    return Math.min(basePoints + ageBonus, Number(scoreWeightsConfig.social))
  }

  private calculateKYCScore(kycStatus: KYCStatus): number {
    if (kycStatus.status !== 'approved') return 0
    if (kycStatus.expiration && kycStatus.expiration < new Date()) return 0

    let score = Number(scoreWeightsConfig.kyc) // Base score for valid KYC

    // Deduct points if close to expiration
    if (kycStatus.expiration) {
      const daysToExpiration = (kycStatus.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      if (daysToExpiration < 30) {
        // Less than 30 days to expire
        score *= 0.8
      }
    }

    return Math.round(score * 100) / 100
  }

  private async calculateLaunchScore(issuerId: ObjectId): Promise<number> {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const launchHistory = await databaseServices
      .getClient()
      .db()
      .collection('launches')
      .aggregate([
        {
          $match: {
            issuerId,
            launchDate: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalLaunches: { $sum: 1 },
            successfulLaunches: {
              $sum: { $cond: [{ $eq: ['$status', 'successful'] }, 1, 0] }
            }
          }
        }
      ])
      .toArray()

    if (!launchHistory.length) return 0

    const { totalLaunches, successfulLaunches } = launchHistory[0]
    const successRate = successfulLaunches / totalLaunches

    // Base score from success rate
    let score = successRate * Number(scoreWeightsConfig.launchHistory)

    // Bonus for multiple successful launches
    if (successfulLaunches >= 3) score = Math.min(score + 5, Number(scoreWeightsConfig.launchHistory))

    return Math.round(score * 100) / 100
  }

  async calculateAndUpdateScores(issuerId: ObjectId): Promise<IScores> {
    const session = await databaseServices.getClient().startSession()

    try {
      session.startTransaction()

      // Get issuer data
      const issuer = (await databaseServices.issuers.findOne({ _id: issuerId }, { session })) as IIssuer

      if (!issuer) {
        throw new ErrorWithStatus({
          message: 'Issuer not found',
          status: httpStatusCode.NOT_FOUND
        })
      }

      // Calculate individual scores
      const [launchScore, scores] = await Promise.all([
        this.calculateLaunchScore(issuerId),
        Promise.resolve({
          staking: this.calculateStakingScore(issuer.stakedAmount),
          walletBehavior: this.calculateWalletBehaviorScore(issuer.behaviorFlags),
          social: this.calculateSocialScore(issuer.socialLinks),
          kyc: this.calculateKYCScore(issuer.kycStatus),
          launchHistory: 0
        } as Record<string, ScoreResult>)
      ])

      scores.launchHistory = launchScore

      // Calculate total score
      const totalScore = Object.entries(scores).reduce((sum, [, value]) => sum + getScoreValue(value), 0)

      const tier = this.calculateTier(totalScore)

      // Create score history record
      const scoreHistory: IScoreHistory = {
        _id: new ObjectId(),
        issuer: issuerId,
        scores: Object.entries(scores).map(([key, value]) => ({
          key,
          raw: getScoreValue(value),
          weighted: getScoreValue(value),
          note: typeof value === 'object' ? value.note : `${key} score calculation`
        })),
        totalScore,
        badge: tier,
        recordedAt: new Date(),
        version: 1,
        source: 'system'
      }

      // Update scores and history atomically
      await Promise.all([
        databaseServices.scores.updateOne(
          { issuerId },
          {
            $set: {
              scores: {
                staking: getScoreValue(scores.staking),
                walletBehavior: getScoreValue(scores.walletBehavior),
                launchHistory: getScoreValue(scores.launchHistory),
                social: getScoreValue(scores.social),
                kyc: getScoreValue(scores.kyc)
              },
              totalScore,
              tier,
              updatedAt: new Date()
            },
            $setOnInsert: {
              issuerId,
              createdAt: new Date()
            }
          },
          { upsert: true, session }
        ),
        databaseServices.scoreHistories.insertOne(scoreHistory, { session })
      ])

      await session.commitTransaction()

      return {
        _id: new ObjectId(),
        issuerId,
        scores: {
          staking: getScoreValue(scores.staking),
          walletBehavior: getScoreValue(scores.walletBehavior),
          launchHistory: getScoreValue(scores.launchHistory),
          social: getScoreValue(scores.social),
          kyc: getScoreValue(scores.kyc)
        },
        totalScore,
        tier,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
  }
}

export default new ScoresService()

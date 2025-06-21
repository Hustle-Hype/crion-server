import { ObjectId } from 'mongodb'
import databaseServices from '~/services/database.services'
import { IScores, IScoreSubDocument } from '~/models/schemas/scores.schema'
import { BehaviorFlag, KYCStatus, SocialLinkSubDocument } from '~/models/schemas/issuer.schema'
import { SCORE_CATEGORIES, SCORE_HISTORY_SOURCES, SOCIAL_SCORES, SCORE_TIERS } from '~/constants/scores'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import { IScoreHistory } from '~/models/schemas/scoreHistory.schema'

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
  private calculateTier(totalScore: number): IScores['tier'] {
    for (const [tier, range] of Object.entries(SCORE_TIERS)) {
      if (totalScore >= range.min && totalScore <= range.max) {
        return tier as IScores['tier']
      }
    }
    return 'new_issuer'
  }

  private calculateStakingScore(stakedAmount: number): number {
    // Simple logarithmic scale without weights
    const baseScore = Math.min(Math.log10(stakedAmount + 1) * 10, 100)
    return Math.round(baseScore * 100) / 100
  }

  private calculateWalletBehaviorScore(flags: BehaviorFlag[]): { score: number; note: string } {
    if (!flags.length) {
      return {
        score: 100, // Full score for clean wallet
        note: 'Clean wallet history (100/100 points)'
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

      // Time decay: flags lose impact over time (365 days)
      const recencyMultiplier = Math.max(0.1, 1 - daysSinceOldest / 365)

      // Progressive penalty: multiple flags of same severity have diminishing returns
      const flagCount = flagsInGroup.length
      const basePenalty = (severityNum / 5) * 20 // Max 20 points penalty per severity
      const diminishingFactor = Math.log(flagCount + 1) / Math.log(2) // Logarithmic decrease

      const penalty = basePenalty * recencyMultiplier * diminishingFactor
      totalPenalty += penalty

      flagDetails.push(`${flagCount} severity-${severityNum} flag(s)`)
    })

    const finalScore = Math.max(0, Math.round((100 - totalPenalty) * 100) / 100)

    return {
      score: finalScore,
      note: `${flagDetails.join(', ')} (-${Math.round(totalPenalty * 100) / 100} penalty)`
    }
  }

  private calculateSocialScore(socialLinks: SocialLinkSubDocument[]): number {
    if (!socialLinks.length) return 0

    // Calculate total score from verified social accounts
    const totalScore = socialLinks.reduce((sum, link) => {
      const score = SOCIAL_SCORES[link.provider as keyof typeof SOCIAL_SCORES] || 0
      return sum + score
    }, 0)

    // Bonus points for account age
    const now = new Date()
    let ageBonus = 0

    socialLinks.forEach((link) => {
      const accountAge = (now.getTime() - link.verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (accountAge > 180) ageBonus += 0.5 // 0.5 points bonus for accounts older than 6 months
      if (accountAge > 365) ageBonus += 0.5 // Additional 0.5 points bonus for accounts older than 1 year
    })

    return Math.min(totalScore + ageBonus, 100)
  }

  private calculateKYCScore(kycStatus: KYCStatus): number {
    if (kycStatus.status !== 'approved') return 0
    if (kycStatus.expiration && kycStatus.expiration < new Date()) return 0

    let score = 100 // Full score for valid KYC

    // Deduct points if close to expiration (30 days warning)
    if (kycStatus.expiration) {
      const daysToExpiration = (kycStatus.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      if (daysToExpiration < 30) {
        score *= 0.8 // 20% reduction when close to expiration
      }
    }

    return Math.round(score * 100) / 100
  }

  private async calculateLaunchScore(issuerId: ObjectId): Promise<number> {
    const lookbackDate = new Date()
    lookbackDate.setMonth(lookbackDate.getMonth() - 6) // Consider launches from last 6 months

    const launchHistory = await databaseServices
      .getClient()
      .db()
      .collection('launches')
      .aggregate([
        {
          $match: {
            issuerId,
            launchDate: { $gte: lookbackDate }
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
    let score = successRate * 100

    // Bonus for multiple successful launches
    if (successfulLaunches >= 3) {
      score = Math.min(score + 5, 100) // 5 points bonus for 3+ successful launches
    }

    return Math.round(score * 100) / 100
  }

  private createScoreHistoryEntry(
    issuerId: ObjectId,
    scores: Record<string, ScoreResult>,
    totalScore: number,
    tier: IScores['tier']
  ): IScoreHistory {
    return {
      _id: new ObjectId(),
      issuerId: issuerId,
      scores: Object.entries(scores).map(([key, value]) => ({
        key: SCORE_CATEGORIES[key.toUpperCase() as keyof typeof SCORE_CATEGORIES],
        raw: getScoreValue(value),
        weighted: getScoreValue(value),
        note: typeof value === 'object' ? value.note : `${key} score calculation`
      })),
      totalScore,
      badge: tier,
      recordedAt: new Date(),
      version: 1,
      source: SCORE_HISTORY_SOURCES.SYSTEM
    }
  }

  async calculateAndUpdateScores(issuerId: ObjectId): Promise<void> {
    // Get current scores
    const currentScores = await databaseServices.scores.findOne({ issuerId })
    if (!currentScores) {
      logger.error('Scores not found for issuer', 'ScoresService.calculateAndUpdateScores', '', {
        issuerId: issuerId.toString()
      })
      return
    }

    // Calculate total score by summing all scores directly (no weights)
    const totalScore = Object.values(currentScores.scores).reduce((acc, value) => acc + value, 0)

    // Calculate tier based on total score
    const tier = this.calculateTier(totalScore)

    // Update scores
    await Promise.all([
      databaseServices.scores.updateOne(
        { issuerId },
        {
          $set: {
            totalScore,
            tier,
            updatedAt: new Date()
          }
        }
      )
    ])

    logger.info('Scores recalculated', 'ScoresService.calculateAndUpdateScores', '', {
      issuerId: issuerId.toString(),
      totalScore,
      tier
    })
  }

  async addSocialScore(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    const rawScore = SOCIAL_SCORES[provider as keyof typeof SOCIAL_SCORES] || 0

    // Get current scores
    const currentScores = await databaseServices.scores.findOne({ issuerId })
    if (!currentScores) {
      logger.error('Scores not found for issuer', 'ScoresService.addSocialScore', '', { issuerId: issuerId.toString() })
      return
    }

    // Update social score (max 100) - directly use raw score without weights
    const updatedSocialScore = Math.min(100, (currentScores.scores.social || 0) + rawScore)
    const updatedScores: IScoreSubDocument = {
      ...currentScores.scores,
      social: updatedSocialScore
    }

    // Calculate total score by summing all scores directly (no weights)
    const totalScore = Object.values(updatedScores).reduce((acc, value) => acc + value, 0)

    // Calculate tier based on total score
    const tier = this.calculateTier(totalScore)

    // Create score history entry
    const scoreHistory: IScoreHistory = {
      _id: new ObjectId(),
      issuerId,
      scores: [
        {
          key: `${SCORE_CATEGORIES.SOCIAL}:${provider}`,
          raw: rawScore,
          weighted: rawScore, // Keep weighted same as raw for consistency
          note: `Added ${rawScore} points for linking ${provider} account`
        }
      ],
      totalScore,
      badge: tier,
      recordedAt: new Date(),
      version: 1,
      source: SCORE_HISTORY_SOURCES.SYSTEM
    }

    // Update scores and add history
    await Promise.all([
      databaseServices.scores.updateOne(
        { issuerId },
        {
          $set: {
            scores: updatedScores,
            totalScore,
            tier,
            updatedAt: new Date()
          }
        }
      ),
      databaseServices.scoreHistories.insertOne(scoreHistory)
    ])

    logger.info('Social score updated', 'ScoresService.addSocialScore', '', {
      issuerId: issuerId.toString(),
      provider,
      rawScore,
      newTotalScore: totalScore,
      newTier: tier
    })
  }
}

export default new ScoresService()

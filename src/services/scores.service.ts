import { ObjectId } from 'mongodb'
import databaseServices from '~/services/database.services'
import { IScores, IScoreSubDocument } from '~/models/schemas/scores.schema'
import { BehaviorFlag, KYCStatus, SocialLinkSubDocument } from '~/models/schemas/issuer.schema'
import {
  scoreWeightsConfig,
  SCORE_CATEGORIES,
  DETAILED_SCORE_WEIGHTS,
  SCORE_HISTORY_SOURCES,
  SCORE_WEIGHTS,
  SOCIAL_SCORES,
  SCORE_TIERS
} from '~/constants/scores'
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
    const { BASE_MULTIPLIER, MAX_SCORE } = DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.STAKING]
    // Base score calculation using logarithmic scale
    const baseScore = Math.min(Math.log10(stakedAmount + 1) * BASE_MULTIPLIER, MAX_SCORE)
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

    const { TIME_DECAY_DAYS, MIN_MULTIPLIER, MAX_POINTS_PER_SEVERITY } =
      DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.WALLET_BEHAVIOR].SEVERITY_PENALTY

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
      const recencyMultiplier = Math.max(MIN_MULTIPLIER, 1 - daysSinceOldest / TIME_DECAY_DAYS)

      // Progressive penalty: multiple flags of same severity have diminishing returns
      const flagCount = flagsInGroup.length
      const basePenalty = (severityNum / 5) * MAX_POINTS_PER_SEVERITY
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

    const { BASE_WEIGHT, AGE_BONUS } = DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.SOCIAL]

    // Calculate total score from verified social accounts
    const totalScore = socialLinks.reduce((sum, link) => {
      const score = SOCIAL_SCORES[link.provider as keyof typeof SOCIAL_SCORES] || 0
      return sum + score
    }, 0)

    // Base points from weights
    const basePoints = Math.min(totalScore * BASE_WEIGHT, Number(scoreWeightsConfig.social))

    // Bonus points for account age
    const now = new Date()
    let ageBonus = 0

    socialLinks.forEach((link) => {
      const accountAge = (now.getTime() - link.verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (accountAge > 180) ageBonus += AGE_BONUS.SIX_MONTHS * Number(scoreWeightsConfig.social) // 6 months
      if (accountAge > 365) ageBonus += AGE_BONUS.ONE_YEAR * Number(scoreWeightsConfig.social) // 1 year
    })

    return Math.min(basePoints + ageBonus, Number(scoreWeightsConfig.social))
  }

  private calculateKYCScore(kycStatus: KYCStatus): number {
    if (kycStatus.status !== 'approved') return 0
    if (kycStatus.expiration && kycStatus.expiration < new Date()) return 0

    let score = Number(scoreWeightsConfig.kyc) // Base score for valid KYC

    const { EXPIRATION_WARNING_DAYS, EXPIRATION_PENALTY } = DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.KYC]

    // Deduct points if close to expiration
    if (kycStatus.expiration) {
      const daysToExpiration = (kycStatus.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      if (daysToExpiration < EXPIRATION_WARNING_DAYS) {
        score *= 1 - EXPIRATION_PENALTY
      }
    }

    return Math.round(score * 100) / 100
  }

  private async calculateLaunchScore(issuerId: ObjectId): Promise<number> {
    const { LOOKBACK_MONTHS, MULTIPLE_SUCCESS_BONUS, MIN_LAUNCHES_FOR_BONUS } =
      DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.LAUNCH_HISTORY]

    const lookbackDate = new Date()
    lookbackDate.setMonth(lookbackDate.getMonth() - LOOKBACK_MONTHS)

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
    let score = successRate * Number(scoreWeightsConfig.launchHistory)

    // Bonus for multiple successful launches
    if (successfulLaunches >= MIN_LAUNCHES_FOR_BONUS) {
      score = Math.min(score + MULTIPLE_SUCCESS_BONUS, Number(scoreWeightsConfig.launchHistory))
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

    // Calculate total score using SCORE_WEIGHTS
    const totalScore = Object.entries(currentScores.scores).reduce((acc, [key, value]) => {
      const weight = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS] || 0
      return acc + value * weight
    }, 0)

    // Calculate tier based on SCORE_TIERS
    const tier = this.calculateTier(totalScore)

    // Create score history entry for recalculation
    const scoreHistory: IScoreHistory = {
      _id: new ObjectId(),
      issuerId,
      scores: Object.entries(currentScores.scores).map(([key, value]) => {
        const weight = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS] || 0
        return {
          key: SCORE_CATEGORIES[key.toUpperCase() as keyof typeof SCORE_CATEGORIES] || key,
          raw: value,
          weighted: value * weight,
          note: `Score recalculation (weight: ${weight})`
        }
      }),
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
            totalScore,
            tier,
            updatedAt: new Date()
          }
        }
      ),
      databaseServices.scoreHistories.insertOne(scoreHistory)
    ])

    logger.info('Scores recalculated', 'ScoresService.calculateAndUpdateScores', '', {
      issuerId: issuerId.toString(),
      totalScore,
      tier
    })
  }

  async getProviderScore(provider: ProviderType): Promise<number> {
    return SOCIAL_SCORES[provider as keyof typeof SOCIAL_SCORES] || 0
  }

  async addSocialScore(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    const rawScore = SOCIAL_SCORES[provider] || 0

    // Get current scores
    const currentScores = await databaseServices.scores.findOne({ issuerId })
    if (!currentScores) {
      logger.error('Scores not found for issuer', 'ScoresService.addSocialScore', '', { issuerId: issuerId.toString() })
      return
    }

    // Calculate weighted score based on BASE_WEIGHT from DETAILED_SCORE_WEIGHTS
    const { BASE_WEIGHT } = DETAILED_SCORE_WEIGHTS[SCORE_CATEGORIES.SOCIAL]
    const weightedScore = rawScore * BASE_WEIGHT

    // Update social score (max 100)
    const updatedSocialScore = Math.min(100, (currentScores.scores.social || 0) + weightedScore)
    const updatedScores: IScoreSubDocument = {
      ...currentScores.scores,
      social: updatedSocialScore
    }

    // Calculate total score using SCORE_WEIGHTS
    const totalScore = Object.entries(updatedScores).reduce((acc, [key, value]) => {
      const weight = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS] || 0
      return acc + value * weight
    }, 0)

    // Calculate tier based on SCORE_TIERS
    const tier = this.calculateTier(totalScore)

    // Create score history entry
    const scoreHistory: IScoreHistory = {
      _id: new ObjectId(),
      issuerId,
      scores: [
        {
          key: `${SCORE_CATEGORIES.SOCIAL}:${provider}`,
          raw: rawScore,
          weighted: weightedScore,
          note: `Added score for linking ${provider} account (base: ${rawScore}, weighted: ${weightedScore})`
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
      weightedScore,
      newTotalScore: totalScore,
      newTier: tier
    })
  }
}

export default new ScoresService()

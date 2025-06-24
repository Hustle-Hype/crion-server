import { ObjectId } from 'mongodb'
import databaseServices from '~/services/database.services'
import { IScores, IScoreSubDocument } from '~/models/schemas/scores.schema'
import { BehaviorFlag, KYCStatus, SocialLinkSubDocument } from '~/models/schemas/issuer.schema'
import {
  SCORE_CATEGORIES,
  SCORE_HISTORY_SOURCES,
  SOCIAL_SCORES,
  SCORE_TIERS,
  GITHUB_COMMIT_SCORES
} from '~/constants/scores'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import { IScoreHistory } from '~/models/schemas/scoreHistory.schema'
import githubRequest from '~/config/githubApi'

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

  private async getGitHubCommitDays(username: string): Promise<number> {
    console.log(`[GitHub Score] Starting to get commit days for user: ${username}`)
    try {
      // 1. Get user repos, sorted by last push, limit to 100
      const reposResponse = await githubRequest.get(`/users/${username}/repos?per_page=100&sort=pushed`)
      const repos = reposResponse.data
      console.log(`[GitHub Score] Found ${repos.length} repositories for user: ${username}`)

      if (!repos || repos.length === 0) {
        return 0
      }

      const distinctCommitDates = new Set<string>()
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      // 2. For each repo, get commits from the last year
      const commitPromises = repos.map(async (repo: any) => {
        // Optimization: Skip repos not updated in the last year
        if (new Date(repo.pushed_at) < oneYearAgo) {
          return
        }

        try {
          const commitsResponse = await githubRequest.get(
            `/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&since=${oneYearAgo.toISOString()}`
          )
          const commits = commitsResponse.data

          commits.forEach((commit: any) => {
            // A commit can have a committer (who applied the patch) and an author (who wrote it).
            // We use the committer date as it reflects when the code was added to the repo.
            if (commit?.commit?.committer?.date) {
              const dateOnly = commit.commit.committer.date.split('T')[0]
              distinctCommitDates.add(dateOnly)
            }
          })
        } catch (err: any) {
          // It's common to get 409 (Git Repository is empty) or other errors for some repos.
          // We log and ignore these errors to not fail the whole process.
          logger.warn(
            `Skipping repo ${repo.name} for user ${username} while fetching commits`,
            'ScoresService.getGitHubCommitDays',
            '',
            { error: err.message }
          )
        }
      })

      await Promise.all(commitPromises)

      console.log(`[GitHub Score] Found ${distinctCommitDates.size} distinct commit days for user: ${username}`)
      return distinctCommitDates.size
    } catch (error: any) {
      logger.error('Error fetching GitHub repositories for user', 'ScoresService.getGitHubCommitDays', '', {
        username,
        error: error.message
      })
      return 0
    }
  }

  private async calculateGitHubScore(username: string): Promise<number> {
    const commitDays = await this.getGitHubCommitDays(username)
    console.log(`[GitHub Score] Calculating score for ${username} with ${commitDays} commit days.`)
    let totalScore = 0

    // Calculate score based on commit days thresholds (cumulative)
    if (commitDays >= GITHUB_COMMIT_SCORES.DAYS_30.threshold) {
      totalScore += GITHUB_COMMIT_SCORES.DAYS_30.points
    }
    if (commitDays >= GITHUB_COMMIT_SCORES.DAYS_60.threshold) {
      totalScore += GITHUB_COMMIT_SCORES.DAYS_60.points
    }
    if (commitDays >= GITHUB_COMMIT_SCORES.DAYS_120.threshold) {
      totalScore += GITHUB_COMMIT_SCORES.DAYS_120.points
    }

    console.log(`[GitHub Score] Calculated score for ${username} is: ${totalScore}`)
    return totalScore
  }

  async addSocialScore(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    let rawScore = SOCIAL_SCORES[provider as keyof typeof SOCIAL_SCORES] || 0

    // For GitHub, calculate score based on commit days
    if (provider === ProviderType.GITHUB) {
      console.log('[GitHub Score] Provider is GitHub, calculating special score.')
      const socialLink = await databaseServices.socialLinks.findOne({ issuerId, provider })
      if (socialLink?.metadata?.username) {
        rawScore = await this.calculateGitHubScore(socialLink.metadata.username)
        console.log(`[GitHub Score] Raw score for GitHub user ${socialLink.metadata.username} is ${rawScore}`)
      }
    }

    // Get current scores
    const currentScores = await databaseServices.scores.findOne({ issuerId })
    if (!currentScores) {
      logger.error('Scores not found for issuer', 'ScoresService.addSocialScore', '', { issuerId: issuerId.toString() })
      return
    }

    // Update social score (max 100) - directly use raw score without weights
    const updatedSocialScore = Math.min(100, (currentScores.scores.social || 0) + rawScore)
    console.log(
      `[GitHub Score] Previous social score: ${currentScores.scores.social}. New social score: ${updatedSocialScore}`
    )
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
          note:
            provider === ProviderType.GITHUB
              ? `Added ${rawScore} points for linking GitHub account based on commit days`
              : `Added ${rawScore} points for linking ${provider} account`
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

  async removeSocialScore(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    const unlinkPenalty: Record<Exclude<ProviderType, ProviderType.WALLET>, number> = {
      [ProviderType.GOOGLE]: 2, // +1 when link, -2 when unlink
      [ProviderType.X]: 3, // +1.5 when link, -3 when unlink
      [ProviderType.LINKEDIN]: 4, // +2 when link, -4 when unlink
      [ProviderType.TELEGRAM]: 2, // +1 when link, -2 when unlink
      [ProviderType.GITHUB]: 2 // Default penalty for any other provider
    }

    const penaltyScore = unlinkPenalty[provider] || 0

    // Get current scores
    const currentScores = await databaseServices.scores.findOne({ issuerId })
    if (!currentScores) {
      logger.error('Scores not found for issuer', 'ScoresService.removeSocialScore', '', {
        issuerId: issuerId.toString()
      })
      return
    }

    // Update social score (min 0) - deduct penalty score
    const updatedSocialScore = Math.max(0, (currentScores.scores.social || 0) - penaltyScore)
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
          raw: -penaltyScore,
          weighted: -penaltyScore, // Keep weighted same as raw for consistency
          note: `Deducted ${penaltyScore} points for unlinking ${provider} account`
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

    logger.info('Social score updated after unlinking', 'ScoresService.removeSocialScore', '', {
      issuerId: issuerId.toString(),
      provider,
      penaltyScore,
      newTotalScore: totalScore,
      newTier: tier
    })
  }
}

export default new ScoresService()

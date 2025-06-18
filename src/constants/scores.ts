import { config } from 'dotenv'
import argv from 'minimist'
import type { StringValue } from 'ms'
import { ProviderType } from './enum'

const options = argv(process.argv.slice(2))

config({
  path: options.env ? `.env.${options.env}` : '.env'
})

export const scoreWeightsConfig = {
  social: process.env.SOCIAL_WEIGHT as number | StringValue,
  staking: process.env.STAKING_WEIGHT as number | StringValue,
  walletBehavior: process.env.WALLET_BEHAVIOR_WEIGHT as number | StringValue,
  launchHistory: process.env.LAUNCH_HISTORY_WEIGHT as number | StringValue,
  kyc: process.env.KYC_WEIGHT as number | StringValue
}

type SocialProvider = Extract<
  ProviderType,
  ProviderType.GOOGLE | ProviderType.X | ProviderType.LINKEDIN | ProviderType.TELEGRAM
>

export const SOCIAL_SCORE_WEIGHTS: Record<SocialProvider, number> = {
  [ProviderType.GOOGLE]: 1,
  [ProviderType.X]: 1.5,
  [ProviderType.LINKEDIN]: 2,
  [ProviderType.TELEGRAM]: 1
}

export const TIER_THRESHOLDS = {
  platinum: 90,
  gold: 80,
  silver: 70,
  bronze: 60,
  new_issuer: 0
} as const

export type TierType = keyof typeof TIER_THRESHOLDS

// Score history source types
export const SCORE_HISTORY_SOURCES = {
  SYSTEM: 'system',
  MANUAL: 'manual',
  IMPORT: 'import',
  MIGRATION: 'migration'
} as const

export type ScoreHistorySource = (typeof SCORE_HISTORY_SOURCES)[keyof typeof SCORE_HISTORY_SOURCES]

// Score categories for history tracking
export const SCORE_CATEGORIES = {
  SOCIAL: 'social',
  STAKING: 'staking',
  WALLET_BEHAVIOR: 'wallet_behavior',
  LAUNCH_HISTORY: 'launch_history',
  KYC: 'kyc'
} as const

export type ScoreCategory = (typeof SCORE_CATEGORIES)[keyof typeof SCORE_CATEGORIES]

// Detailed score weights for each category
export const DETAILED_SCORE_WEIGHTS = {
  [SCORE_CATEGORIES.SOCIAL]: {
    BASE_WEIGHT: 0.7, // 70% of total social score
    AGE_BONUS: {
      SIX_MONTHS: 0.15, // 15% bonus for accounts older than 6 months
      ONE_YEAR: 0.15 // 15% bonus for accounts older than 1 year
    }
  },
  [SCORE_CATEGORIES.STAKING]: {
    BASE_MULTIPLIER: 8.33, // Base multiplier for logarithmic calculation
    MAX_SCORE: Number(scoreWeightsConfig.staking)
  },
  [SCORE_CATEGORIES.WALLET_BEHAVIOR]: {
    SEVERITY_PENALTY: {
      TIME_DECAY_DAYS: 365, // Days until penalty starts decaying
      MIN_MULTIPLIER: 0.1, // Minimum penalty multiplier after decay
      MAX_POINTS_PER_SEVERITY: 8 // Maximum points that can be deducted per severity level
    }
  },
  [SCORE_CATEGORIES.LAUNCH_HISTORY]: {
    LOOKBACK_MONTHS: 6, // Consider launches from last 6 months
    MULTIPLE_SUCCESS_BONUS: 5, // Bonus points for 3+ successful launches
    MIN_LAUNCHES_FOR_BONUS: 3
  },
  [SCORE_CATEGORIES.KYC]: {
    EXPIRATION_WARNING_DAYS: 30, // Days before expiration to start reducing score
    EXPIRATION_PENALTY: 0.2 // 20% reduction when close to expiration
  }
}

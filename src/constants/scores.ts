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

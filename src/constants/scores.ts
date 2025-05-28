import { config } from 'dotenv'
import argv from 'minimist'
import type { StringValue } from 'ms'

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

import { config } from 'dotenv'
import argv from 'minimist'
import type { StringValue } from 'ms'

const options = argv(process.argv.slice(2))

config({
  path: options.env ? `.env.${options.env}` : '.env'
})

export const scoreRewardConfig = {
  social: process.env.SOCIAL_CONNECTED_REWARD as number | StringValue
}

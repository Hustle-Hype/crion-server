import { config } from 'dotenv'
import argv from 'minimist'
import type { StringValue } from 'ms'
import {
  DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  MAX_REFRESH_TOKEN_EXPIRES_IN
} from '~/constants/token'

const options = argv(process.argv.slice(2))

config({
  path: options.env ? `.env.${options.env}` : '.env'
})

const parseTokenExpiration = (value: string | undefined, defaultValue: number, maxValue?: number): number => {
  if (!value) return defaultValue
  const parsed = parseInt(value)
  if (isNaN(parsed) || parsed <= 0) return defaultValue
  if (maxValue && parsed > maxValue) return maxValue
  return parsed
}

export const envConfig = {
  // Server Configuration
  host: process.env.HOST as string,
  port: (process.env.PORT as string) || 8000,
  clientUrl: process.env.CLIENT_URL as string,
  mongodbUri: process.env.MONGODB_URI as string,
  appName: process.env.APP_NAME as string,

  sessionSecret: process.env.SESSION_SECRET as string,

  nodeEnv: process.env.NODE_ENV as string,

  // Database Connection
  dbUsername: process.env.DB_USERNAME as string,
  dbPassword: process.env.DB_PASSWORD as string,
  dbName: process.env.DB_NAME as string,

  // Encription
  encryptionKey: process.env.ENCRYPTION_KEY as string,

  // Authentication
  jwtSecretAccessToken: process.env.JWT_SECRET_ACCESS_TOKEN as string,
  jwtSecretRefreshToken: process.env.JWT_SECRET_REFRESH_TOKEN as string,
  accessTokenExpiresIn: parseTokenExpiration(process.env.JWT_EXPIRES_IN_ACCESS_TOKEN, DEFAULT_ACCESS_TOKEN_EXPIRES_IN),
  refreshTokenExpiresIn: parseTokenExpiration(
    process.env.JWT_EXPIRES_IN_REFRESH_TOKEN,
    DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
    MAX_REFRESH_TOKEN_EXPIRES_IN
  ),
  jwtSecretEmailVerifyToken: process.env.JWT_SECRET_EMAIL_VERIFY_TOKEN as string,
  emailVerifyTokenExpiresIn: process.env.JWT_EXPIRES_IN_EMAIL_VERIFY_TOKEN as number | StringValue,

  // google oauth20
  googleClientId: process.env.GOOGLE_CLIENT_ID as string,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  googleCallbackURLDev: process.env.GOOGLE_CALLBACK_URL_DEV as string,
  googleCallbackURLProd: process.env.GOOGLE_CALLBACK_URL_PROD as string,
  googleRedirectClientUrl: process.env.GOOGLE_REDIRECT_CLIENT_URL as string,

  // x/twitter
  twitterApiKey: process.env.TWITTER_API_KEY as string,
  twitterApiSecretKey: process.env.TWITTER_API_SECRET_KEY as string,
  twitterCallbackURLDev: process.env.TWITTER_CALLBACK_URL_DEV as string,
  twitterCallbackURLProd: process.env.TWITTER_CALLBACK_URL_PROD as string,
  xRedirectClientUrl: process.env.X_REDIRECT_CLIENT_URL as string,

  // Cloudinary
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY as string,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET as string,

  // AWS S3
  awsRegion: process.env.AWS_REGION as string,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  awsS3Bucket: process.env.AWS_S3_BUCKET as string,

  // File Upload
  defaultUploadService: (process.env.DEFAULT_UPLOAD_SERVICE as 'cloudinary' | 's3') || 'cloudinary',

  // Collections
  dbIssuerCollection: process.env.DB_ISSUER_COLLECTION as string,
  dbScoresCollection: process.env.DB_SCORES_COLLECTION as string,
  dbScoreHistoriesCollection: process.env.DB_SCORE_HISTORIES_COLLECTION as string,
  dbSocialLinksCollection: process.env.DB_SOCIAL_LINKS_COLLECTION as string,
  dbTokenCollection: process.env.DB_TOKEN_COLLECTION as string,

  // Github config
  githubClientId: process.env.GITHUB_CLIENT_ID as string,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET as string,
  githubCallbackURLDev: process.env.GITHUB_CALLBACK_URL_DEV as string,
  githubCallbackURLProd: process.env.GITHUB_CALLBACK_URL_PROD as string,
  githubAccessToken: process.env.GITHUB_ACCESS_TOKEN as string
} as const

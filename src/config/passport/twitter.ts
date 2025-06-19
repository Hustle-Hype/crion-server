import { Strategy as TwitterStrategy } from 'passport-twitter'
import { Profile } from 'passport'
import { Request } from 'express'
import { envConfig } from '../config'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import issuerService from '~/services/issuer.service'
import { ObjectId } from 'mongodb'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'

export const twitterStrategy = new TwitterStrategy(
  {
    consumerKey: envConfig.twitterApiKey,
    consumerSecret: envConfig.twitterApiSecretKey,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.twitterCallbackURLDev : envConfig.twitterCallbackURLProd,
    includeEmail: true,
    passReqToCallback: true,
    userProfileURL: 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true'
  },
  async (
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ) => {
    try {
      if (!req.user || !req.decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      if (!profile.emails || profile.emails.length === 0) {
        const rawProfile = profile as any // eslint-disable-line @typescript-eslint/no-explicit-any
        if (rawProfile._json?.email) {
          console.log('rawProfile._json.email', rawProfile._json.email)
          profile.emails = [{ value: rawProfile._json.email }]
        }
      }

      await issuerService.linkSocialAccount(new ObjectId(req.decodedAuthorization.issuerId), profile, ProviderType.X)

      return done(null, profile)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(errorMessage, 'passport.twitterStrategy')
      return done(error, false)
    }
  }
)

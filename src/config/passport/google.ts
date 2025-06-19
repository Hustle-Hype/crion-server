import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import { Request } from 'express'
import { envConfig } from '../config'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import issuerService from '~/services/issuer.service'
import { ObjectId } from 'mongodb'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'

export const googleStrategy = new GoogleStrategy(
  {
    clientID: envConfig.googleClientId,
    clientSecret: envConfig.googleClientSecret,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.googleCallbackURLDev : envConfig.googleCallbackURLProd,
    scope: ['profile', 'email'],
    passReqToCallback: true
  },
  async (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
    try {
      if (!req.user || !req.decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      logger.info(`Google auth attempt for profile ID ${profile.id}`, 'passport.googleStrategy')

      await issuerService.linkSocialAccount(
        new ObjectId(req.decodedAuthorization.issuerId),
        profile,
        ProviderType.GOOGLE
      )

      return done(null, profile)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Google authentication error: ${errorMessage}`, 'passport.googleStrategy')
      return done(error, false)
    }
  }
)

export default googleStrategy

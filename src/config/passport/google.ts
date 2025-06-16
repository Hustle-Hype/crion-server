import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import { envConfig } from '../config'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import authService from '~/services/auth.service'

export const googleStrategy = new GoogleStrategy(
  {
    clientID: envConfig.googleClientId,
    clientSecret: envConfig.googleClientSecret,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.googleCallbackURLDev : envConfig.googleCallbackURLProd,
    scope: ['profile', 'email'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile: Profile, done: VerifyCallback) => {
    try {
      logger.info(`Google auth attempt for profile ID ${profile.id}`, 'passport.googleStrategy')

      const result = await authService.handleSocialLogin(profile, ProviderType.GOOGLE, req)
      return done(null, result as Express.User)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Google authentication error: ${errorMessage}`, 'passport.googleStrategy')
      return done(error, false)
    }
  }
)

export default googleStrategy

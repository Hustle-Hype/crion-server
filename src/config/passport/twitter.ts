import { Strategy as TwitterStrategy } from 'passport-twitter'
import { Profile } from 'passport'
import { Request } from 'express'
import { envConfig } from '../config'
import { ProviderType } from '~/constants/enum'
import { logger } from '~/loggers/my-logger.log'
import authService from '~/services/auth.service'

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
    done: (error: any, user?: any) => void
  ) => {
    try {
      if (!profile.emails || profile.emails.length === 0) {
        const rawProfile = profile as any
        if (rawProfile._json?.email) {
          console.log('rawProfile._json.email', rawProfile._json.email)
          profile.emails = [{ value: rawProfile._json.email }]
        }
      }

      const result = await authService.handleSocialLogin(profile, ProviderType.X, req)

      return done(null, result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(errorMessage, 'passport.twitterStrategy')
      return done(error, false)
    }
  }
)

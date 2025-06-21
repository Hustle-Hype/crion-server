import { Strategy as TwitterStrategy } from 'passport-twitter'
import { Profile } from 'passport'
import { Request } from 'express'
import { envConfig } from '../config'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { verifyToken } from '~/utils/jwt.utils'
import { TokenType } from '~/models/schemas/token.schema'

export const twitterStrategy = new TwitterStrategy(
  {
    consumerKey: envConfig.twitterApiKey,
    consumerSecret: envConfig.twitterApiSecretKey,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.twitterCallbackURLDev : envConfig.twitterCallbackURLProd,
    includeEmail: true,
    passReqToCallback: true,
    // For Twitter OAuth 1.0a, we need to use session to store state
    userAuthorizationURL: 'https://api.twitter.com/oauth/authenticate'
  },
  async (
    req: Request,
    token: string,
    tokenSecret: string,
    profile: Profile,
    done: (error: any, user?: any) => void
  ) => {
    try {
      console.log('Twitter strategy executing', {
        hasProfile: !!profile,
        profileId: profile?.id,
        hasToken: !!token,
        session: req.session
      })

      // Get state from session
      const state = req.session?.['twitter_oauth_state']
      if (!state) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const { issuerId, accessToken } = state

      if (!issuerId || !accessToken) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      // Verify JWT token
      const decoded = await verifyToken({
        token: accessToken,
        type: TokenType.AccessToken,
        req
      })

      if (!decoded.issuerId || decoded.issuerId.toString() !== issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      // Clean up session
      delete req.session?.['twitter_oauth_state']

      // Return profile with issuerId
      return done(null, {
        ...profile,
        issuerId: decoded.issuerId
      })
    } catch (error) {
      console.error('Twitter strategy error:', error)
      return done(error, false)
    }
  }
)

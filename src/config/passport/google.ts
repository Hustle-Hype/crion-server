import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import { Request } from 'express'
import { envConfig } from '../config'
import { logger } from '~/loggers/my-logger.log'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { verifyToken } from '~/utils/jwt.utils'
import { TokenType } from '~/models/schemas/token.schema'

export const googleStrategy = new GoogleStrategy(
  {
    clientID: envConfig.googleClientId,
    clientSecret: envConfig.googleClientSecret,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.googleCallbackURLDev : envConfig.googleCallbackURLProd,
    passReqToCallback: true
  },
  async (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
    try {
      console.log('Google strategy executing', {
        hasProfile: !!profile,
        profileId: profile?.id,
        state: req.query.state,
        query: req.query
      })

      // Get state from query parameter
      const stateString = req.query.state as string
      if (!stateString) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      try {
        // Decode state
        const state = JSON.parse(Buffer.from(stateString, 'base64').toString())
        const { issuerId, accessToken: userAccessToken } = state

        if (!issuerId || !userAccessToken) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.UNAUTHORIZED,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        // Verify JWT token
        const decoded = await verifyToken({
          token: userAccessToken,
          type: TokenType.AccessToken,
          req
        })

        if (!decoded.issuerId || decoded.issuerId.toString() !== issuerId) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.UNAUTHORIZED,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        return done(null, {
          ...profile,
          issuerId: decoded.issuerId.toString()
        })
      } catch (error) {
        console.error('Error decoding state:', error)
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Google authentication error: ${errorMessage}`, 'passport.googleStrategy')
      console.error('Google strategy error:', error)
      return done(error as Error, undefined)
    }
  }
)

export default googleStrategy

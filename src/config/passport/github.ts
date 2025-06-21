import { Strategy as GitHubStrategy } from 'passport-github2'
import { Profile } from 'passport'
import { Request } from 'express'
import { envConfig } from '../config'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { logger } from '~/loggers/my-logger.log'
import { verifyToken } from '~/utils/jwt.utils'
import { TokenType } from '~/models/schemas/token.schema'

export const githubStrategy = new GitHubStrategy(
  {
    clientID: envConfig.githubClientId,
    clientSecret: envConfig.githubClientSecret,
    callbackURL:
      process.env.NODE_ENV === 'development' ? envConfig.githubCallbackURLDev : envConfig.githubCallbackURLProd,
    passReqToCallback: true
  },
  async (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: any) => {
    try {
      console.log('Github strategy executing', {
        hasProfile: !!profile,
        profileId: profile?.id,
        state: req.query.state
      })

      // Get state from query parameter
      const stateString = req.query.state as string
      if (!stateString) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`GitHub authentication error: ${errorMessage}`, 'passport.githubStrategy')
      console.error('Github strategy error:', error)
      return done(error as Error, false)
    }
  }
)

export default githubStrategy

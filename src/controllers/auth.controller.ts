import { Request, Response, NextFunction } from 'express'
import { httpStatusCode } from '~/core/httpStatusCode'
import { ErrorWithStatus } from '~/utils/error.utils'
import { AUTH_MESSAGES } from '~/constants/messages'
import authService from '~/services/auth.service'
import { logger } from '~/loggers/my-logger.log'

class AuthController {
  async handleSocialLoginCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const authenticatedSession = req.user
      if (!authenticatedSession) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      // Log successful authentication
      logger.info('Social login successful', 'auth.handleSocialLoginCallback', '', {
        provider: authenticatedSession.account?.provider
      })

      // Return tokens and issuer info
      res.json({
        message: AUTH_MESSAGES.LOGIN_SUCCESS,
        result: {
          access_token: authenticatedSession.accessToken,
          refresh_token: authenticatedSession.refreshToken,
          issuer: authenticatedSession.issuer,
          linked_account: authenticatedSession.account
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Social login callback error', 'auth.handleSocialLoginCallback', '', { error: errorMessage })
      next(error)
    }
  }

  async handleRefreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body
      if (!refresh_token) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.REFRESH_TOKEN_IS_REQUIRED,
          status: httpStatusCode.BAD_REQUEST
        })
      }

      const result = await authService.refreshToken(refresh_token, req)
      res.json({
        message: AUTH_MESSAGES.REFRESH_TOKEN_SUCCESS,
        result: {
          access_token: result.accessToken,
          refresh_token: result.refreshToken
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async handleLogout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body
      if (!refresh_token) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.REFRESH_TOKEN_IS_REQUIRED,
          status: httpStatusCode.BAD_REQUEST
        })
      }

      await authService.logout(refresh_token)
      res.json({
        message: AUTH_MESSAGES.LOGOUT_SUCCESS
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new AuthController()

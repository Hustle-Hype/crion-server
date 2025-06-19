import { Request, Response, NextFunction } from 'express'
import { httpStatusCode } from '~/core/httpStatusCode'
import { ErrorWithStatus } from '~/utils/error.utils'
import { AUTH_MESSAGES } from '~/constants/messages'
import issuerService from '~/services/issuer.service'
import { logger } from '~/loggers/my-logger.log'
import { ObjectId } from 'mongodb'
import { ProviderType } from '~/constants/enum'
import { OK } from '~/core/succes.response'

class IssuerController {
  async handleSocialLinkCallback(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      new OK({
        message: AUTH_MESSAGES.SOCIAL_LINK_SUCCESS
      }).send(res)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Social link callback error', 'issuer.handleSocialLinkCallback', '', { error: errorMessage })
      next(error)
    }
  }

  async handleSocialUnlink(req: Request, res: Response, next: NextFunction) {
    try {
      const { decodedAuthorization } = req
      const { provider } = req.params

      if (!decodedAuthorization) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      if (!Object.values(ProviderType).includes(provider as ProviderType)) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.INVALID_PROVIDER,
          status: httpStatusCode.BAD_REQUEST
        })
      }

      await issuerService.unlinkSocialAccount(
        new ObjectId(decodedAuthorization.issuerId),
        provider as Exclude<ProviderType, ProviderType.WALLET>
      )

      new OK({
        message: AUTH_MESSAGES.UNLINK_SUCCESS
      }).send(res)
    } catch (error) {
      next(error)
    }
  }
}

export default new IssuerController()

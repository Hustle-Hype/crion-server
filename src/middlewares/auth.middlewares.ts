import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation.utils'
import { verifyAccessToken, verifyRefreshToken } from '~/utils/jwt.utils'
import { JsonWebTokenError } from 'jsonwebtoken'
import { ErrorWithStatus } from '~/utils/error.utils'
import databaseServices from '~/services/database.services'
import { httpStatusCode } from '~/core/httpStatusCode'
import { Request } from 'express'
import { AUTH_MESSAGES } from '~/constants/messages'
import { MAX_SIGNATURE_AGE } from '~/models/requests/login.request'
import { logger } from '~/loggers/my-logger.log'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { ObjectId } from 'mongodb'

export const nonceValidation = validate(
  checkSchema(
    {
      wallet_address: {
        notEmpty: {
          errorMessage: AUTH_MESSAGES.ADDRESS_REQUIRED
        },
        isString: {
          errorMessage: AUTH_MESSAGES.ADDRESS_MUST_BE_STRING
        },
        matches: {
          options: /^0x[a-fA-F0-9]{64}$/,
          errorMessage: AUTH_MESSAGES.INVALID_ADDRESS_FORMAT
        }
      }
    },
    ['query']
  )
)

export const accessTokenValidation = wrapRequestHandler(
  validate(
    checkSchema({
      authorization: {
        trim: true,
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new Error(AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED)
            }
            const accessToken = value.split(' ')[1]
            if (!accessToken) {
              throw new Error(AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED)
            }

            try {
              const decodedAuthorization = await verifyAccessToken(accessToken, req as Request)

              const issuer = await databaseServices.issuers.findOne({
                _id: new ObjectId(decodedAuthorization.issuerId)
              })
              if (!issuer) {
                throw new ErrorWithStatus({
                  message: AUTH_MESSAGES.USER_NOT_FOUND,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }

              req.decodedAuthorization = decodedAuthorization
            } catch (error) {
              if (error instanceof JsonWebTokenError) {
                throw new ErrorWithStatus({
                  message: error.message,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }
              throw error
            }

            return true
          }
        }
      }
    })
  )
)

export const refreshTokenValidation = wrapRequestHandler(
  validate(
    checkSchema({
      refreshToken: {
        trim: true,
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new Error(AUTH_MESSAGES.REFRESH_TOKEN_IS_REQUIRED)
            }

            try {
              const decodedRefreshToken = await verifyRefreshToken(value, req as Request)

              const issuer = await databaseServices.issuers.findOne({
                _id: new ObjectId(decodedRefreshToken.issuerId)
              })

              if (!issuer) {
                throw new ErrorWithStatus({
                  message: AUTH_MESSAGES.USER_NOT_FOUND,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }

              req.decodedRefreshToken = decodedRefreshToken
            } catch (error) {
              if (error instanceof JsonWebTokenError) {
                throw new ErrorWithStatus({
                  message: error.message,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }
              throw error
            }
            return true
          }
        }
      }
    })
  )
)

export const walletLoginValidation = validate(
  checkSchema({
    address: {
      notEmpty: {
        errorMessage: AUTH_MESSAGES.ADDRESS_REQUIRED
      },
      isString: {
        errorMessage: AUTH_MESSAGES.ADDRESS_MUST_BE_STRING
      },
      matches: {
        options: /^0x[a-fA-F0-9]{64}$/,
        errorMessage: AUTH_MESSAGES.INVALID_ADDRESS_FORMAT
      }
    },
    publicKey: {
      notEmpty: {
        errorMessage: 'Public key is required'
      },
      isString: {
        errorMessage: 'Public key must be a string'
      }
    },
    signature: {
      notEmpty: {
        errorMessage: AUTH_MESSAGES.SIGNATURE_REQUIRED
      },
      custom: {
        options: (value) => {
          if (!value || typeof value !== 'object') {
            throw new Error(AUTH_MESSAGES.INVALID_SIGNATURE_FORMAT)
          }

          return true
        }
      }
    },
    message: {
      notEmpty: {
        errorMessage: AUTH_MESSAGES.MESSAGE_REQUIRED
      },
      isString: {
        errorMessage: AUTH_MESSAGES.MESSAGE_MUST_BE_STRING
      },
      custom: {
        options: (value: string, { req }) => {
          try {
            const messageData = typeof value === 'string' ? JSON.parse(value) : value

            if (!messageData.nonce || !messageData.address || !messageData.timestamp || !messageData.domain) {
              throw new Error(AUTH_MESSAGES.INVALID_MESSAGE_FORMAT)
            }

            const now = Date.now()
            if (messageData.timestamp > now) {
              throw new Error(AUTH_MESSAGES.FUTURE_TIMESTAMP)
            }
            if (now - messageData.timestamp > MAX_SIGNATURE_AGE) {
              throw new Error(AUTH_MESSAGES.SIGNATURE_EXPIRED)
            }

            if (messageData.address.toLowerCase() !== req.body.address.toLowerCase()) {
              throw new Error(AUTH_MESSAGES.ADDRESS_MISMATCH)
            }

            return true
          } catch (error) {
            logger.error('Error parsing message', 'AuthMiddleware.walletLoginValidation', '', { error })
            throw new Error(AUTH_MESSAGES.INVALID_MESSAGE_FORMAT)
          }
        }
      }
    }
  })
)

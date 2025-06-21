import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation.utils'
import { verifyRefreshToken, verifyToken } from '~/utils/jwt.utils'
import { JsonWebTokenError } from 'jsonwebtoken'
import { ErrorWithStatus } from '~/utils/error.utils'
import databaseServices from '~/services/database.services'
import { httpStatusCode } from '~/core/httpStatusCode'
import { Request, Response, NextFunction } from 'express'
import { AUTH_MESSAGES } from '~/constants/messages'
import { MAX_SIGNATURE_AGE } from '~/models/requests/login.request'
import { logger } from '~/loggers/my-logger.log'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { ObjectId } from 'mongodb'
import { TokenType } from '~/models/schemas/token.schema'
import { ProviderType } from '~/constants/enum'

type SocialProvider = Exclude<ProviderType, ProviderType.WALLET>

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

export const accessTokenValidation = wrapRequestHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined

  // Check Authorization header first
  const authorization = req.headers.authorization
  if (authorization) {
    const [tokenType, authToken] = authorization.split(' ')
    if (tokenType === 'Bearer' && authToken) {
      token = authToken
    }
  }

  // If not in header, check query parameters
  if (!token && req.query.access_token) {
    token = req.query.access_token as string
    // Add it to headers for passport to use
    req.headers.authorization = `Bearer ${token}`
  }

  // If still not found, check body
  if (!token && req.body?.access_token) {
    token = req.body.access_token
    req.headers.authorization = `Bearer ${token}`
  }

  if (!token) {
    return next(
      new ErrorWithStatus({
        message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
        status: httpStatusCode.UNAUTHORIZED
      })
    )
  }

  try {
    const decodedAuthorization = await verifyToken({
      token,
      type: TokenType.AccessToken,
      req
    })

    req.decodedAuthorization = decodedAuthorization
    return next()
  } catch (error) {
    return next(error)
  }
})

export const checkSocialLinkStatus = wrapRequestHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { decodedAuthorization } = req
  if (!decodedAuthorization?.issuerId) {
    return next(
      new ErrorWithStatus({
        message: AUTH_MESSAGES.UNAUTHORIZED,
        status: httpStatusCode.UNAUTHORIZED
      })
    )
  }

  // Get provider from route path
  const path = req.path
  let provider: SocialProvider | null = null

  // Map path to provider
  const providerMap: Record<string, SocialProvider> = {
    '/google': ProviderType.GOOGLE,
    '/twitter': ProviderType.X,
    '/github': ProviderType.GITHUB
  }

  // Find matching provider
  for (const [key, value] of Object.entries(providerMap)) {
    if (path.includes(key)) {
      provider = value as SocialProvider
      break
    }
  }

  if (!provider) {
    return next(
      new ErrorWithStatus({
        message: AUTH_MESSAGES.INVALID_PROVIDER,
        status: httpStatusCode.BAD_REQUEST
      })
    )
  }

  try {
    // Check if user already has this provider linked
    const existingLink = await databaseServices.socialLinks.findOne({
      issuerId: new ObjectId(decodedAuthorization.issuerId),
      provider
    })

    if (existingLink) {
      return res.status(httpStatusCode.OK).json({
        message: AUTH_MESSAGES.PROVIDER_ALREADY_LINKED,
        data: {
          provider,
          isLinked: true
        }
      })
    }

    return next()
  } catch (error) {
    return next(error)
  }
})

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

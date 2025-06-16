import { AUTH_MESSAGES } from '~/constants/messages'
import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation.utils'
import { verifyAccessToken, verifyRefreshToken } from '~/utils/jwt.utils'
import { JsonWebTokenError } from 'jsonwebtoken'
import { ErrorWithStatus } from '~/utils/error.utils'
import databaseServices from '~/services/database.services'
import { httpStatusCode } from '~/core/httpStatusCode'
import { Request } from 'express'
// import redisClient from '~/config/redis'

export const accessTokenValidation = validate(
  checkSchema({
    authorization: {
      trim: true,
      custom: {
        options: async (value: string, { req }) => {
          if (!value) {
            throw new ErrorWithStatus({
              message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
              status: httpStatusCode.UNAUTHORIZED
            })
          }
          const access_token = value.split(' ')[1]
          if (!access_token) {
            throw new ErrorWithStatus({
              message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
              status: httpStatusCode.UNAUTHORIZED
            })
          }

          try {
            const decodedAuthorization = await verifyAccessToken(access_token, req as Request)

            // Verify issuer still exists and is active
            const issuer = await databaseServices.issuers.findOne({ _id: decodedAuthorization.issuerId })
            if (!issuer) {
              throw new ErrorWithStatus({
                message: AUTH_MESSAGES.USER_NOT_FOUND,
                status: httpStatusCode.UNAUTHORIZED
              })
            }

            // If token has accountId, verify account exists and is linked to issuer
            if (decodedAuthorization.accountId) {
              const account = await databaseServices.accounts.findOne({
                _id: decodedAuthorization.accountId,
                issuerId: decodedAuthorization.issuerId
              })
              if (!account) {
                throw new ErrorWithStatus({
                  message: AUTH_MESSAGES.USER_NOT_FOUND,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }
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

export const refreshTokenValidation = validate(
  checkSchema({
    refreshToken: {
      trim: true,
      custom: {
        options: async (value: string, { req }) => {
          if (!value) {
            throw new ErrorWithStatus({
              message: AUTH_MESSAGES.REFRESH_TOKEN_IS_REQUIRED,
              status: httpStatusCode.UNAUTHORIZED
            })
          }

          try {
            const decodedRefreshToken = await verifyRefreshToken(value, req as Request)

            // Verify issuer still exists and is active
            const issuer = await databaseServices.issuers.findOne({ _id: decodedRefreshToken.issuerId })
            if (!issuer) {
              throw new ErrorWithStatus({
                message: AUTH_MESSAGES.USER_NOT_FOUND,
                status: httpStatusCode.UNAUTHORIZED
              })
            }

            // If token has accountId, verify account exists and is linked to issuer
            if (decodedRefreshToken.accountId) {
              const account = await databaseServices.accounts.findOne({
                _id: decodedRefreshToken.accountId,
                issuerId: decodedRefreshToken.issuerId
              })
              if (!account) {
                throw new ErrorWithStatus({
                  message: AUTH_MESSAGES.USER_NOT_FOUND,
                  status: httpStatusCode.UNAUTHORIZED
                })
              }
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

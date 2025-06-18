import jwt from 'jsonwebtoken'
import { TokenType, createToken } from '~/models/schemas/token.schema'
import { envConfig } from '~/config/config'
import { TokenPayload } from '~/models/requests/token.request'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { logger } from '~/loggers/my-logger.log'
import { ObjectId } from 'mongodb'
import { generateJti, getSecurityContext } from './security.utils'
import { Request } from 'express'
import databaseServices from '~/services/database.services'

interface SignTokenOptions {
  issuerId: ObjectId
  type: TokenType
  scope?: string[]
  req: Request
}

const getTokenExpiration = (type: TokenType): number => {
  return type === TokenType.AccessToken ? envConfig.accessTokenExpiresIn : envConfig.refreshTokenExpiresIn
}

export const signToken = async ({ issuerId, type, scope, req }: SignTokenOptions): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000)
    const securityContext = getSecurityContext(req)
    const expiresIn = getTokenExpiration(type)

    const payload: TokenPayload = {
      issuerId,
      type,

      iat: now,
      exp: now + expiresIn,
      jti: generateJti(),
      iss: envConfig.appName,
      sub: issuerId.toString(),

      ...securityContext,

      scope
    }

    const privateKey = type === TokenType.AccessToken ? envConfig.jwtSecretAccessToken : envConfig.jwtSecretRefreshToken

    const token = await new Promise<string>((resolve, reject) => {
      jwt.sign(
        payload,
        privateKey,
        {
          algorithm: 'HS256'
        },
        (err, token) => {
          if (err) {
            logger.error('Error signing token', 'signToken', '', { error: err })
            reject(err)
          } else resolve(token as string)
        }
      )
    })

    if (type === TokenType.RefreshToken) {
      const tokenDoc = createToken({
        token,
        type,
        issuerId,
        expiresAt: new Date((now + expiresIn) * 1000),
        userAgent: req.headers['user-agent'],
        ipAddress: securityContext.ip
      })

      await databaseServices.tokens.insertOne(tokenDoc)
    }

    return token
  } catch (error) {
    logger.error('Error in signToken', 'signToken', '', { error })
    throw new ErrorWithStatus({
      message: AUTH_MESSAGES.TOKEN_GENERATION_FAILED,
      status: httpStatusCode.INTERNAL_SERVER_ERROR
    })
  }
}

interface VerifyTokenOptions {
  token: string
  type: TokenType
  req: Request
}

export const verifyToken = async ({ token, type, req }: VerifyTokenOptions): Promise<TokenPayload> => {
  try {
    const secretKey = type === TokenType.AccessToken ? envConfig.jwtSecretAccessToken : envConfig.jwtSecretRefreshToken
    const decoded = await new Promise<TokenPayload>((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          logger.error('JWT verification failed', 'verifyToken', '', { error: err })
          reject(err)
        } else resolve(decoded as TokenPayload)
      })
    })

    if (decoded.type !== type) {
      logger.error('Token type mismatch', 'verifyToken', '', { expected: type, received: decoded.type })
      throw new Error('Invalid token type')
    }

    const securityContext = getSecurityContext(req)

    if (decoded.ip !== securityContext.ip) {
      logger.error('IP mismatch', 'verifyToken', '', { expected: securityContext.ip, received: decoded.ip })
      throw new Error('IP address mismatch')
    }

    return decoded
  } catch (error) {
    logger.error(`Error verifying ${type} token`, 'verifyToken', '', { error })
    throw new ErrorWithStatus({
      message: AUTH_MESSAGES.INVALID_TOKEN,
      status: httpStatusCode.UNAUTHORIZED
    })
  }
}

export const verifyAccessToken = async (token: string, req: Request): Promise<TokenPayload> => {
  return verifyToken({ token, type: TokenType.AccessToken, req })
}

export const verifyRefreshToken = async (token: string, req: Request): Promise<TokenPayload> => {
  return verifyToken({ token, type: TokenType.RefreshToken, req })
}

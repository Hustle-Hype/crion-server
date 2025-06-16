import jwt from 'jsonwebtoken'
import { TokenType, Token } from '~/models/schemas/token.schema'
import { envConfig } from '~/config/config'
import { TokenPayload } from '~/models/requests/token.request'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { logger } from '~/loggers/my-logger.log'
import { ObjectId } from 'mongodb'
import { generateJti, getSecurityContext, generateFingerprint } from './security.utils'
import { Request } from 'express'
import databaseServices from '~/services/database.services'

interface SignTokenOptions {
  issuerId: ObjectId
  accountId?: ObjectId
  type: TokenType
  scope?: string[]
  req: Request
}

const getTokenExpiration = (type: TokenType): number => {
  const expiresIn = type === TokenType.AccessToken ? envConfig.accessTokenExpiresIn : envConfig.refreshTokenExpiresIn
  return typeof expiresIn === 'number' ? expiresIn : parseInt(expiresIn)
}

export const signToken = async ({ issuerId, accountId, type, scope, req }: SignTokenOptions): Promise<string> => {
  const now = Math.floor(Date.now() / 1000) // Current time in seconds
  const securityContext = getSecurityContext(req)
  const fingerprint = generateFingerprint(req)
  const expiresIn = getTokenExpiration(type)

  const payload: TokenPayload = {
    // Identity
    issuerId,
    accountId,
    type,

    // Standard JWT fields
    iat: now,
    exp: now + expiresIn,
    jti: generateJti(),
    iss: envConfig.appName,
    sub: issuerId.toString(),

    // Security context
    ...securityContext,
    fingerprint,

    // Authorization
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
        if (err) reject(err)
        else resolve(token as string)
      }
    )
  })

  // Store refresh token in database
  if (type === TokenType.RefreshToken) {
    const tokenDoc = new Token({
      token,
      type,
      issuerId,
      accountId,
      expiresAt: new Date((now + expiresIn) * 1000), // Convert seconds to milliseconds
      ipAddress: securityContext.ip,
      fingerprint,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000)
    })

    await databaseServices.tokens.insertOne(tokenDoc)
  }

  return token
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
        if (err) reject(err)
        else resolve(decoded as TokenPayload)
      })
    })

    // Validate token type
    if (decoded.type !== type) {
      logger.error('Token type mismatch', 'verifyToken', '', { expected: type, received: decoded.type })
      throw new Error('Invalid token type')
    }

    // Validate security context
    const securityContext = getSecurityContext(req)
    const currentFingerprint = generateFingerprint(req)

    if (decoded.ip !== securityContext.ip) {
      logger.error('IP mismatch', 'verifyToken', '', { expected: securityContext.ip, received: decoded.ip })
      throw new Error('IP address mismatch')
    }

    if (decoded.fingerprint !== currentFingerprint) {
      logger.error('Fingerprint mismatch', 'verifyToken', '', {
        expected: currentFingerprint,
        received: decoded.fingerprint
      })
      throw new Error('Device fingerprint mismatch')
    }

    // Additional checks for refresh tokens
    if (type === TokenType.RefreshToken) {
      const tokenDoc = await databaseServices.tokens.findOne({ token, type })
      if (!tokenDoc) {
        logger.error('Refresh token not found in database', 'verifyToken', '', { token })
        throw new Error('Token not found or has been revoked')
      }

      if (tokenDoc.expiresAt < new Date()) {
        await databaseServices.tokens.deleteOne({ _id: tokenDoc._id })
        logger.error('Refresh token expired', 'verifyToken', '', {
          token,
          expiresAt: tokenDoc.expiresAt
        })
        throw new Error('Token has expired')
      }

      if (tokenDoc.fingerprint !== currentFingerprint) {
        logger.error('Database fingerprint mismatch', 'verifyToken', '', {
          expected: currentFingerprint,
          stored: tokenDoc.fingerprint
        })
        throw new Error('Invalid token fingerprint')
      }
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

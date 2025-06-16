import { ObjectId } from 'mongodb'
import { TokenType } from '~/models/schemas/token.schema'

export interface TokenPayload {
  // Identity fields
  issuerId: ObjectId
  accountId?: ObjectId
  type: TokenType

  // Standard JWT fields
  iat: number // Issued at timestamp
  exp: number // Expiration timestamp
  jti: string // JWT unique identifier
  iss: string // Issuer (your app name)
  sub: string // Subject (user identifier)

  // Security context
  ip: string
  userAgent: string
  fingerprint: string
  deviceInfo: {
    browser?: string
    browserVersion?: string
    os?: string
    platform?: string
    device?: string
  }

  // Authorization
  scope?: string[] // Permission scopes if needed
}

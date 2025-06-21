import { TokenPayload } from '~/models/requests/token.request'
import { IIssuer } from './models/schemas/issuer.schema'
import { IAccount } from './models/schemas/account.schema'
import { ObjectId } from 'mongodb'
import { Request } from 'express'
import { TokenType } from './models/schemas/token.schema'

declare global {
  namespace Express {
    interface User {
      issuerId?: string
      issuer?: IIssuer
      account?: IAccount
      accessToken?: string
      refreshToken?: string
      _type?: 'authenticated_session'
      id: string
      provider: string
      emails?: Array<{ value: string }>
      displayName?: string
      username?: string
      profileUrl?: string
      photos?: Array<{ value: string }>
    }

    interface Request {
      decodedAuthorization?: TokenPayload
      decodedRefreshToken?: TokenPayload
      issuerId?: ObjectId
      decoded_authorization?: string
      decoded_refresh_token?: string
      decoded_email_verify_token?: string
      decoded_forgot_password_token?: string
      user?: any
      token_type?: TokenType
      token?: string
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    twitter_oauth_state?: {
      issuerId: string
      accessToken: string
    }
  }
}

export {}

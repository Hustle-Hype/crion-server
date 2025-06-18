import { TokenPayload } from '~/models/requests/token.request'
import { IIssuer } from './models/schemas/issuer.schema'
import { IAccount } from './models/schemas/account.schema'

declare global {
  namespace Express {
    interface User {
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
    }
  }
}

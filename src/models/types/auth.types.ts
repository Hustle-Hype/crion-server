import { ObjectId } from 'mongodb'
import { Request } from 'express'
import { TokenType } from '~/models/schemas/token.schema'
import { NetworkType } from '~/constants/enum'

export interface IssuerPayload {
  issuerId: ObjectId
  type: TokenType
  req: Request
}

export interface WalletLoginResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    address: string
    bio: string
    avatar: string
    stakedAmount: number
    score: number
    website: string
    walletLinks: { network: string; address: string }[]
    socialLinks: { provider: string; providerId: string }[]
  }
}

export interface NonceResponse {
  nonce: string
  message: string
}

export interface JWTSignature {
  signature: {
    jwtHeader: string
    ephemeralPublicKey: {
      publicKey: {
        key: {
          data: Record<string, number>
        }
      }
      variant: number
    }
    ephemeralSignature: {
      signature: {
        data: {
          data: Record<string, number>
        }
      }
    }
    expiryDateSecs: number
  }
  variant: number
}

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
    score: number
    avatar?: string
    bio?: string
    stakedAmount: number
    website?: string
    walletLinks: {
      network: NetworkType
      address: string
    }[]
    socialLinks: {
      provider: string
      providerId: string
    }[]
  }
}

export interface NonceResponse {
  nonce: string
  message: string
}

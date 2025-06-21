import { ObjectId } from 'mongodb'

export enum TokenType {
  AccessToken = 'access_token',
  RefreshToken = 'refresh_token'
}

export enum TokenStatus {
  Active = 'active',
  Revoked = 'revoked',
  Rotated = 'rotated'
}

export interface IToken {
  _id?: ObjectId
  token: string
  type: TokenType
  issuerId: ObjectId
  status: TokenStatus
  rotatedToToken?: string
  revokedAt?: Date
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  userAgent?: string
  ipAddress?: string
}

export interface CreateTokenData {
  token: string
  type: TokenType
  issuerId: ObjectId
  expiresAt: Date
  userAgent?: string
  ipAddress?: string
}

export const createToken = (data: CreateTokenData): IToken => ({
  token: data.token,
  type: data.type,
  issuerId: data.issuerId,
  status: TokenStatus.Active,
  expiresAt: data.expiresAt,
  createdAt: new Date(),
  updatedAt: new Date(),
  userAgent: data.userAgent,
  ipAddress: data.ipAddress
})

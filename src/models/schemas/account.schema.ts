import { ObjectId } from 'mongodb'
import { ProviderType } from '~/constants/enum'

export interface SocialAccountMetadata {
  email?: string
  username?: string
  displayName?: string
  profileUrl?: string
  avatarUrl?: string
  bio?: string
}

export interface IAccount {
  _id: ObjectId
  issuerId: ObjectId // Reference to the main issuer
  provider: Exclude<ProviderType, ProviderType.WALLET>
  providerAccountId: string
  isVerified: boolean
  verifiedAt?: Date
  metadata?: SocialAccountMetadata
  lastUsedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateAccountParams {
  provider: Exclude<ProviderType, ProviderType.WALLET>
  providerAccountId: string
  metadata?: SocialAccountMetadata
}

export function createAccount(issuerId: ObjectId, params: CreateAccountParams): Omit<IAccount, '_id'> {
  const now = new Date()

  return {
    issuerId,
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    isVerified: false,
    metadata: params.metadata,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now
  }
}

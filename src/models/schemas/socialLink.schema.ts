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

export interface ISocialLink {
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

export interface CreateSocialLinkParams {
  provider: Exclude<ProviderType, ProviderType.WALLET>
  providerAccountId: string
  metadata?: SocialAccountMetadata
}

export function createSocialLink(issuerId: ObjectId, params: CreateSocialLinkParams): Omit<ISocialLink, '_id'> {
  const now = new Date()

  return {
    issuerId,
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    isVerified: true,
    metadata: params.metadata,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now
  }
}

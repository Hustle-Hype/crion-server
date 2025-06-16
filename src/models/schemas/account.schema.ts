import { ObjectId } from 'mongodb'
import { NetworkType, ProviderType } from '~/constants/enum'

export type SocialAccountMetadata = {
  displayName?: string
  profileUrl?: string
}

export type WalletAccountMetadata = {
  chainId?: number
  ens?: string // Ethereum Name Service
}

export type AccountMetadata = SocialAccountMetadata | WalletAccountMetadata

export interface IAccount {
  _id: ObjectId
  issuerId: ObjectId // Reference to the main issuer
  provider: ProviderType
  providerAccountId: string // email for social, address for wallet
  network?: NetworkType // Only for wallet accounts
  isVerified: boolean
  verifiedAt?: Date
  metadata?: AccountMetadata
  lastUsedAt: Date // Track when the account was last used for login
  createdAt: Date
  updatedAt: Date
}

// Helper type for creating new accounts
export type AccountCreateParams =
  | {
      type: 'social'
      provider: Exclude<ProviderType, ProviderType.WALLET>
      providerAccountId: string
      metadata?: SocialAccountMetadata
    }
  | {
      type: 'wallet'
      address: string
      network: NetworkType
      metadata?: WalletAccountMetadata
    }

// Helper function to create account
export function createAccount(issuerId: ObjectId, params: AccountCreateParams): Omit<IAccount, '_id'> {
  const now = new Date()

  if (params.type === 'social') {
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

  return {
    issuerId,
    provider: ProviderType.WALLET,
    providerAccountId: params.address,
    network: params.network,
    isVerified: false,
    metadata: params.metadata,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now
  }
}

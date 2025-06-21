import { ObjectId } from 'mongodb'
import { BehaviorFlagType, IssuerStatus, KYCStatusType, NetworkType, ProviderType } from '~/constants/enum'

export interface SocialLinkSubDocument {
  provider: Exclude<ProviderType, ProviderType.WALLET>
  socialId: string
  email?: string
  username?: string
  displayName?: string
  profileUrl?: string
  avatarUrl?: string
  metadata?: Record<string, unknown>
  verifiedAt: Date
}

export interface WalletLinkSubDocument {
  network: NetworkType
  address: string
  verifiedAt: Date
  isPrimary: boolean
}

export interface KYCStatus {
  status: KYCStatusType
  provider?: string
  verifiedAt?: Date
  expiration?: Date
  metadata?: Record<string, unknown>
}

export interface BehaviorFlag {
  flagType: BehaviorFlagType
  severity: 1 | 2 | 3 | 4 | 5
  detectedAt: Date
  txReference: string
  details?: string
}

// Ban info group
export interface BanInfo {
  bannedBy: ObjectId
  bannedAt: Date
  reason?: string
  expiredAt?: Date
}

export interface IssuerMetadata {
  preferences?: {
    notifications?: boolean
    language?: string
    timezone?: string
  }
  customFields?: Record<string, unknown>
}

// Main IIssuer schema
export interface IIssuer {
  _id: ObjectId
  primaryWallet: string
  name: string
  bio: string
  avatar?: string
  stakedAmount: number
  website?: string
  socialLinks: SocialLinkSubDocument[]
  walletLinks: WalletLinkSubDocument[]
  kycStatus: KYCStatus
  behaviorFlags: BehaviorFlag[]
  verifiedAt?: Date
  status: IssuerStatus
  metadata?: IssuerMetadata
  banInfo?: BanInfo
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

// Helper function to create a new issuer
export function createIssuer(params: { primaryWallet: string; name?: string; avatar?: string }): Omit<IIssuer, '_id'> {
  const now = new Date()

  return {
    primaryWallet: params.primaryWallet,
    name: params.name || params.primaryWallet.slice(0, 6),
    bio: '',
    avatar: params.avatar,
    stakedAmount: 0,
    socialLinks: [],
    walletLinks: [
      {
        network: NetworkType.APTOS,
        address: params.primaryWallet,
        verifiedAt: now,
        isPrimary: true
      }
    ],
    kycStatus: {
      status: KYCStatusType.PENDING
    },
    behaviorFlags: [],
    status: IssuerStatus.ACTIVE,
    createdAt: now,
    updatedAt: now
  }
}

import { ObjectId } from 'mongodb'
import { BehaviorFlagType, IssuerStatus, KYCStatusType, NetworkType, ProviderType } from '~/constants/enum'

export interface SocialLinkSubDocument {
  provider: Exclude<ProviderType, ProviderType.WALLET>
  socialId: string
  verifiedAt: Date
}

export interface WalletLinkSubDocument {
  network: NetworkType
  address: string
  verifiedAt: Date
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
  name: string
  primaryEmail: string // Main email used for communication
  avatar?: string
  isEmailVerified: boolean
  bio?: string
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
export function createIssuer(params: { name: string; primaryEmail: string; avatar?: string }): Omit<IIssuer, '_id'> {
  const now = new Date()

  return {
    name: params.name,
    primaryEmail: params.primaryEmail,
    avatar: params.avatar,
    isEmailVerified: false,
    stakedAmount: 0,
    socialLinks: [],
    walletLinks: [],
    kycStatus: {
      status: KYCStatusType.PENDING
    },
    behaviorFlags: [],
    status: IssuerStatus.ACTIVE,
    createdAt: now,
    updatedAt: now
  }
}

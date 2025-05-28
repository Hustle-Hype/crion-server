import { ObjectId } from 'mongodb'

export interface IdentitySubDocument {
  provider: string // google, facebook, wallet, etc.
  id: string // googleId, socialId, address (depends on provider)
  email?: string // only for Google/Facebook
  network?: string // only for Wallet
  verifiedAt?: Date
  extra?: object // depends on provider, easy to extend
}

export interface SocialLinkSubDocument {
  provider: string // x, linkedin, telegram
  socialId: string
  verifiedAt: Date
}

export interface KYCStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  provider?: string
  verifiedAt?: Date
  expiration?: Date
  metadata?: object
}

export interface BehaviorFlag {
  flagType: string // e.g. 'spam', 'scam', 'malware', 'phishing', 'other'
  severity: number // 1-5
  detectedAt: Date
  txReference: string // e.g. transaction hash
}

// Ban info group
export interface BanInfo {
  bannedBy: ObjectId
  bannedAt: Date
  reason?: string
  expiredAt?: Date
}

// Main IIssuer schema
export interface IIssuer {
  _id: ObjectId
  name: string
  image?: string
  bio?: string
  identities: IdentitySubDocument[]
  stakedAmount: number
  website?: string
  socialLinks: SocialLinkSubDocument[]
  kycStatus: KYCStatus
  behaviorFlags: BehaviorFlag[]
  verifiedAt?: Date
  status: 'unverified' | 'verified' | 'banned'
  banInfo?: BanInfo
  createdAt: Date
  updatedAt: Date
}

type IssuerInitParams =
  | { type: 'google'; email: string; googleId: string }
  | { type: 'wallet'; wallet: { address: string; network: string } }

function createBaseIssuer(): Omit<Partial<IIssuer>, 'identities'> {
  return {
    name: '',
    image: '',
    bio: '',
    stakedAmount: 0,
    website: undefined,
    socialLinks: [],
    kycStatus: {
      status: 'pending',
      provider: '',
      verifiedAt: undefined,
      expiration: undefined,
      metadata: {}
    },
    behaviorFlags: [],
    verifiedAt: undefined,
    status: 'unverified',
    banInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export function createDefaultIssuerStructure(params: IssuerInitParams): Partial<IIssuer> {
  const base = createBaseIssuer()

  switch (params.type) {
    case 'google':
      return {
        ...base,
        identities: [
          {
            provider: 'google',
            id: params.googleId,
            email: params.email
          }
        ]
      }
    case 'wallet':
      return {
        ...base,
        identities: [
          {
            provider: 'wallet',
            id: params.wallet.address,
            network: params.wallet.network
          }
        ]
      }
  }
}

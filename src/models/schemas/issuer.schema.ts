import { ObjectId } from 'mongodb'

export interface WalletSubDocument {
  address: string
  network: string
  verifiedAt: Date
}

export interface SocialLinkSubDocument {
  provider: string // X, Fb, Tele, Discord, etc
  socialId: string
  verifiedAt: Date
}

export interface IIssuer {
  _id: ObjectId
  name: string
  email?: string
  googleId?: string
  //   facebookId?: string
  //   twitterId?: string
  //   telegramId?: string
  //   discordId?: string
  //   linkedinId?: string
  walletAddress: WalletSubDocument[]
  stakedAmount: number
  website?: string
  socialLinks: SocialLinkSubDocument[]
  kycStatus: 'pending' | 'approved' | 'rejected'
  verifiedAt?: Date
  status: 'unverified' | 'verified' | 'banned'
  isBanned?: Date
  bannedBy?: ObjectId // ref: Admin
  bannedAt?: Date
  banReason?: string
  createdAt: Date
  updatedAt: Date
}

type IssuerInitParams =
  | { type: 'google'; email: string; googleId: string }
  | { type: 'wallet'; wallet: WalletSubDocument }

export function createDefaultIssuerStructure(params: IssuerInitParams): Partial<IIssuer> {
  if (params.type === 'google') {
    return {
      name: '',
      email: params.email,
      googleId: params.googleId,
      walletAddress: [],
      stakedAmount: 0,
      website: undefined,
      socialLinks: [],
      kycStatus: 'pending',
      verifiedAt: undefined,
      status: 'unverified',
      isBanned: undefined,
      bannedBy: undefined,
      bannedAt: undefined,
      banReason: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } else {
    return {
      name: '',
      email: undefined,
      googleId: undefined,
      walletAddress: [params.wallet],
      stakedAmount: 0,
      website: undefined,
      socialLinks: [],
      kycStatus: 'pending',
      verifiedAt: undefined,
      status: 'unverified',
      isBanned: undefined,
      bannedBy: undefined,
      bannedAt: undefined,
      banReason: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
}

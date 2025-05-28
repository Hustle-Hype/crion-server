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

export const defaultIssuerStructure: Partial<IIssuer> = {
    name: '',
    email: undefined,
    walletAddress: [], // Sẽ được thêm khi user connect wallet
    stakedAmount: 0, // Chưa stake gì khi mới tạo
    website: undefined,
    socialLinks: [], // Chưa liên kết social nào khi mới tạo
    kycStatus: 'pending', // Chưa KYC khi mới tạo
    verifiedAt: undefined,
    status: 'unverified', // Chưa xác minh khi mới tạo
    isBanned: undefined,
    bannedBy: undefined,
    bannedAt: undefined,
    banReason: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
}

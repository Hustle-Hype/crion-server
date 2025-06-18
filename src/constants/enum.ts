export enum ProviderType {
  GOOGLE = 'google',
  X = 'x',
  LINKEDIN = 'linkedin',
  TELEGRAM = 'telegram',
  WALLET = 'wallet'
}

export enum NetworkType {
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  BSC = 'bsc',
  SOLANA = 'solana',
  APTOS = 'aptos'
}

export enum IssuerStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

export enum KYCStatusType {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export enum BehaviorFlagType {
  SPAM = 'spam',
  SCAM = 'scam',
  MALWARE = 'malware',
  PHISHING = 'phishing',
  OTHER = 'other'
}

export const BEHAVIOR_FLAG_SEVERITY = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 5
} as const

export enum UserVerificationStatus {
  Unverified = 'Unverified',
  EmailVerified = 'EmailVerified',
  PhoneVerified = 'PhoneVerified',
  FullyVerified = 'FullyVerified'
}

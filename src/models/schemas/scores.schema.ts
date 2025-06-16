import { ObjectId } from 'mongodb'

export interface IScoreSubDocument {
  staking: number
  walletBehavior: number
  launchHistory: number
  social: number
  kyc: number
}

export interface IScores {
  _id: ObjectId
  issuerId: ObjectId
  scores: IScoreSubDocument
  totalScore: number
  tier: 'new_issuer' | 'bronze' | 'silver' | 'gold' | 'platinum'
  createdAt: Date
  updatedAt: Date
}

export function createDefaultScoreStructure(issuerId: ObjectId): Partial<IScores> {
  return {
    issuerId,
    scores: {
      staking: 0,
      walletBehavior: 0,
      launchHistory: 0,
      social: 0,
      kyc: 0
    },
    totalScore: 0,
    tier: 'new_issuer',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

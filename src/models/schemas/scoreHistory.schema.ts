import { ObjectId } from 'mongodb'

export interface IScoreHistory {
  _id: ObjectId
  issuer: ObjectId // ref Issuer._id
  scores: {
    key: string // e.g. 'social:x', 'wallet', 'staking', 'kyc', 'behavior', 'launch
    raw: number // raw score (0–100)
    weighted: number // raw * weight
    sourceRef?: string // ref to source (if needed, e.g. socialId, stakingTx)
    note?: string // note for the score
  }[]
  totalScore: number // total weighted score
  badge: string // new_issuer / bronze / silver / gold / platinum
  recordedAt: Date // recorded at
  version: number // version to trace algorithm changes
  source: 'system' | 'manual' | 'import' | 'migration' // source of update
}

export const createDefaultScoreHistoryStructure = (params: IScoreHistory): IScoreHistory => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return {
    ...params,
    _id: new ObjectId(today.toISOString()),
    issuer: new ObjectId(params.issuer),
    recordedAt: new Date(),
    version: 1,
    source: 'system',
    totalScore: 0,
    badge: 'new_issuer'
  }
}

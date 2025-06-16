import { ObjectId } from 'mongodb'

export enum TokenType {
  AccessToken = 'AccessToken',
  RefreshToken = 'RefreshToken'
}

export interface IToken {
  _id?: ObjectId
  token: string
  type: TokenType
  issuerId: ObjectId
  accountId?: ObjectId
  expiresAt: Date
  ipAddress: string
  fingerprint: string
  createdAt?: Date
  updatedAt?: Date
}

export class Token implements IToken {
  _id?: ObjectId
  token: string
  type: TokenType
  issuerId: ObjectId
  accountId?: ObjectId
  expiresAt: Date
  ipAddress: string
  fingerprint: string
  createdAt?: Date
  updatedAt?: Date

  constructor({ token, type, issuerId, accountId, expiresAt, ipAddress, fingerprint, createdAt, updatedAt }: IToken) {
    this.token = token
    this.type = type
    this.issuerId = issuerId
    this.accountId = accountId
    this.expiresAt = expiresAt
    this.ipAddress = ipAddress
    this.fingerprint = fingerprint
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }
}

export const TokenModel = {
  collectionName: 'tokens',
  jsonSchema: {
    bsonType: 'object',
    required: ['token', 'type', 'expiresAt', 'fingerprint'],
    properties: {
      _id: { bsonType: 'objectId' },
      token: { bsonType: 'string' },
      type: { bsonType: 'string', enum: Object.values(TokenType) },
      issuerId: { bsonType: 'objectId' },
      accountId: { bsonType: 'objectId' },
      expiresAt: { bsonType: 'date' },
      ipAddress: { bsonType: 'string' },
      fingerprint: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  indexes: [
    { key: { token: 1 }, unique: true },
    { key: { type: 1 } },
    { key: { issuerId: 1 } },
    { key: { accountId: 1 } },
    { key: { expiresAt: 1 } },
    { key: { fingerprint: 1 } }
  ]
}

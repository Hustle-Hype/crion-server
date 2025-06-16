'use strict'

import { Collection, Db, MongoClient } from 'mongodb'
import { envConfig } from '~/config/config'
import { IAccount } from '~/models/schemas/account.schema'
import { IIssuer } from '~/models/schemas/issuer.schema'
import { IScoreHistory } from '~/models/schemas/scoreHistory.schema'
import { IScores } from '~/models/schemas/scores.schema'
import { IToken } from '~/models/schemas/token.schema'

const uri = `${envConfig.mongodbUri}`

class DatabaseServices {
  private client: MongoClient
  private db: Db

  public getClient() {
    return this.client
  }

  constructor() {
    this.client = new MongoClient(uri)
    this.db = this.client.db(envConfig.dbName)
  }

  async connect() {
    try {
      await this.client.connect()
      await this.db.command({ ping: 1 })
      console.log('Pinged your deployment. You successfully connected to MongoDB!')
    } catch (error) {
      console.log('Error connecting to the database', error)
      throw error
    }
  }

  get issuers(): Collection<IIssuer> {
    return this.db.collection(envConfig.dbIssuerCollection)
  }

  get scores(): Collection<IScores> {
    return this.db.collection(envConfig.dbScoresCollection)
  }

  get scoreHistories(): Collection<IScoreHistory> {
    return this.db.collection(envConfig.dbScoreHistoriesCollection)
  }

  get accounts(): Collection<IAccount> {
    return this.db.collection(envConfig.dbAccountCollection)
  }

  get tokens(): Collection<IToken> {
    return this.db.collection(envConfig.dbTokenCollection)
  }
}
const databaseServices = new DatabaseServices()
export default databaseServices

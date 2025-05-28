'use strict'

import { Collection, Db, MongoClient } from 'mongodb'
import { envConfig } from '~/config/config'
import { IIssuer } from '~/models/schemas/issuer.schema'
import { IScoreHistory } from '~/models/schemas/scoreHistory.schema'
import { IScores } from '~/models/schemas/scores.schema'

// Sử dụng MONGODB_URI từ biến môi trường nếu có
const uri =
  envConfig.mongodbUri ||
  `mongodb+srv://${envConfig.dbUsername}:${envConfig.dbPassword}@resumate.zodlwdf.mongodb.net/${envConfig.dbName}?retryWrites=true&w=majority&appName=${envConfig.appName}`

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
}
const databaseServices = new DatabaseServices()
export default databaseServices

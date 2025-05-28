import { ObjectId } from 'mongodb'
import databaseServices from './database.service'
import { scoreRewardConfig } from '~/constants/scores'

class ScoresService {
  async addSocialScore(issuerId: ObjectId) {
    const result = await databaseServices.scores.findOneAndUpdate(
      { issuerId },
      { $inc: { 'scores.social': scoreRewardConfig.social as number } },
      { returnDocument: 'after' }
    )

    // TODO: update social link in issuer schema
    // TODO: update total score
    // TODO: update tier
    // TODO: Return new score

    return result
  }
}

export default new ScoresService()

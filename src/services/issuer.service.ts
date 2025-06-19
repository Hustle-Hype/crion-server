import { ObjectId } from 'mongodb'
import { ProviderType } from '~/constants/enum'
import databaseServices from './database.services'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { logger } from '~/loggers/my-logger.log'
import scoresService from './scores.service'
import { createSocialLink, ISocialLink } from '~/models/schemas/socialLink.schema'

interface SocialProfile {
  id: string
  provider: string
  emails?: Array<{ value: string }>
  displayName?: string
  username?: string
  profileUrl?: string
  photos?: Array<{ value: string }>
}

class IssuerService {
  async linkSocialAccount(
    issuerId: ObjectId,
    profile: SocialProfile,
    provider: Exclude<ProviderType, ProviderType.WALLET>
  ): Promise<void> {
    const issuer = await databaseServices.issuers.findOne({ _id: issuerId })
    if (!issuer) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.USER_NOT_FOUND,
        status: httpStatusCode.NOT_FOUND
      })
    }

    const existingAccount = await databaseServices.socialLinks.findOne({
      provider,
      providerAccountId: profile.id
    })

    if (existingAccount) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.SOCIAL_ACCOUNT_ALREADY_LINKED,
        status: httpStatusCode.CONFLICT
      })
    }

    const newSocialLink = createSocialLink(issuerId, {
      provider,
      providerAccountId: profile.id,
      metadata: {
        email: profile.emails?.[0]?.value,
        username: profile.username,
        displayName: profile.displayName,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.photos?.[0]?.value
      }
    })

    const socialLink = {
      provider,
      socialId: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      verifiedAt: new Date(),
      score: 0 // Will be updated by scores service
    }

    await Promise.all([
      databaseServices.socialLinks.insertOne(newSocialLink as ISocialLink),
      databaseServices.issuers.updateOne(
        { _id: issuerId },
        {
          $push: { socialLinks: socialLink },
          $set: { updatedAt: new Date() }
        }
      )
    ])

    await scoresService.addSocialScore(issuerId, provider)
    await scoresService.calculateAndUpdateScores(issuerId)

    logger.info('Social account linked successfully', 'IssuerService.linkSocialAccount', '', {
      issuerId: issuerId.toString(),
      provider,
      socialId: profile.id
    })
  }

  async unlinkSocialAccount(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    const issuer = await databaseServices.issuers.findOne({ _id: issuerId })
    if (!issuer) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.USER_NOT_FOUND,
        status: httpStatusCode.NOT_FOUND
      })
    }

    await Promise.all([
      databaseServices.socialLinks.deleteOne({ issuerId, provider }),
      databaseServices.issuers.updateOne(
        { _id: issuerId },
        {
          $pull: { socialLinks: { provider } },
          $set: { updatedAt: new Date() }
        }
      )
    ])

    await scoresService.calculateAndUpdateScores(issuerId)

    logger.info('Social account unlinked successfully', 'IssuerService.unlinkSocialAccount', '', {
      issuerId: issuerId.toString(),
      provider
    })
  }
}

export default new IssuerService()

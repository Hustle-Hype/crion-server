import { ObjectId } from 'mongodb'
import { ProviderType } from '~/constants/enum'
import databaseServices from './database.services'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { logger } from '~/loggers/my-logger.log'
import scoresService from './scores.service'
import { createSocialLink, ISocialLink } from '~/models/schemas/socialLink.schema'
import { IIssuer } from '~/models/schemas/issuer.schema'

interface SocialProfile {
  id: string
  provider: string
  emails?: Array<{ value: string }>
  displayName?: string
  username?: string
  profileUrl?: string
  photos?: Array<{ value: string }>
}

interface UpdateProfileParams {
  name?: string
  bio?: string
  avatar?: string
  website?: string
  metadata?: {
    preferences?: {
      notifications?: boolean
      language?: string
      timezone?: string
    }
    customFields?: Record<string, unknown>
  }
}

class IssuerService {
  async linkSocialAccount(
    issuerId: ObjectId,
    profile: SocialProfile,
    provider: Exclude<ProviderType, ProviderType.WALLET>
  ): Promise<void> {
    try {
      console.log('Linking social account:', {
        issuerId: issuerId.toString(),
        provider,
        profileId: profile.id
      })

      const issuer = await databaseServices.issuers.findOne({ _id: issuerId })
      if (!issuer) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.USER_NOT_FOUND,
          status: httpStatusCode.NOT_FOUND
        })
      }

      // Check if this social account is already linked to any user
      const existingAccount = await databaseServices.socialLinks.findOne({
        provider,
        providerAccountId: profile.id
      })

      if (existingAccount) {
        if (existingAccount.issuerId.toString() === issuerId.toString()) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.SOCIAL_ACCOUNT_ALREADY_LINKED_TO_YOU,
            status: httpStatusCode.CONFLICT
          })
        } else {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.SOCIAL_ACCOUNT_ALREADY_LINKED_TO_OTHER,
            status: httpStatusCode.CONFLICT
          })
        }
      }

      // Check if user already has a link for this provider
      const existingProviderLink = await databaseServices.socialLinks.findOne({
        issuerId,
        provider
      })

      if (existingProviderLink) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.PROVIDER_ALREADY_LINKED,
          status: httpStatusCode.CONFLICT
        })
      }

      console.log('profile', profile)

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
        verifiedAt: new Date()
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

      logger.info('Social account linked successfully', 'IssuerService.linkSocialAccount', '', {
        issuerId: issuerId.toString(),
        provider,
        socialId: profile.id
      })
    } catch (error) {
      logger.error('Error linking social account', 'IssuerService.linkSocialAccount', '', {
        issuerId: issuerId.toString(),
        provider,
        profileId: profile.id,
        error
      })
      throw error
    }
  }

  async unlinkSocialAccount(issuerId: ObjectId, provider: Exclude<ProviderType, ProviderType.WALLET>): Promise<void> {
    const issuerIdObj = new ObjectId(issuerId)
    const issuer = await databaseServices.issuers.findOne({ _id: issuerIdObj })
    if (!issuer) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.USER_NOT_FOUND,
        status: httpStatusCode.NOT_FOUND
      })
    }

    await Promise.all([
      databaseServices.socialLinks.deleteOne({ issuerId: issuerIdObj, provider }),
      databaseServices.issuers.updateOne(
        { _id: issuerIdObj },
        {
          $pull: { socialLinks: { provider } },
          $set: { updatedAt: new Date() }
        }
      )
    ])

    await scoresService.removeSocialScore(issuerIdObj, provider)

    logger.info('Social account unlinked successfully', 'IssuerService.unlinkSocialAccount', '', {
      issuerId: issuerIdObj.toString(),
      provider
    })
  }

  async getProfile(issuerId: ObjectId): Promise<Partial<IIssuer> | null> {
    try {
      const issuer = await databaseServices.issuers.findOne(
        { _id: issuerId },
        {
          projection: {
            behaviorFlags: 0,
            status: 0,
            createdAt: 0,
            updatedAt: 0,
            lastLoginAt: 0,
            lastLoginIP: 0,
            lastLoginUserAgent: 0
          }
        }
      )
      if (!issuer) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.USER_NOT_FOUND,
          status: httpStatusCode.NOT_FOUND
        })
      }
      return issuer
    } catch (error) {
      logger.error('Error getting issuer profile', 'IssuerService.getProfile', '', {
        issuerId: issuerId.toString(),
        error
      })
      throw error
    }
  }

  async updateProfile(issuerId: ObjectId, updateData: UpdateProfileParams): Promise<void> {
    try {
      const issuer = await databaseServices.issuers.findOne({ _id: issuerId })
      if (!issuer) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.USER_NOT_FOUND,
          status: httpStatusCode.NOT_FOUND
        })
      }

      const updateFields: Record<string, any> = {
        ...updateData,
        updatedAt: new Date()
      }

      await databaseServices.issuers.updateOne({ _id: issuerId }, { $set: updateFields })

      logger.info('Profile updated successfully', 'IssuerService.updateProfile', '', {
        issuerId: issuerId.toString(),
        updateFields
      })
    } catch (error) {
      logger.error('Error updating issuer profile', 'IssuerService.updateProfile', '', {
        issuerId: issuerId.toString(),
        error
      })
      throw error
    }
  }

  async getScoreHistory(issuerId: ObjectId) {
    try {
      const scoreHistory = await databaseServices.scoreHistories.find({ issuerId }).toArray()
      return scoreHistory
    } catch (error) {
      logger.error('Error getting score history', 'IssuerService.getScoreHistory', '', {
        issuerId: issuerId.toString(),
        error
      })
      throw error
    }
  }

  async getWalletLinks(issuerId: ObjectId) {
    try {
      const issuer = await this.getProfile(issuerId)
      return issuer?.walletLinks || []
    } catch (error) {
      logger.error('Error getting wallet links', 'IssuerService.getWalletLinks', '', {
        issuerId: issuerId.toString(),
        error
      })
      throw error
    }
  }

  async getSocialLinks(issuerId: ObjectId) {
    try {
      const issuer = await this.getProfile(issuerId)
      return issuer?.socialLinks || []
    } catch (error) {
      logger.error('Error getting social links', 'IssuerService.getSocialLinks', '', {
        issuerId: issuerId.toString(),
        error
      })
      throw error
    }
  }
}

export default new IssuerService()

import { ObjectId } from 'mongodb'
import { TokenType } from '~/models/schemas/token.schema'
import { IIssuer } from '~/models/schemas/issuer.schema'
import { IAccount, createAccount } from '~/models/schemas/account.schema'
import { ProviderType } from '~/constants/enum'
import databaseServices from './database.services'
import { createIssuer } from '~/models/schemas/issuer.schema'
import scoresService from './scores.service'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { signToken, verifyToken } from '~/utils/jwt.utils'
import { Request } from 'express'
import { envConfig } from '~/config/config'
import {
  DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  MAX_REFRESH_TOKEN_EXPIRES_IN
} from '~/constants/token'
import { logger } from '~/loggers/my-logger.log'

type SocialProvider = Extract<
  ProviderType,
  ProviderType.GOOGLE | ProviderType.X | ProviderType.LINKEDIN | ProviderType.TELEGRAM
>

export interface AuthResult {
  issuer: IIssuer
  account: IAccount
  accessToken: string
  refreshToken: string
}

class AuthService {
  private getAccessTokenExpiresIn(): number {
    const configValue = envConfig.accessTokenExpiresIn
    if (typeof configValue === 'string') {
      const parsed = parseInt(configValue)
      return isNaN(parsed) ? DEFAULT_ACCESS_TOKEN_EXPIRES_IN : parsed
    }
    return configValue || DEFAULT_ACCESS_TOKEN_EXPIRES_IN
  }

  private getRefreshTokenExpiresIn(): number {
    const configValue = envConfig.refreshTokenExpiresIn
    if (typeof configValue === 'string') {
      const parsed = parseInt(configValue)
      return isNaN(parsed) ? DEFAULT_REFRESH_TOKEN_EXPIRES_IN : Math.min(parsed, MAX_REFRESH_TOKEN_EXPIRES_IN)
    }
    return configValue ? Math.min(configValue, MAX_REFRESH_TOKEN_EXPIRES_IN) : DEFAULT_REFRESH_TOKEN_EXPIRES_IN
  }

  private async updateSocialScore(issuerId: ObjectId) {
    await scoresService.calculateAndUpdateScores(issuerId)
  }

  private async findOrCreateIssuerAndAccount(
    profile: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    provider: SocialProvider
  ): Promise<{ issuer: IIssuer; account: IAccount; isNew: boolean }> {
    const existingAccount = await databaseServices.accounts.findOne({
      provider,
      providerAccountId: profile.id
    })

    if (existingAccount) {
      const issuer = await databaseServices.issuers.findOne({ _id: existingAccount.issuerId })
      return { issuer: issuer as IIssuer, account: existingAccount, isNew: false }
    }

    const email = profile.emails?.[0]?.value
    let issuer = null

    if (email) {
      logger.info('Searching for issuer by email', 'AuthService.findOrCreateIssuerAndAccount', '', { email })
      issuer = await databaseServices.issuers.findOne({ primaryEmail: email })
    }

    if (!issuer) {
      const newIssuer = createIssuer({
        name: profile.displayName || profile.username || 'Anonymous',
        primaryEmail: email || `${profile.id}@${provider.toLowerCase()}.generated`,
        avatar: profile.photos?.[0]?.value
      })

      logger.info('Creating new issuer', 'AuthService.findOrCreateIssuerAndAccount', '', {
        name: newIssuer.name,
        email: newIssuer.primaryEmail,
        provider
      })

      const result = await databaseServices.issuers.insertOne(newIssuer as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      issuer = { ...newIssuer, _id: result.insertedId } as IIssuer

      await this.updateSocialScore(issuer._id)
    }

    const newAccount = createAccount(issuer._id, {
      type: 'social',
      provider,
      providerAccountId: profile.id,
      metadata: {
        displayName: profile.displayName,
        profileUrl: profile.profileUrl
      }
    })

    logger.info('Creating new social account', 'AuthService.findOrCreateIssuerAndAccount', '', {
      provider,
      providerAccountId: profile.id,
      issuerId: issuer._id.toString()
    })

    const accountResult = await databaseServices.accounts.insertOne(newAccount as IAccount)
    const account = { ...newAccount, _id: accountResult.insertedId } as IAccount

    return { issuer, account, isNew: true }
  }

  async handleSocialLogin(
    profile: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    provider: SocialProvider,
    req: Request
  ): Promise<AuthResult> {
    const { issuer, account } = await this.findOrCreateIssuerAndAccount(profile, provider)

    console.log('profile', profile)

    const accessToken = await signToken({
      issuerId: issuer._id,
      accountId: account._id,
      type: TokenType.AccessToken,
      req
    })

    const refreshToken = await signToken({
      issuerId: issuer._id,
      accountId: account._id,
      type: TokenType.RefreshToken,
      req
    })

    await databaseServices.issuers.updateOne({ _id: issuer._id }, { $set: { lastLoginAt: new Date() } })

    return {
      issuer,
      account,
      accessToken,
      refreshToken
    }
  }

  async refreshToken(refreshToken: string, req: Request): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = await verifyToken({ token: refreshToken, type: TokenType.RefreshToken, req })

      // Generate new tokens
      const newAccessToken = await signToken({
        issuerId: decoded.issuerId,
        accountId: decoded.accountId,
        type: TokenType.AccessToken,
        req
      })

      const newRefreshToken = await signToken({
        issuerId: decoded.issuerId,
        accountId: decoded.accountId,
        type: TokenType.RefreshToken,
        req
      })

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    } catch (error) {
      logger.error('Error refreshing token', 'AuthService.refreshToken', '', { error })
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.INVALID_TOKEN,
        status: httpStatusCode.UNAUTHORIZED
      })
    }
  }

  async logout(refreshToken: string): Promise<void> {
    // Find and delete the refresh token
    const result = await databaseServices.tokens.deleteOne({
      token: refreshToken,
      type: TokenType.RefreshToken
    })

    if (!result.deletedCount) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.TOKEN_NOT_FOUND,
        status: httpStatusCode.NOT_FOUND
      })
    }
  }
}

export default new AuthService()

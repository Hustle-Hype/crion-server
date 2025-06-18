import { ObjectId } from 'mongodb'
import { TokenType, TokenStatus, createToken } from '~/models/schemas/token.schema'
import { IIssuer } from '~/models/schemas/issuer.schema'
import { ProviderType } from '~/constants/enum'
import databaseServices from './database.services'
import { createIssuer } from '~/models/schemas/issuer.schema'
import { ErrorWithStatus } from '~/utils/error.utils'
import { httpStatusCode } from '~/core/httpStatusCode'
import { AUTH_MESSAGES } from '~/constants/messages'
import { signToken } from '~/utils/jwt.utils'
import { Request } from 'express'
import { logger } from '~/loggers/my-logger.log'
import { WalletLoginResponse, NonceResponse } from '~/models/types/auth.types'
import { ethers } from 'ethers'
import scoresService from './scores.service'
import { envConfig } from '~/config/config'
import { WalletLoginRequest, AptosSignature } from '~/models/requests/login.request'
import { logAuthEvent } from '~/loggers/auth.logger'
import { Aptos, Network, AptosConfig, Ed25519PublicKey, Ed25519Signature } from '@aptos-labs/ts-sdk'
import { createSocialLink, ISocialLink } from '~/models/schemas/socialLink.schema'
import { createDefaultScoreStructure, IScores } from '~/models/schemas/scores.schema'

interface JWTSignature {
  signature: {
    jwtHeader: string
    ephemeralPublicKey: {
      publicKey: {
        key: {
          data: Record<string, number>
        }
      }
      variant: number
    }
    ephemeralSignature: {
      signature: {
        data: {
          data: Record<string, number>
        }
      }
    }
    expiryDateSecs: number
  }
  variant: number
}

type SocialProvider = Extract<
  ProviderType,
  ProviderType.GOOGLE | ProviderType.X | ProviderType.LINKEDIN | ProviderType.TELEGRAM
>

export interface AuthResult {
  issuer: IIssuer
  account: ISocialLink
  accessToken: string
  refreshToken: string
}

interface NonceData {
  nonce: string
  timestamp: number
}

class AuthService {
  private nonceMap = new Map<string, NonceData>()
  private readonly NONCE_EXPIRY = 5 * 60 * 1000 // 5 minutes in milliseconds
  private readonly aptosClient: Aptos

  constructor() {
    setInterval(() => this.cleanupExpiredNonces(), 60 * 1000)
    const config = new AptosConfig({ network: Network.MAINNET })
    this.aptosClient = new Aptos(config)
  }

  private cleanupExpiredNonces() {
    const now = Date.now()
    for (const [address, data] of this.nonceMap.entries()) {
      if (now - data.timestamp > this.NONCE_EXPIRY) {
        this.nonceMap.delete(address)
      }
    }
  }

  private async updateSocialScore(issuerId: ObjectId) {
    await scoresService.calculateAndUpdateScores(issuerId)
  }

  private async findOrCreateIssuerAndAccount(
    profile: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    provider: SocialProvider
  ): Promise<{ issuer: IIssuer; account: ISocialLink; isNew: boolean }> {
    const existingAccount = await databaseServices.socialLinks.findOne({
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
        primaryWallet: profile.id,
        avatar: profile.photos?.[0]?.value
      })

      logger.info('Creating new issuer', 'AuthService.findOrCreateIssuerAndAccount', '', {
        name: newIssuer.name,
        primaryWallet: newIssuer.primaryWallet,
        provider
      })

      const result = await databaseServices.issuers.insertOne(newIssuer as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      issuer = { ...newIssuer, _id: result.insertedId } as IIssuer

      await this.updateSocialScore(issuer._id)
    }

    const newAccount = createSocialLink(issuer._id, {
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

    const accountResult = await databaseServices.socialLinks.insertOne(newAccount as ISocialLink)
    const account = { ...newAccount, _id: accountResult.insertedId } as ISocialLink

    return { issuer, account, isNew: true }
  }

  async handleSocialLogin(
    profile: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    provider: SocialProvider,
    req: Request
  ): Promise<AuthResult> {
    const { issuer, account } = await this.findOrCreateIssuerAndAccount(profile, provider)

    const accessToken = await signToken({
      issuerId: issuer._id,
      type: TokenType.AccessToken,
      req
    })

    const refreshToken = await signToken({
      issuerId: issuer._id,
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

  private async saveToken(
    token: string,
    type: TokenType,
    issuerId: ObjectId,
    expiresAt: Date,
    req: Request
  ): Promise<void> {
    const tokenDoc = createToken({
      token,
      type,
      issuerId,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })

    await databaseServices.tokens.insertOne(tokenDoc)
  }

  public async revokeToken(token: string, type: TokenType): Promise<void> {
    const tokenDoc = await databaseServices.tokens.findOne({ token, type, status: TokenStatus.Active })
    if (!tokenDoc) {
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.TOKEN_NOT_FOUND,
        status: httpStatusCode.NOT_FOUND
      })
    }

    await this.revokeTokenById(tokenDoc._id)
    logAuthEvent({
      userId: tokenDoc.issuerId.toString(),
      event: 'token_revoked',
      metadata: { token, type }
    })
  }

  private async revokeTokenById(tokenId: ObjectId): Promise<void> {
    await databaseServices.tokens.updateOne(
      { _id: tokenId },
      {
        $set: {
          status: TokenStatus.Revoked,
          revokedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )
  }

  private async rotateToken(oldToken: string, newToken: string): Promise<void> {
    await databaseServices.tokens.updateOne(
      { token: oldToken },
      {
        $set: {
          status: TokenStatus.Rotated,
          rotatedToToken: newToken,
          updatedAt: new Date()
        }
      }
    )
  }

  async revokeAllUserTokens(issuerId: ObjectId): Promise<void> {
    const now = new Date()
    const result = await databaseServices.tokens.updateMany(
      {
        issuerId: new ObjectId(issuerId.toString()),
        status: TokenStatus.Active
      },
      {
        $set: {
          status: TokenStatus.Revoked,
          revokedAt: now,
          updatedAt: now
        }
      }
    )

    logAuthEvent({
      userId: issuerId.toString(),
      event: 'all_tokens_revoked',
      metadata: { revokedCount: result.modifiedCount }
    })
  }

  private async generateTokens(issuerId: ObjectId, req: Request): Promise<[string, string]> {
    const [accessToken, refreshToken] = await Promise.all([
      signToken({
        issuerId,
        type: TokenType.AccessToken,
        req
      }),
      signToken({
        issuerId,
        type: TokenType.RefreshToken,
        req
      })
    ])

    return [accessToken, refreshToken]
  }

  private async revokeAllActiveTokens(issuerId: ObjectId): Promise<void> {
    const now = new Date()
    await databaseServices.tokens.updateMany(
      {
        issuerId,
        status: TokenStatus.Active
      },
      {
        $set: {
          status: TokenStatus.Revoked,
          revokedAt: now,
          updatedAt: now
        }
      }
    )
  }

  async refreshToken(oldRefreshToken: string, req: Request): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenDoc = await databaseServices.tokens.findOne({
      token: oldRefreshToken,
      type: TokenType.RefreshToken,
      status: TokenStatus.Active
    })

    if (!tokenDoc) {
      logAuthEvent({
        event: 'token_refresh',
        error: 'Invalid refresh token'
      })
      throw new ErrorWithStatus({
        message: AUTH_MESSAGES.USED_REFRESH_TOKEN_OR_NOT_EXIST,
        status: httpStatusCode.UNAUTHORIZED
      })
    }

    const [newAccessToken, newRefreshToken] = await this.generateTokens(tokenDoc.issuerId, req)

    await this.rotateToken(oldRefreshToken, newRefreshToken)

    logAuthEvent({
      userId: tokenDoc.issuerId.toString(),
      event: 'token_refresh',
      metadata: { oldToken: oldRefreshToken }
    })

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenDoc = await databaseServices.tokens.findOne({
      token: refreshToken,
      type: TokenType.RefreshToken,
      status: TokenStatus.Active
    })

    if (tokenDoc) {
      await this.revokeToken(refreshToken, TokenType.RefreshToken)
      logAuthEvent({
        userId: tokenDoc.issuerId.toString(),
        event: 'logout'
      })
    }
  }

  private generateSignMessage(nonce: string, address: string): string {
    if (address.startsWith('0x')) {
      const message = {
        nonce: nonce,
        address: address,
        timestamp: Date.now(),
        domain: new URL(envConfig.clientUrl).hostname
      }
      return JSON.stringify(message)
    }

    return `Welcome to ${envConfig.appName}!\n\nPlease sign this message to verify your wallet ownership.\n\nNonce: ${nonce}\nWallet: ${address}\n\nThis signature will not trigger any blockchain transaction or cost any gas fees.`
  }

  async generateNonce(address: string): Promise<NonceResponse> {
    const nonce = ethers.hexlify(ethers.randomBytes(32))
    const normalizedAddress = address.toLowerCase()
    const timestamp = Date.now()

    this.nonceMap.set(normalizedAddress, {
      nonce,
      timestamp
    })

    const message = this.generateSignMessage(nonce, address)
    return { nonce, message }
  }

  private async verifyAptosSignature(address: string, signature: AptosSignature): Promise<boolean> {
    try {
      logger.info('Starting signature verification', 'AuthService.verifyAptosSignature', '', {
        address,
        publicKey: signature.publicKey,
        signatureLength: signature.signature.length,
        message: signature.message,
        fullMessage: signature.fullMessage
      })

      const pubKey = new Ed25519PublicKey(signature.publicKey)

      const signatureObj = new Ed25519Signature(signature.signature)

      const messageBytes = new TextEncoder().encode(signature.fullMessage)

      logger.info('Verifying signature', 'AuthService.verifyAptosSignature', '', {
        messageBytes: Array.from(messageBytes),
        signatureHex: signature.signature,
        fullMessage: signature.fullMessage
      })

      const isValid = pubKey.verifySignature({
        message: messageBytes,
        signature: signatureObj
      })

      if (!isValid) {
        logger.error('Signature verification failed', 'AuthService.verifyAptosSignature', '', {
          message: signature.message,
          fullMessage: signature.fullMessage,
          signatureHex: signature.signature,
          publicKey: signature.publicKey
        })
        return false
      }

      logger.info('Signature verified successfully', 'AuthService.verifyAptosSignature')
      return true
    } catch (error) {
      logger.error('Error verifying Aptos signature', 'AuthService.verifyAptosSignature', '', {
        error,
        signature: JSON.stringify(signature, null, 2)
      })
      return false
    }
  }

  private bufferFromData(data: Record<string, number>): Buffer {
    const arr = new Uint8Array(Object.values(data))
    return Buffer.from(arr)
  }

  private async verifyJWTSignature(signature: JWTSignature, message: string): Promise<boolean> {
    try {
      const headerObj = JSON.parse(signature.signature.jwtHeader)
      if (headerObj.alg !== 'RS256') {
        logger.error('Unsupported JWT algorithm', 'AuthService.verifyJWTSignature', '', {
          algorithm: headerObj.alg
        })
        return false
      }

      const publicKeyData = signature.signature.ephemeralPublicKey?.publicKey?.key?.data || {}
      const publicKeyBytes = Object.values(publicKeyData)

      const signatureData = signature.signature.ephemeralSignature?.signature?.data?.data || {}
      const signatureBytes = Object.values(signatureData)

      if (!publicKeyBytes.length || !signatureBytes.length) {
        logger.error('Missing required signature components', 'AuthService.verifyJWTSignature', '', {
          hasPublicKey: !!publicKeyBytes.length,
          hasSignature: !!signatureBytes.length
        })
        return false
      }

      const now = Math.floor(Date.now() / 1000)
      const isValid = signature.signature.expiryDateSecs > now

      return isValid
    } catch (error) {
      logger.error('Error in JWT signature verification', 'AuthService.verifyJWTSignature', '', {
        error
      })
      return false
    }
  }

  private async verifySignature(
    address: string,
    signature: string | Omit<AptosSignature, 'nonce'> | JWTSignature,
    message: string
  ): Promise<boolean> {
    try {
      if (typeof signature === 'object' && 'signature' in signature && signature.signature?.jwtHeader) {
        return this.verifyJWTSignature(signature as JWTSignature, message)
      }

      if (typeof signature === 'object' && 'prefix' in signature && signature.prefix === 'APTOS') {
        return this.verifyAptosSignature(address, { ...signature, nonce: JSON.parse(message).nonce })
      }

      if (typeof signature === 'string') {
        const signerAddress = ethers.verifyMessage(message, signature)
        const isValid = signerAddress.toLowerCase() === address.toLowerCase()
        return isValid
      }

      return false
    } catch (error) {
      logger.error('Error verifying signature', 'AuthService.verifySignature', '', {
        error
      })
      return false
    }
  }

  private async findOrCreateIssuer(address: string): Promise<{ issuer: IIssuer; score: number }> {
    const normalizedAddress = address.toLowerCase()
    let issuer = await databaseServices.issuers.findOne({ primaryWallet: normalizedAddress })

    if (!issuer) {
      const newIssuer = createIssuer({ primaryWallet: normalizedAddress })
      const result = await databaseServices.issuers.insertOne(newIssuer as IIssuer)
      issuer = { ...newIssuer, _id: result.insertedId }

      await databaseServices.scores.insertOne(createDefaultScoreStructure(issuer._id) as IScores)
    }

    const score = await databaseServices.scores.findOne({ issuerId: issuer._id })

    return {
      issuer,
      score: score?.totalScore || 0
    }
  }

  async handleWalletLogin(data: WalletLoginRequest, req: Request): Promise<WalletLoginResponse> {
    const { address, signature, message } = data
    const normalizedAddress = address.toLowerCase()

    try {
      // For Aptos, we validate the message content first
      try {
        const parsedMessage = JSON.parse(message)
        const now = Date.now()

        // Validate nonce
        const storedNonceData = this.nonceMap.get(normalizedAddress)
        if (!storedNonceData || storedNonceData.nonce !== parsedMessage.nonce) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.INVALID_SIGNATURE,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        // Validate timestamp
        if (Math.abs(now - parsedMessage.timestamp) > this.NONCE_EXPIRY) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.NONCE_EXPIRED,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        // Validate domain
        const expectedDomain = new URL(envConfig.clientUrl).hostname
        if (parsedMessage.domain !== expectedDomain) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.INVALID_SIGNATURE,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        // Verify signature
        const isValidSignature = await this.verifySignature(address, signature, message)
        if (!isValidSignature) {
          throw new ErrorWithStatus({
            message: AUTH_MESSAGES.INVALID_SIGNATURE,
            status: httpStatusCode.UNAUTHORIZED
          })
        }

        // Clean up nonce after successful validation
        this.nonceMap.delete(normalizedAddress)

        const { issuer, score } = await this.findOrCreateIssuer(normalizedAddress)

        // Revoke all active tokens before generating new ones
        await this.revokeAllActiveTokens(issuer._id)

        // Generate new tokens
        const [accessToken, refreshToken] = await this.generateTokens(issuer._id, req)

        // Update last login time
        await databaseServices.issuers.updateOne(
          { _id: issuer._id },
          {
            $set: {
              lastLoginAt: new Date(),
              lastLoginIP: req.ip,
              lastLoginUserAgent: req.headers['user-agent']
            }
          }
        )

        return {
          accessToken,
          refreshToken,
          user: {
            id: issuer._id.toString(),
            address: normalizedAddress,
            bio: issuer.bio || '',
            avatar: issuer.avatar || '',
            stakedAmount: issuer.stakedAmount,
            score: score,
            website: issuer.website || '',
            walletLinks: issuer.walletLinks.map((link) => ({
              network: link.network,
              address: link.address
            })),
            socialLinks: issuer.socialLinks.map((link) => ({
              provider: link.provider,
              providerId: link.socialId
            }))
          }
        }
      } catch (error) {
        if (error instanceof ErrorWithStatus) {
          throw error
        }
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.INVALID_SIGNATURE,
          status: httpStatusCode.UNAUTHORIZED
        })
      }
    } catch (error) {
      if (!(error instanceof ErrorWithStatus)) {
        logger.error('Error in handleWalletLogin', 'AuthService.handleWalletLogin', '', {
          error,
          signature: JSON.stringify(signature, null, 2)
        })
      }
      throw error
    }
  }
}

export default new AuthService()

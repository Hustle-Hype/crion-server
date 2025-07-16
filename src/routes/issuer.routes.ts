import { Router } from 'express'
import issuerController from '~/controllers/issuer.controller'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { accessTokenValidation, checkSocialLinkStatus } from '~/middlewares/auth.middlewares'
import { validateSchema } from '~/middlewares/validation.middlewares'
import { UpdateProfileRequestSchema, GetScoreByPrimaryWalletRequestSchema } from '~/models/requests/issuer.request'

const issuerRouter = Router()

// Profile endpoints
issuerRouter.get('/me', accessTokenValidation, wrapRequestHandler(issuerController.getProfile))
issuerRouter.patch(
  '/me',
  accessTokenValidation,
  validateSchema(UpdateProfileRequestSchema),
  wrapRequestHandler(issuerController.updateProfile)
)
issuerRouter.get('/me/score-history', accessTokenValidation, wrapRequestHandler(issuerController.getScoreHistory))
issuerRouter.get('/me/wallet-links', accessTokenValidation, wrapRequestHandler(issuerController.getWalletLinks))
issuerRouter.get('/me/social-links', accessTokenValidation, wrapRequestHandler(issuerController.getSocialLinks))

// Social link URLs
issuerRouter.get(
  '/me/link/google',
  accessTokenValidation,
  checkSocialLinkStatus,
  wrapRequestHandler(issuerController.handleGoogleLink)
)
issuerRouter.get(
  '/me/link/twitter',
  accessTokenValidation,
  checkSocialLinkStatus,
  wrapRequestHandler(issuerController.handleTwitterLink)
)
issuerRouter.get(
  '/me/link/github',
  accessTokenValidation,
  checkSocialLinkStatus,
  wrapRequestHandler(issuerController.handleGithubLink)
)

// Social link callbacks
issuerRouter.get('/me/link/google/callback', wrapRequestHandler(issuerController.handleGoogleCallback))
issuerRouter.get('/me/link/twitter/callback', wrapRequestHandler(issuerController.handleTwitterCallback))
issuerRouter.get('/me/link/github/callback', wrapRequestHandler(issuerController.handleGithubCallback))

// Unlink endpoint
issuerRouter.post(
  '/me/unlink/:provider',
  accessTokenValidation,
  wrapRequestHandler(issuerController.handleSocialUnlink)
)

// Public endpoints
issuerRouter.get(
  '/score/:primaryWallet',
  validateSchema(GetScoreByPrimaryWalletRequestSchema),
  wrapRequestHandler(issuerController.getScoreByPrimaryWallet)
)

export default issuerRouter

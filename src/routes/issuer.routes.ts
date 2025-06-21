import { Router } from 'express'
import issuerController from '~/controllers/issuer.controller'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { accessTokenValidation, checkSocialLinkStatus } from '~/middlewares/auth.middlewares'

const issuerRouter = Router()

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

export default issuerRouter

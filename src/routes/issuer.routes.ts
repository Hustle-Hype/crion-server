import { Router } from 'express'
import passport from 'passport'
import issuerController from '~/controllers/issuer.controller'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { accessTokenValidation } from '~/middlewares/auth.middlewares'

const issuerRouter = Router()

issuerRouter.get(
  '/me/link/google',
  // accessTokenValidation,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
)

issuerRouter.get(
  '/me/link/google/callback',
  accessTokenValidation,
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/'
  }),
  issuerController.handleSocialLinkCallback
)

issuerRouter.get(
  '/me/link/twitter',
  accessTokenValidation,
  passport.authenticate('twitter', {
    session: false
  })
)

issuerRouter.get(
  '/me/link/twitter/callback',
  accessTokenValidation,
  passport.authenticate('twitter', {
    session: false,
    failureRedirect: '/'
  }),
  issuerController.handleSocialLinkCallback
)

// Unlink social account
issuerRouter.post(
  '/me/unlink/:provider',
  accessTokenValidation,
  wrapRequestHandler(issuerController.handleSocialUnlink)
)

export default issuerRouter

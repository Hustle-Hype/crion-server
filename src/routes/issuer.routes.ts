import { Router } from 'express'
import passport from 'passport'
import issuerController from '~/controllers/issuer.controller'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import { accessTokenValidation } from '~/middlewares/auth.middlewares'

const issuerRouter = Router()

issuerRouter.get(
  '/me/link/google',
  accessTokenValidation, // bắt buộc user đã login ví
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
)

issuerRouter.get(
  '/me/link/google/callback',
  accessTokenValidation, // vẫn cần xác thực lại, phòng trường hợp callback bị abuse
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/profile' // hoặc báo lỗi frontend
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
  passport.authenticate('twitter', {
    session: false,
    failureRedirect: '/profile'
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

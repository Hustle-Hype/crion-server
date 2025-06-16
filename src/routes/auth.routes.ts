import { Router } from 'express'
import passport from 'passport'
import authController from '~/controllers/auth.controller'

const authRouter = Router()

// Social login routes
authRouter.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
)

authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login'
  }),
  authController.handleSocialLoginCallback
)

// Twitter OAuth routes
authRouter.get(
  '/twitter',
  passport.authenticate('twitter', {
    session: false
  })
)

authRouter.get(
  '/twitter/callback',
  passport.authenticate('twitter', {
    session: false,
    failureRedirect: '/login'
  }),
  authController.handleSocialLoginCallback
)

// Refresh token route
authRouter.post('/refresh-token', authController.handleRefreshToken)

// Logout route
authRouter.post('/logout', authController.handleLogout)

export default authRouter

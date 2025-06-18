import { Router } from 'express'
import authController from '~/controllers/auth.controller'
import { wrapRequestHandler } from '~/utils/wrapHandler'
import {
  accessTokenValidation,
  nonceValidation,
  refreshTokenValidation,
  walletLoginValidation
} from '~/middlewares/auth.middlewares'

const authRouter = Router()

authRouter.get('/nonce', nonceValidation, wrapRequestHandler(authController.handleNonce))

authRouter.post('/wallet-login', walletLoginValidation, wrapRequestHandler(authController.handleWalletLogin))

authRouter.post('/refresh-token', refreshTokenValidation, wrapRequestHandler(authController.handleRefreshToken))

authRouter.post(
  '/logout',
  accessTokenValidation,
  refreshTokenValidation,
  wrapRequestHandler(authController.handleLogout)
)

authRouter.post('/revoke-all-tokens', accessTokenValidation, wrapRequestHandler(authController.handleRevokeAllTokens))

export default authRouter

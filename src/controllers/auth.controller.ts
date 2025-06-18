import { Request, Response } from 'express'
import { AUTH_MESSAGES } from '~/constants/messages'
import authService from '~/services/auth.service'
import { OK } from '~/core/succes.response'
import { TokenPayload } from '~/models/requests/token.request'

class AuthController {
  async handleNonce(req: Request, res: Response) {
    const { wallet_address } = req.query

    const nonce = await authService.generateNonce(wallet_address as string)

    new OK({
      message: AUTH_MESSAGES.NONCE_GENERATED,
      data: nonce
    }).send(res)
  }

  async handleWalletLogin(req: Request, res: Response) {
    const result = await authService.handleWalletLogin(req.body, req)
    new OK({
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: result
    }).send(res)
  }

  async handleRefreshToken(req: Request, res: Response) {
    const result = await authService.refreshToken(req.body.refreshToken, req)
    new OK({
      message: AUTH_MESSAGES.REFRESH_TOKEN_SUCCESS,
      data: result
    }).send(res)
  }

  async handleLogout(req: Request, res: Response) {
    const result = await authService.logout(req.body.refreshToken)
    new OK({
      message: AUTH_MESSAGES.LOGOUT_SUCCESS,
      data: result
    }).send(res)
  }

  async handleRevokeAllTokens(req: Request, res: Response) {
    const { issuerId } = req.decodedAuthorization as TokenPayload
    await authService.revokeAllUserTokens(issuerId)
    new OK({
      message: AUTH_MESSAGES.ALL_TOKENS_REVOKED_SUCCESS
    }).send(res)
  }

  // async handleGoogleCallback(req: Request, res: Response) {
  //   const result = await authService.handleGoogleCallback(req)
  //   res.redirect(`${envConfig.clientUrl}/auth/callback?token=${result.accessToken}`)
  // }

  // async handleTwitterCallback(req: Request, res: Response) {
  //   const result = await authService.handleTwitterCallback(req)
  //   res.redirect(`${envConfig.clientUrl}/auth/callback?token=${result.accessToken}`)
  // }
}

export default new AuthController()

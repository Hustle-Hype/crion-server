import { Request, Response, NextFunction } from 'express'
import { httpStatusCode } from '~/core/httpStatusCode'
import { ErrorWithStatus } from '~/utils/error.utils'
import { AUTH_MESSAGES } from '~/constants/messages'
import issuerService from '~/services/issuer.service'
import { ObjectId } from 'mongodb'
import { ProviderType } from '~/constants/enum'
import { envConfig } from '~/config/config'
import passport from '~/config/passport'
import { TokenPayload } from '~/models/requests/token.request'
import { OK } from '~/core/succes.response'
import { UpdateProfileRequest } from '~/models/requests/issuer.request'

class IssuerController {
  private generateState = (issuerId: string, accessToken: string): string => {
    return Buffer.from(
      JSON.stringify({
        issuerId,
        accessToken,
        timestamp: Date.now()
      })
    ).toString('base64')
  }

  private getRedirectUrl = (provider: string): string => {
    const isDev = process.env.NODE_ENV === 'development'
    switch (provider) {
      case 'google':
        return isDev ? envConfig.googleCallbackURLDev : envConfig.googleCallbackURLProd
      case 'twitter':
        return isDev ? envConfig.twitterCallbackURLDev : envConfig.twitterCallbackURLProd
      case 'github':
        return isDev ? envConfig.githubCallbackURLDev : envConfig.githubCallbackURLProd
      default:
        throw new Error('Invalid provider')
    }
  }

  private getFrontendUrl = (): string[] => {
    return process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:8080']
      : [process.env.FRONTEND_URL || 'https://basic-login-rose.vercel.app']
  }

  handleGoogleLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const accessToken = req.headers.authorization?.split(' ')[1]
      if (!accessToken) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const state = this.generateState(decodedAuthorization.issuerId.toString(), accessToken)
      const redirectUrl = this.getRedirectUrl('google')

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${envConfig.googleClientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('profile email')}&` +
        `state=${state}&` +
        `access_type=offline&` +
        `prompt=consent`

      res.redirect(authUrl)
    } catch (error) {
      next(error)
    }
  }

  handleTwitterLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const accessToken = req.headers.authorization?.split(' ')[1]
      if (!accessToken) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      // Store state in session instead of passing it as a parameter
      req.session.twitter_oauth_state = {
        issuerId: decodedAuthorization.issuerId.toString(),
        accessToken
      }

      passport.authenticate('twitter', {
        session: false
      })(req, res, next)
    } catch (error) {
      next(error)
    }
  }

  handleGithubLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const accessToken = req.headers.authorization?.split(' ')[1]
      if (!accessToken) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const state = this.generateState(decodedAuthorization.issuerId.toString(), accessToken)

      passport.authenticate('github', {
        scope: ['read:user', 'user:email'],
        state,
        session: false
      } as any)(req, res, next)
    } catch (error) {
      next(error)
    }
  }

  private handleSocialCallback = async (
    req: Request,
    res: Response,
    provider: Exclude<ProviderType, ProviderType.WALLET>
  ) => {
    return new Promise<void>((resolve, reject) => {
      passport.authenticate(provider, { session: false }, async (err: Error | null, profile: any) => {
        try {
          if (err || !profile) {
            throw new ErrorWithStatus({
              message: err?.message || AUTH_MESSAGES.UNAUTHORIZED,
              status: httpStatusCode.UNAUTHORIZED
            })
          }

          await issuerService.linkSocialAccount(new ObjectId(profile.issuerId), profile, provider)

          const frontendUrls = this.getFrontendUrl()
          const allowedOrigins = frontendUrls.map((url) => JSON.stringify(url)).join(',')

          res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Linking Account...</title>
                <script>
                  (function() {
                    const allowedOrigins = [${allowedOrigins}];
                    const maxAttempts = 5;
                    let attempts = 0;
                    
                    function sendMessage() {
                      if (window.opener) {
                        const message = { 
                          success: true,
                          provider: '${provider}',
                          message: 'Account linked successfully'
                        };
                        console.log('Attempt', attempts + 1, 'Sending message:', message);
                        
                        allowedOrigins.forEach(origin => {
                          try {
                            window.opener.postMessage(message, JSON.parse(origin));
                            console.log('Message sent to:', origin);
                          } catch (e) {
                            console.log('Failed to post to origin:', origin, e);
                          }
                        });

                        attempts++;
                        if (attempts < maxAttempts) {
                          setTimeout(sendMessage, 500);
                        } else {
                          setTimeout(() => window.close(), 1000);
                        }
                      } else {
                        console.log('No opener window found');
                        if (attempts < maxAttempts) {
                          attempts++;
                          setTimeout(sendMessage, 500);
                        } else {
                          setTimeout(() => window.close(), 1000);
                        }
                      }
                    }

                    sendMessage();
                    document.addEventListener('DOMContentLoaded', sendMessage);
                  })();
                </script>
              </head>
              <body>
                <p>Account linked successfully. This window will close automatically.</p>
                <p id="status">Completing link process...</p>
              </body>
            </html>
          `)

          resolve()
        } catch (error) {
          console.error('Social callback error:', {
            provider,
            error,
            query: req.query
          })
          reject(error)
        }
      })(req, res, () => {})
    })
  }

  handleGoogleCallback = async (req: Request, res: Response) => {
    try {
      await this.handleSocialCallback(req, res, ProviderType.GOOGLE)
    } catch (error) {
      console.error('Google callback error:', error)
      const frontendUrls = this.getFrontendUrl()
      const allowedOrigins = frontendUrls.map((url) => JSON.stringify(url)).join(',')

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error Linking Account</title>
            <script>
              const allowedOrigins = [${allowedOrigins}];
              try {
                if (window.opener) {
                  const errorMessage = ${JSON.stringify(error instanceof Error ? error.message : 'An error occurred')};
                  console.error('Linking error:', errorMessage);
                  
                  allowedOrigins.forEach(origin => {
                    try {
                      window.opener.postMessage(
                        { 
                          success: false,
                          provider: 'google',
                          error: errorMessage
                        },
                        JSON.parse(origin)
                      );
                    } catch (e) {
                      console.log('Failed to post to origin:', origin, e);
                    }
                  });
                }
              } catch (err) {
                console.error('Error in error handler:', err);
              } finally {
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </head>
          <body>
            <p>Error linking account. This window will close automatically.</p>
            <p id="error-details" style="color: red;">${error instanceof Error ? error.message : 'An error occurred'}</p>
          </body>
        </html>
      `)
    }
  }

  handleTwitterCallback = async (req: Request, res: Response) => {
    try {
      await this.handleSocialCallback(req, res, ProviderType.X)
    } catch (error) {
      console.error('Twitter callback error:', error)
      const frontendUrls = this.getFrontendUrl()
      const allowedOrigins = frontendUrls.map((url) => JSON.stringify(url)).join(',')

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error Linking Account</title>
            <script>
              const allowedOrigins = [${allowedOrigins}];
              try {
                if (window.opener) {
                  const errorMessage = ${JSON.stringify(error instanceof Error ? error.message : 'An error occurred')};
                  console.error('Linking error:', errorMessage);
                  
                  allowedOrigins.forEach(origin => {
                    try {
                      window.opener.postMessage(
                        { 
                          success: false,
                          provider: 'twitter',
                          error: errorMessage
                        },
                        JSON.parse(origin)
                      );
                    } catch (e) {
                      console.log('Failed to post to origin:', origin, e);
                    }
                  });
                }
              } catch (err) {
                console.error('Error in error handler:', err);
              } finally {
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </head>
          <body>
            <p>Error linking account. This window will close automatically.</p>
            <p id="error-details" style="color: red;">${error instanceof Error ? error.message : 'An error occurred'}</p>
          </body>
        </html>
      `)
    }
  }

  handleGithubCallback = async (req: Request, res: Response) => {
    try {
      await this.handleSocialCallback(req, res, ProviderType.GITHUB)
    } catch (error) {
      console.error('Github callback error:', error)
      const frontendUrls = this.getFrontendUrl()
      const allowedOrigins = frontendUrls.map((url) => JSON.stringify(url)).join(',')

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error Linking Account</title>
            <script>
              const allowedOrigins = [${allowedOrigins}];
              try {
                if (window.opener) {
                  const errorMessage = ${JSON.stringify(error instanceof Error ? error.message : 'An error occurred')};
                  console.error('Linking error:', errorMessage);
                  
                  allowedOrigins.forEach(origin => {
                    try {
                      window.opener.postMessage(
                        { 
                          success: false,
                          provider: 'github',
                          error: errorMessage
                        },
                        JSON.parse(origin)
                      );
                    } catch (e) {
                      console.log('Failed to post to origin:', origin, e);
                    }
                  });
                }
              } catch (err) {
                console.error('Error in error handler:', err);
              } finally {
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </head>
          <body>
            <p>Error linking account. This window will close automatically.</p>
            <p id="error-details" style="color: red;">${error instanceof Error ? error.message : 'An error occurred'}</p>
          </body>
        </html>
      `)
    }
  }

  handleSocialUnlink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { issuerId } = req.decodedAuthorization as TokenPayload
      const { provider } = req.params

      if (!Object.values(ProviderType).includes(provider as ProviderType)) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.INVALID_PROVIDER,
          status: httpStatusCode.BAD_REQUEST
        })
      }

      await issuerService.unlinkSocialAccount(issuerId, provider as Exclude<ProviderType, ProviderType.WALLET>)

      new OK({
        message: AUTH_MESSAGES.UNLINK_SUCCESS
      }).send(res)
    } catch (error) {
      next(error)
    }
  }

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const issuer = await issuerService.getProfile(new ObjectId(decodedAuthorization.issuerId))
      new OK({
        message: 'Get profile successfully',
        data: issuer
      }).send(res)
    } catch (error) {
      next(error)
    }
  }

  updateProfile = async (req: Request<any, any, UpdateProfileRequest>, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      await issuerService.updateProfile(new ObjectId(decodedAuthorization.issuerId), req.body)
      new OK({
        message: 'Update profile successfully'
      }).send(res)
    } catch (error) {
      next(error)
    }
  }

  getScoreHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const scoreHistory = await issuerService.getScoreHistory(new ObjectId(decodedAuthorization.issuerId))
      new OK({
        message: 'Get score history successfully',
        data: scoreHistory
      }).send(res)
    } catch (error) {
      next(error)
    }
  }

  getWalletLinks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const walletLinks = await issuerService.getWalletLinks(new ObjectId(decodedAuthorization.issuerId))
      new OK({
        message: 'Get wallet links successfully',
        data: walletLinks
      }).send(res)
    } catch (error) {
      next(error)
    }
  }

  getSocialLinks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedAuthorization } = req
      if (!decodedAuthorization?.issuerId) {
        throw new ErrorWithStatus({
          message: AUTH_MESSAGES.UNAUTHORIZED,
          status: httpStatusCode.UNAUTHORIZED
        })
      }

      const socialLinks = await issuerService.getSocialLinks(new ObjectId(decodedAuthorization.issuerId))
      new OK({
        message: 'Get social links successfully',
        data: socialLinks
      }).send(res)
    } catch (error) {
      next(error)
    }
  }
}

export default new IssuerController()

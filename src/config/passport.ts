import googleStrategy from './passport/google'
import { twitterStrategy } from './passport/twitter'
import { PassportStatic } from 'passport'

export const passportConfig = (passport: PassportStatic): void => {
  // use these strategies
  passport.use('google', googleStrategy)
  passport.use(twitterStrategy)
}

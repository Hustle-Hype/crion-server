import passport from 'passport'
import { googleStrategy } from './passport/google'
import { twitterStrategy } from './passport/twitter'
// import { githubStrategy } from './passport/github'

// Initialize passport strategies
passport.use(googleStrategy)
passport.use(twitterStrategy)
// passport.use(githubStrategy)

export default passport

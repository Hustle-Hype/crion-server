import { Router } from 'express'
import authRouter from '~/routes/auth.routes'
import issuerRouter from '~/routes/issuer.routes'
import accountRouter from '~/routes/account.routes'

const rootRouterV1 = Router()
rootRouterV1.get('/helpers', (req, res) => {
  console.log('Hello World')
  res.status(200).send({ message: 'Welcome to Express & TypeScript Server' })
})

const defaultRoutes = [
  {
    path: '/auth',
    route: authRouter
  },
  {
    path: '/issuer',
    route: issuerRouter
  },
  {
    path: '/account',
    route: accountRouter
  }
  // {
  //   path: '/admin',
  //   route: adminRoute
  // }
]

defaultRoutes.forEach((route) => {
  rootRouterV1.use(route.path, route.route)
})

export default rootRouterV1

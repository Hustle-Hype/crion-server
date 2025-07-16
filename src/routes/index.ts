import { Router } from 'express'
import authRouter from '~/routes/auth.routes'
import issuerRouter from '~/routes/issuer.routes'

const rootRouterV1 = Router()
rootRouterV1.get('/healthz', (req, res) => {
  res.status(200).send({ message: 'Welcome to Crio API' })
})

const defaultRoutes = [
  {
    path: '/auth',
    route: authRouter
  },
  {
    path: '/issuer',
    route: issuerRouter
  }
]

defaultRoutes.forEach((route) => {
  rootRouterV1.use(route.path, route.route)
})

export default rootRouterV1

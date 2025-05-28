import { Router } from 'express'
import issuerRouter from '~/routes/issuer.routes'

const rootRouterV1 = Router()
rootRouterV1.get('/helpers', (req, res) => {
  console.log('Hello World')
  res.status(200).send({ message: 'Welcome to Express & TypeScript Server' })
})

rootRouterV1.use('/issuer', issuerRouter)

export default rootRouterV1

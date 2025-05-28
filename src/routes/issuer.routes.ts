import { Router } from 'express'

const issuerRouter = Router()

issuerRouter.get('/', (req, res) => {
  res.send('Hello World')
})

export default issuerRouter

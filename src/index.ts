import express, { Application } from 'express'
import http from 'http'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cors from 'cors'
import passport from 'passport'
import session from 'express-session'
import databaseServices from './services/database.services'
import { defaultErrorHandler } from '~/middlewares/error.middlewares'
import { NOT_FOUND } from '~/core/error.response'
import rootRouterV1 from './routes'
import { logger } from './loggers/my-logger.log'
import { envConfig } from './config/config'
import { passportConfig } from './config/passport'

// Khởi tạo ứng dụng Express
const app: Application = express()
const server = http.createServer(app)

// init middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "'data:'"]
      }
    }
  })
)

app.use(compression())
app.use(morgan('dev'))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Add session support (needed for OAuth 1.0a)
app.use(
  session({
    secret: envConfig.sessionSecret || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60000 // 1 minute, just enough for OAuth handshake
    }
  })
)

// Initialize Passport
app.use(passport.initialize())

// Configure Passport strategies
passportConfig(passport)

// Kết nối database
databaseServices.connect()

// init route
app.use('/api/v1', rootRouterV1)

app.use((req, res) => {
  new NOT_FOUND({
    message: 'The requested resource was not found',
    data: {
      path: req.originalUrl,
      method: req.method
    }
  }).send(res)
})

app.use(defaultErrorHandler)

server.listen(envConfig.port, async () => {
  logger.info(`Server is running on port ${envConfig.port}`)
  console.log(`Server is Fire at http://localhost:${envConfig.port}`)
})

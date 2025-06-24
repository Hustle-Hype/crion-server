import express, { Application } from 'express'
import http from 'http'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cors from 'cors'
import session from 'express-session'
import { defaultErrorHandler } from '~/middlewares/error.middlewares'
import { NOT_FOUND } from '~/core/error.response'
import rootRouterV1 from './routes'
import { logger } from './loggers/my-logger.log'
import { envConfig } from './config/config'
import passport from './config/passport'
import databaseServices from './services/database.services'

// Khởi tạo ứng dụng Express
const app: Application = express()

app.set('trust proxy', 1)

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

// Get allowed origins from environment
const allowedOrigins = ['http://localhost:3000', 'https://basic-login-rose.vercel.app']
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
        return callback(new Error(msg), false)
      }
      return callback(null, true)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400 // 24 hours
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Add session support (needed for OAuth 1.0a)
app.use(
  session({
    secret: envConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60000, // 1 minute, just enough for OAuth handshake
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  })
)

// Initialize Passport
app.use(passport.initialize())

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

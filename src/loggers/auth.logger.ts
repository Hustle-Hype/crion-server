import winston from 'winston'
import path from 'path'

const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/auth-error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/auth.log')
    })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  authLogger.add(
    new winston.transports.Console({
      format: winston.format.simple()
    })
  )
}

export interface AuthLogData {
  userId?: string
  address?: string
  event:
    | 'login_success'
    | 'login_failure'
    | 'token_refresh'
    | 'logout'
    | 'failed_attempt'
    | 'token_revoked'
    | 'all_tokens_revoked'
  error?: string
  metadata?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const logAuthEvent = (data: AuthLogData) => {
  const logLevel = data.event.includes('failure') || data.event === 'failed_attempt' ? 'error' : 'info'
  authLogger.log(logLevel, data.event, {
    userId: data.userId,
    address: data.address,
    error: data.error,
    metadata: data.metadata,
    timestamp: new Date().toISOString()
  })
}

export default authLogger

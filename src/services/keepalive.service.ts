import { logger } from '~/loggers/my-logger.log'

class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null
  private readonly intervalTime = 1 * 60 * 1000 // 10 minutes (before 15-minute sleep)
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`
  }

  start(): void {
    if (process.env.NODE_ENV !== 'production' || !process.env.RENDER_EXTERNAL_URL) {
      logger.info('Keep-alive service skipped (not in production on Render)')
      return
    }

    this.intervalId = setInterval(() => {
      this.ping()
    }, this.intervalTime)

    logger.info(`Keep-alive service started, pinging every ${this.intervalTime / 1000 / 60} minutes`)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('Keep-alive service stopped')
    }
  }

  private async ping(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Keep-Alive-Service'
        }
      })

      if (response.ok) {
        logger.info('Keep-alive ping successful')
      } else {
        logger.warn(`Keep-alive ping failed with status: ${response.status}`)
      }
    } catch (error) {
      logger.error('Keep-alive ping failed:', error instanceof Error ? error.message : String(error))
    }
  }
}

export default new KeepAliveService()

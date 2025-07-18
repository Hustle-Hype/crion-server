import { logger } from '~/loggers/my-logger.log'
import databaseServices from './database.services'

class WarmupService {
  async warmup(): Promise<void> {
    logger.info('Starting application warmup...')

    try {
      await this.warmupDatabase()

      // Warm up other services if needed
      // await this.warmupCache()
      // await this.warmupExternalAPIs()

      logger.info('Application warmup completed successfully')
    } catch (error) {
      logger.error('Application warmup failed:', error instanceof Error ? error.message : String(error))
    }
  }

  private async warmupDatabase(): Promise<void> {
    try {
      const client = databaseServices.getClient()
      const db = client.db()
      await db.admin().ping()
      logger.info('Database connection warmed up successfully')
    } catch (error) {
      logger.error('Database warmup error:', error instanceof Error ? error.message : String(error))
    }
  }

  // Example of other warmup methods you might need
  // private async warmupCache(): Promise<void> {
  //   // Warm up Redis or other cache
  // }

  // private async warmupExternalAPIs(): Promise<void> {
  //   // Pre-fetch important data from external APIs
  // }
}

export default new WarmupService()

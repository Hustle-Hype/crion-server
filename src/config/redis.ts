import { createClient } from 'redis'
import { envConfig } from './config'

const client = createClient({
  username: envConfig.redisUsername,
  password: envConfig.redisPassword,
  socket: {
    host: envConfig.redisHost,
    port: Number(envConfig.redisPort)
  }
})

client.on('error', (err: any) => console.log('Redis Client Error', err))

client.connect()

export default client

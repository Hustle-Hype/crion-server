import axios from 'axios'
import { envConfig } from './config'

const githubRequest = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${envConfig.githubAccessToken}`,
    Accept: 'application/vnd.github.v3+json'
  }
})

export default githubRequest

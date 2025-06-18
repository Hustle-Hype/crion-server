import { Request } from 'express'
import { randomUUID } from 'crypto'
import * as UAParser from 'ua-parser-js'

export interface SecurityContext {
  ip: string
  userAgent: string
  deviceInfo: {
    browser?: string
    browserVersion?: string
    os?: string
    platform?: string
    device?: string
  }
}

/**
 * Lấy địa chỉ IP thực của client, xử lý cả trường hợp qua proxy
 */
export function getClientIp(req: Request): string {
  // Thứ tự ưu tiên các header để lấy IP
  const ipHeaders = [
    'x-client-ip',
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'x-real-ip',
    'x-forwarded',
    'forwarded-for',
    'x-cluster-client-ip',
    'x-forwarded'
  ]

  for (const header of ipHeaders) {
    const value = req.headers[header] as string | undefined
    if (value) {
      // Lấy IP đầu tiên trong chuỗi (nếu có nhiều IP)
      const ip = value.split(',')[0].trim()
      if (ip) return ip
    }
  }

  // Fallback to connection remote address
  return req.socket.remoteAddress || '0.0.0.0'
}

/**
 * Parse thông tin từ User-Agent
 */
export function parseUserAgent(userAgent: string) {
  const parser = new UAParser.UAParser(userAgent)
  const result = parser.getResult()

  return {
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    platform: result.device.type || 'desktop',
    device: result.device.model || result.os.name
  }
}

/**
 * Generate JWT ID
 */
export function generateJti(): string {
  return randomUUID()
}

// /**
//  * Tạo browser fingerprint từ các thông tin của request
//  */
// export function generateFingerprint(req: Request): string {
//   const components = [
//     req.headers['user-agent'],
//     req.headers['accept-language'],
//     req.headers['sec-ch-ua'], // Browser info
//     req.headers['sec-ch-ua-platform'], // OS platform
//     req.headers['sec-ch-ua-mobile'], // Mobile indicator
//     getClientIp(req)
//   ]

//   // Tạo một chuỗi duy nhất từ các components
//   return Buffer.from(components.join('|')).toString('base64')
// }

/**
 * Lấy toàn bộ security context từ request
 */
export function getSecurityContext(req: Request): SecurityContext {
  const userAgent = req.headers['user-agent'] || 'unknown'

  return {
    ip: getClientIp(req),
    userAgent,
    deviceInfo: parseUserAgent(userAgent)
  }
}

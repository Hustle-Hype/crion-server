import { JWTSignature } from '../types/auth.types'

export interface AptosStandardSignature {
  data: {
    data: Record<string, number>
  }
}

export interface WalletLoginRequest {
  address: string
  signature: AptosStandardSignature | JWTSignature
  message: string
  publicKey?: string
}

export interface SignatureMessage {
  nonce: string
  address: string
  timestamp: number
  domain: string
}

export const MAX_SIGNATURE_AGE = 15 * 60 * 1000

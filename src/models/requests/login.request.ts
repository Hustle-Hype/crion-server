export interface AptosSignature {
  prefix: 'APTOS'
  publicKey: string
  signature: any // Using any temporarily to handle complex signature structure
  message: string
  fullMessage: string
  nonce?: string
}

// src/models/requests/login.request.ts
export interface WalletLoginRequest {
  address: string
  publicKey: string // Add this field
  signature: {
    prefix: 'APTOS'
    publicKey: string
    signature: string
    message: string
    fullMessage: string
  }
  message: string
  timestamp: number
}

export interface SignatureMessage {
  nonce: string
  address: string
  timestamp: number
  domain: string // Domain name for EIP-4361 compliance
}

// Maximum age of signature in milliseconds (15 minutes)
export const MAX_SIGNATURE_AGE = 15 * 60 * 1000 // 15 minutes in milliseconds

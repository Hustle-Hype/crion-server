export interface TokenPayload {
  userId: string
  email: string
  role?: string
  exp?: number
  iat?: number
}

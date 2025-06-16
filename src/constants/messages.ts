export const USER_MESSAGES = {
  VALIDATION_ERROR: 'Validation error'
} as const

export const AUTH_MESSAGES = {
  ACCESS_TOKEN_IS_REQUIRED: 'Access token is required',
  REFRESH_TOKEN_IS_REQUIRED: 'Refresh token is required',
  USED_REFRESH_TOKEN_OR_NOT_EXIST: 'Used refresh token or not exist',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INVALID_TOKEN: 'Invalid token',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  USER_NOT_FOUND: 'User not found',
  TOKEN_NOT_FOUND: 'Token not found',
  TOKEN_IS_EXPIRED: 'Token is expired',
  TOKEN_BLACKLIST_FAILED: 'Token blacklist failed',
  TOKEN_CREATION_FAILED: 'Token creation failed',
  REFRESH_TOKEN_SUCCESS: 'Refresh token successful'
} as const

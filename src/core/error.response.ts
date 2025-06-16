import { httpStatusCode, reasonPhrases } from '~/core/httpStatusCode'

interface ErrorResponseParams {
  message?: string
  statusCode?: number
  reasonStatusCode?: string
  data?: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

class ErrorResponse {
  message: string
  status: number
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor({ message, statusCode, reasonStatusCode, data = null }: ErrorResponseParams) {
    this.message = message || reasonStatusCode || 'Unknown error'
    this.status = statusCode || httpStatusCode.INTERNAL_SERVER_ERROR
    this.data = data
  }

  send(res: any, headers: Record<string, string> = {}) {
    res.status(this.status).send(this)
  }
}

const createErrorResponse = (statusCode: number, reasonStatusCode: string) => {
  return class extends ErrorResponse {
    constructor({ message, data }: { message?: string; data?: any }) {
      super({ message, statusCode, reasonStatusCode, data })
    }
  }
}

// Định nghĩa các lỗi HTTP cụ thể
const BAD_REQUEST = createErrorResponse(httpStatusCode.BAD_REQUEST, reasonPhrases.BAD_REQUEST)
const UNAUTHORIZED = createErrorResponse(httpStatusCode.UNAUTHORIZED, reasonPhrases.UNAUTHORIZED)
const NOT_FOUND = createErrorResponse(httpStatusCode.NOT_FOUND, reasonPhrases.NOT_FOUND)
const FORBIDDEN = createErrorResponse(httpStatusCode.FORBIDDEN, reasonPhrases.FORBIDDEN)
const INTERNAL_SERVER_ERROR = createErrorResponse(
  httpStatusCode.INTERNAL_SERVER_ERROR,
  reasonPhrases.INTERNAL_SERVER_ERROR
)
export { ErrorResponse, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, FORBIDDEN, INTERNAL_SERVER_ERROR }

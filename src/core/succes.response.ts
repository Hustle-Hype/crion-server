import { httpStatusCode, reasonPhrases } from '~/core/httpStatusCode'

interface SuccessResponseParams {
  message?: string
  statusCode?: number
  reasonStatusCode?: string
  data?: any
}

class SuccessResponse {
  message: string
  status: number
  data: any

  constructor({
    message,
    statusCode = httpStatusCode.OK,
    reasonStatusCode = reasonPhrases.OK,
    data
  }: SuccessResponseParams) {
    this.message = message || reasonStatusCode
    this.status = statusCode
    this.data = data
  }

  send(res: any, headers: Record<string, string> = {}) {
    res.status(this.status).send(this)
  }
}

interface OKParams {
  message?: string
  data?: any
}

class OK extends SuccessResponse {
  constructor({ message, data }: OKParams) {
    super({ message, data })
  }
}

interface CreatedParams {
  message?: string
  data?: any
}

class CREATED extends SuccessResponse {
  constructor({ message, data }: CreatedParams) {
    super({
      message,
      statusCode: httpStatusCode.CREATED,
      reasonStatusCode: reasonPhrases.CREATED,
      data
    })
  }
}

export { SuccessResponse, OK, CREATED }

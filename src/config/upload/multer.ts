import multer from 'multer'
import path from 'path'
import { Request } from 'express'
import { USER_MESSAGES } from '~/constants/messages'

const storage = multer.memoryStorage()

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // If no file is provided, skip validation
  if (!file || !file.originalname) {
    return cb(null, false)
  }

  // For avatar uploads, only allow image files
  const imageFileTypes = /jpeg|jpg|png|gif|webp|heic/
  const extname = imageFileTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = imageFileTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error(USER_MESSAGES.INVALID_AVATAR_FILE_TYPE))
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 20 } // 20 MB
})

export const uploadSingle = (fieldName: string) => upload.single(fieldName)
export const uploadMultiple = (fieldName: string, maxCount: number = 5) => upload.array(fieldName, maxCount)
export const uploadFields = (fields: { name: string; maxCount?: number }[]) => upload.fields(fields)

export default upload

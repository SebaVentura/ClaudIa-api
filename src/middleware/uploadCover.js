import fs from 'fs/promises'
import multer from 'multer'
import { COVER_EXTENSIONS, getProductUploadDir } from '../utils/uploadPaths.js'

export const COVER_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function removeExistingCovers(productDir) {
  await Promise.all(
    COVER_EXTENSIONS.map(async (ext) => {
      try {
        await fs.unlink(`${productDir}/cover.${ext}`)
      } catch {
        // ignorar si no existe
      }
    }),
  )
}

export const uploadCover = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const productDir = getProductUploadDir(req.params.id)
        await fs.mkdir(productDir, { recursive: true })
        await removeExistingCovers(productDir)
        cb(null, productDir)
      } catch (err) {
        cb(err)
      }
    },
    filename: (_req, file, cb) => {
      const ext = COVER_MIME_TO_EXT[file.mimetype]
      cb(null, `cover.${ext}`)
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (COVER_MIME_TO_EXT[file.mimetype]) {
      cb(null, true)
      return
    }
    cb(new Error('Tipo de archivo no permitido. Usar JPEG, PNG o WebP.'))
  },
}).single('file')

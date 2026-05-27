import fs from 'fs/promises'
import multer from 'multer'
import {
  GALLERY_EXTENSIONS,
  getProductUploadDir,
  parseGallerySlot,
} from '../utils/uploadPaths.js'
import { COVER_MIME_TO_EXT } from './uploadCover.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024

async function removeExistingGallerySlot(productDir, slot) {
  await Promise.all(
    GALLERY_EXTENSIONS.map(async (ext) => {
      try {
        await fs.unlink(`${productDir}/gallery-${slot}.${ext}`)
      } catch {
        // ignorar si no existe
      }
    }),
  )
}

export const uploadGallery = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const slot = parseGallerySlot(req.params.slot)
        const productDir = getProductUploadDir(req.params.id)
        await fs.mkdir(productDir, { recursive: true })
        await removeExistingGallerySlot(productDir, slot)
        cb(null, productDir)
      } catch (err) {
        cb(err)
      }
    },
    filename: (req, file, cb) => {
      try {
        const slot = parseGallerySlot(req.params.slot)
        const ext = COVER_MIME_TO_EXT[file.mimetype]
        cb(null, `gallery-${slot}.${ext}`)
      } catch (err) {
        cb(err)
      }
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

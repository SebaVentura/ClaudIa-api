import { Router } from 'express'
import multer from 'multer'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { uploadCover } from '../../middleware/uploadCover.js'
import { uploadProductCover } from '../../services/productImagesService.js'
import { ProductsServiceError, getProductById } from '../../services/productsService.js'
import { assertValidProductId } from '../../utils/uploadPaths.js'

const router = Router()

router.use(requireAdmin)

function handleMulterError(err, res) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ detail: 'La imagen supera el tamaño máximo de 5MB' })
      return true
    }
    res.status(400).json({ detail: err.message })
    return true
  }
  if (err?.message?.includes('Tipo de archivo') || err?.message?.includes('inválid')) {
    res.status(400).json({ detail: err.message })
    return true
  }
  return false
}

router.post('/:id/images/cover', async (req, res) => {
  try {
    assertValidProductId(req.params.id)
    await getProductById(req.params.id)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    return res.status(400).json({ detail: err.message })
  }

  uploadCover(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (handleMulterError(uploadErr, res)) return
      console.error('Unexpected cover upload error:', uploadErr)
      return res.status(500).json({ detail: 'Error al subir la portada' })
    }

    try {
      const product = await uploadProductCover(req.params.id, req.file)
      res.json(product)
    } catch (err) {
      if (err instanceof ProductsServiceError) {
        return res.status(err.statusCode).json({ detail: err.message })
      }
      console.error('Unexpected cover save error:', err)
      res.status(500).json({ detail: 'Error al guardar la portada' })
    }
  })
})

export default router

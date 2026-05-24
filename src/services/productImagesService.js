import { COVER_MIME_TO_EXT } from '../middleware/uploadCover.js'
import { buildCoverPublicUrl } from '../utils/uploadPaths.js'
import { ProductsServiceError, setProductCoverImage } from './productsService.js'

export async function uploadProductCover(productId, file) {
  if (!file) {
    throw new ProductsServiceError('Archivo requerido (campo file)', 400)
  }

  const extension = COVER_MIME_TO_EXT[file.mimetype]
  if (!extension) {
    throw new ProductsServiceError('Tipo de archivo no permitido. Usar JPEG, PNG o WebP.', 400)
  }

  const imageUrl = buildCoverPublicUrl(productId, extension)
  return setProductCoverImage(productId, imageUrl)
}

// TODO: POST /api/admin/products/:id/images/gallery
// - subir gallery-YYYYMMDD-HHMMSS.ext
// - append al array gallery sin duplicar

import { COVER_MIME_TO_EXT } from '../middleware/uploadCover.js'
import { buildCoverPublicUrl, buildGalleryPublicUrl, parseGallerySlot } from '../utils/uploadPaths.js'
import {
  ProductsServiceError,
  setProductCoverImage,
  setProductGallerySlot,
} from './productsService.js'

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

export async function uploadProductGallerySlot(productId, slot, file) {
  if (!file) {
    throw new ProductsServiceError('Archivo requerido (campo file)', 400)
  }

  const extension = COVER_MIME_TO_EXT[file.mimetype]
  if (!extension) {
    throw new ProductsServiceError('Tipo de archivo no permitido. Usar JPEG, PNG o WebP.', 400)
  }

  const slotIndex = parseGallerySlot(slot)
  const imageUrl = buildGalleryPublicUrl(productId, slotIndex, extension)
  return setProductGallerySlot(productId, slotIndex, imageUrl)
}

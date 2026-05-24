import path from 'path'
import { config } from '../config/env.js'
import { isValidProductSlug } from './productValidators.js'

export const COVER_EXTENSIONS = ['jpg', 'png', 'webp']

export function assertValidProductId(productId) {
  const id = String(productId || '').trim()
  if (!id || !isValidProductSlug(id)) {
    throw new Error('id de producto inválido')
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error('id de producto inválido')
  }
  return id
}

export function getProductUploadDir(productId) {
  const id = assertValidProductId(productId)
  const uploadsRoot = path.resolve(config.uploadsDir)
  const productDir = path.resolve(uploadsRoot, 'products', id)

  if (productDir !== uploadsRoot && !productDir.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('ruta de subida inválida')
  }

  return productDir
}

export function buildCoverPublicUrl(productId, extension) {
  const id = assertValidProductId(productId)
  const ext = String(extension || '').toLowerCase()
  if (!COVER_EXTENSIONS.includes(ext)) {
    throw new Error('extensión de portada inválida')
  }
  return `${config.publicUploadsBaseUrl}/products/${id}/cover.${ext}`
}

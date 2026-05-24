import { readAll, ProductsRepositoryError } from '../repositories/productsRepository.js'
import { normalizeProduct } from '../utils/productValidators.js'

export class CatalogError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'CatalogError'
    this.statusCode = statusCode
  }
}

export async function loadCatalog() {
  try {
    const data = await readAll()
    return data.map(normalizeProduct)
  } catch (err) {
    if (err instanceof ProductsRepositoryError) {
      throw new CatalogError(err.message, err.statusCode)
    }
    if (err instanceof CatalogError) throw err
    console.error('Error leyendo products.json:', err.message)
    throw new CatalogError('No se pudo leer el catálogo')
  }
}

export async function catalogById() {
  const products = await loadCatalog()
  const map = {}
  for (const p of products) {
    if (p?.id) map[p.id] = p
  }
  return map
}

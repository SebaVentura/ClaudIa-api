import fs from 'fs/promises'
import { config } from '../config/env.js'

export class CatalogError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'CatalogError'
    this.statusCode = statusCode
  }
}

export async function loadCatalog() {
  try {
    const raw = await fs.readFile(config.productsPath, 'utf8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) {
      throw new CatalogError('Formato de catálogo inválido')
    }
    return data
  } catch (err) {
    if (err instanceof CatalogError) throw err
    if (err instanceof SyntaxError) {
      console.error('products.json corrupto:', err.message)
      throw new CatalogError('No se pudo leer el catálogo (JSON inválido)')
    }
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

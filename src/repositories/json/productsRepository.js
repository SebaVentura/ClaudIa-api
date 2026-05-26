import fs from 'fs/promises'
import path from 'path'
import { config } from '../../config/env.js'
import { writeJsonAtomic } from '../../utils/jsonAtomicWrite.js'

export class ProductsRepositoryError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'ProductsRepositoryError'
    this.statusCode = statusCode
  }
}

async function ensureFile() {
  const dir = path.dirname(config.productsPath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(config.productsPath)
  } catch {
    await writeJsonAtomic(config.productsPath, [])
  }
}

async function readRaw() {
  await ensureFile()
  let raw
  try {
    raw = await fs.readFile(config.productsPath, 'utf8')
  } catch (err) {
    console.error('products.json inaccesible:', err.message)
    throw new ProductsRepositoryError('No se pudo leer el catálogo')
  }

  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) {
      throw new ProductsRepositoryError('Formato de catálogo inválido')
    }
    return data
  } catch (err) {
    if (err instanceof ProductsRepositoryError) throw err
    if (err instanceof SyntaxError) {
      console.error('products.json corrupto:', err.message)
      throw new ProductsRepositoryError('No se pudo leer el catálogo (JSON inválido)')
    }
    throw err
  }
}

export async function readAll() {
  return readRaw()
}

export async function writeAll(products) {
  if (!Array.isArray(products)) {
    throw new ProductsRepositoryError('Formato de catálogo inválido al guardar')
  }
  await writeJsonAtomic(config.productsPath, products)
}

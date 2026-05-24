import { readAll, writeAll, ProductsRepositoryError } from '../repositories/productsRepository.js'
import { normalizeProduct, validateProductInput } from '../utils/productValidators.js'

export class ProductsServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'ProductsServiceError'
    this.statusCode = statusCode
  }
}

function wrapRepositoryError(err) {
  if (err instanceof ProductsRepositoryError) {
    throw new ProductsServiceError(err.message, err.statusCode)
  }
  throw err
}

function normalizeAll(products) {
  return products.map(normalizeProduct)
}

function matchesQuery(product, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [product.id, product.title, product.description, product.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export async function listProducts({ active, q, category } = {}) {
  try {
    let products = normalizeAll(await readAll())

    if (active === true) products = products.filter((p) => p.active === true)
    if (active === false) products = products.filter((p) => p.active === false)

    if (category) {
      const cat = String(category).trim().toLowerCase()
      products = products.filter((p) => String(p.category || '').toLowerCase().includes(cat))
    }

    if (q) products = products.filter((p) => matchesQuery(p, String(q).trim()))

    return products
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function getProductById(id) {
  const productId = String(id || '').trim()
  if (!productId) throw new ProductsServiceError('id requerido')

  try {
    const products = normalizeAll(await readAll())
    const product = products.find((p) => p.id === productId)
    if (!product) throw new ProductsServiceError('Producto no encontrado', 404)
    return product
  } catch (err) {
    if (err instanceof ProductsServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function createProduct(body) {
  const { product, errors } = validateProductInput(body, { requireId: false })
  if (errors.length) throw new ProductsServiceError(errors.join('; '))

  try {
    const raw = await readAll()
    if (raw.some((p) => p?.id === product.id)) {
      throw new ProductsServiceError(`Ya existe un producto con id: ${product.id}`, 409)
    }
    raw.push(product)
    await writeAll(raw)
    return normalizeProduct(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function updateProduct(id, body) {
  const productId = String(id || '').trim()
  if (!productId) throw new ProductsServiceError('id requerido')

  try {
    const raw = await readAll()
    const index = raw.findIndex((p) => p?.id === productId)
    if (index === -1) throw new ProductsServiceError('Producto no encontrado', 404)

    const existing = normalizeProduct(raw[index])
    const merged = { ...existing, ...body, id: productId }
    const { product, errors } = validateProductInput(merged, {
      requireId: true,
      existingId: productId,
    })
    if (errors.length) throw new ProductsServiceError(errors.join('; '))

    raw[index] = product
    await writeAll(raw)
    return normalizeProduct(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function toggleProductActive(id) {
  const productId = String(id || '').trim()
  if (!productId) throw new ProductsServiceError('id requerido')

  try {
    const raw = await readAll()
    const index = raw.findIndex((p) => p?.id === productId)
    if (index === -1) throw new ProductsServiceError('Producto no encontrado', 404)

    const current = normalizeProduct(raw[index])
    raw[index] = { ...current, active: !current.active }
    await writeAll(raw)
    return normalizeProduct(raw[index])
  } catch (err) {
    if (err instanceof ProductsServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function setProductCoverImage(id, imageUrl) {
  const productId = String(id || '').trim()
  if (!productId) throw new ProductsServiceError('id requerido')

  const product = await getProductById(productId)
  const gallery = Array.isArray(product.gallery) ? [...product.gallery] : []
  const oldImage = product.image
  const rest = gallery.filter((url) => url !== imageUrl && url !== oldImage)

  return updateProduct(productId, {
    image: imageUrl,
    gallery: [imageUrl, ...rest],
  })
}

export async function deactivateProduct(id) {
  const productId = String(id || '').trim()
  if (!productId) throw new ProductsServiceError('id requerido')

  try {
    const raw = await readAll()
    const index = raw.findIndex((p) => p?.id === productId)
    if (index === -1) throw new ProductsServiceError('Producto no encontrado', 404)

    raw[index] = { ...normalizeProduct(raw[index]), active: false }
    await writeAll(raw)
    return normalizeProduct(raw[index])
  } catch (err) {
    if (err instanceof ProductsServiceError) throw err
    wrapRepositoryError(err)
  }
}

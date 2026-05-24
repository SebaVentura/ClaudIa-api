const ID_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DELIVERY_MODES = new Set(['automatic_download', 'manual'])
const CHECKOUT_MODES = new Set(['cart'])

export function slugFromTitle(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeProduct(raw) {
  const product = raw && typeof raw === 'object' ? raw : {}
  return {
    ...product,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    includes: Array.isArray(product.includes) ? product.includes : [],
    category: product.category ?? '',
    downloadLink: product.downloadLink ?? '',
    deliveryMode: product.deliveryMode ?? 'automatic_download',
    checkoutMode: product.checkoutMode ?? 'cart',
    active: product.active !== false,
  }
}

export function toPublicProduct(raw) {
  const normalized = normalizeProduct(raw)
  const { downloadLink: _downloadLink, ...publicFields } = normalized
  return publicFields
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return null
}

function parsePrice(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

function parsePages(value) {
  if (value == null || value === '') return null
  const num = Number.parseInt(String(value), 10)
  if (!Number.isInteger(num) || num < 0) return null
  return num
}

function parseStringArray(value, fieldName, errors) {
  if (value == null) return []
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} debe ser un array`)
    return []
  }
  return value.map((item) => String(item).trim()).filter(Boolean)
}

export function validateProductInput(body, { requireId = false, existingId = null } = {}) {
  const errors = []
  const input = body && typeof body === 'object' ? body : {}

  let id = input.id != null ? String(input.id).trim() : ''
  const title = input.title != null ? String(input.title).trim() : ''

  if (!id && title) id = slugFromTitle(title)
  if (requireId && !id) errors.push('id es obligatorio')
  if (id && !ID_SLUG_RE.test(id)) {
    errors.push('id inválido: usar minúsculas, números y guiones')
  }
  if (existingId && id && id !== existingId) {
    errors.push('no se puede cambiar el id del producto')
  }

  if (!title) errors.push('title es obligatorio')

  const price = parsePrice(input.price)
  if (price == null) errors.push('price es obligatorio y debe ser numérico mayor a 0')

  const image = input.image != null ? String(input.image).trim() : ''
  if (!image) errors.push('image es obligatorio')

  const activeParsed = parseBoolean(input.active)
  const active = activeParsed == null ? true : activeParsed
  if (input.active != null && activeParsed == null) {
    errors.push('active debe ser booleano')
  }

  const gallery = parseStringArray(input.gallery, 'gallery', errors)
  const includes = parseStringArray(input.includes, 'includes', errors)

  let pages = null
  if (input.pages != null && input.pages !== '') {
    pages = parsePages(input.pages)
    if (pages == null) errors.push('pages debe ser un entero mayor o igual a 0')
  }

  const deliveryMode = input.deliveryMode != null ? String(input.deliveryMode).trim() : 'automatic_download'
  if (!DELIVERY_MODES.has(deliveryMode)) {
    errors.push('deliveryMode debe ser automatic_download o manual')
  }

  const checkoutMode = input.checkoutMode != null ? String(input.checkoutMode).trim() : 'cart'
  if (!CHECKOUT_MODES.has(checkoutMode)) {
    errors.push('checkoutMode debe ser cart')
  }

  if (errors.length) return { errors }

  const product = normalizeProduct({
    id: existingId ?? id,
    title,
    level: input.level != null ? String(input.level).trim() : '',
    age: input.age != null ? String(input.age).trim() : '',
    description: input.description != null ? String(input.description).trim() : '',
    longDescription: input.longDescription != null ? String(input.longDescription).trim() : '',
    price,
    badge: input.badge == null || input.badge === '' ? null : String(input.badge).trim(),
    active,
    image,
    gallery,
    includes,
    audience: input.audience != null ? String(input.audience).trim() : '',
    category: input.category != null ? String(input.category).trim() : '',
    downloadLink: input.downloadLink != null ? String(input.downloadLink).trim() : '',
    deliveryMode,
    checkoutMode,
  })

  if (pages != null) product.pages = pages
  else if (input.pages === undefined && input.existingPages != null) {
    product.pages = input.existingPages
  }

  return { product, errors: [] }
}

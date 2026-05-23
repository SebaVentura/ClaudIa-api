import { catalogById } from './catalog.js'

export class PricingError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PricingError'
  }
}

export async function validateAndPriceItems(items) {
  if (!items?.length) {
    throw new PricingError('Carrito vacío')
  }

  const catalog = await catalogById()
  const mpItems = []
  const orderItems = []
  let total = 0

  for (const raw of items) {
    const productId = raw.productId
    const quantity = raw.quantity

    if (!productId) throw new PricingError('productId requerido')
    if (!Number.isInteger(quantity)) throw new PricingError('Cantidad inválida')
    if (quantity < 1) throw new PricingError('La cantidad debe ser al menos 1')
    if (quantity > 10) throw new PricingError('Cantidad máxima por producto: 10')

    const product = catalog[productId]
    if (!product) throw new PricingError(`Producto no encontrado: ${productId}`)
    if (product.active !== true) throw new PricingError(`Producto no disponible: ${productId}`)

    const unitPrice = Number(product.price)
    const lineTotal = unitPrice * quantity
    total += lineTotal

    const title = product.title
    const description = (product.description || title).slice(0, 256)

    mpItems.push({
      id: productId,
      title,
      description,
      quantity,
      currency_id: 'ARS',
      unit_price: unitPrice,
    })

    orderItems.push({
      productId,
      title,
      quantity,
      unitPrice,
    })
  }

  return { mpItems, orderItems, total }
}

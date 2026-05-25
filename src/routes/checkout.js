import { Router } from 'express'
import { MercadoPagoError, createCheckoutPreference } from '../services/mercadopagoService.js'
import { createOrderId, finalizeCheckoutOrder, OrdersStoreError } from '../services/ordersStore.js'
import { OrdersServiceError } from '../services/ordersService.js'
import { normalizeBuyerInput } from '../utils/orderMappers.js'
import { PricingError, validateAndPriceItems } from '../services/pricing.js'

const router = Router()

/**
 * Checkout:
 * 1) Valida precios en servidor.
 * 2) Genera orderId en memoria.
 * 3) Crea preferencia en Mercado Pago.
 * 4) Si MP falla: no persiste orden ni cliente.
 * 5) Si MP OK: una sola escritura en data/orders.json (orden + customerId + preferenceId)
 *    y upsert en data/customers.json.
 */
router.post('/api/checkout/create-preference', async (req, res) => {
  const { items, buyerEmail, buyer } = req.body ?? {}
  const buyerInput = buyer ?? buyerEmail ?? null

  if (!items?.length) {
    return res.status(400).json({ detail: 'Carrito vacío' })
  }

  try {
    const priced = await validateAndPriceItems(items)
    const orderId = createOrderId()
    const payerEmail = normalizeBuyerInput(buyerInput).email || buyerEmail || null

    const mpResult = await createCheckoutPreference(orderId, priced.mpItems, payerEmail)

    if (!mpResult?.preferenceId) {
      throw new MercadoPagoError('Mercado Pago no devolvió preferenceId', 502)
    }

    await finalizeCheckoutOrder({
      orderId,
      orderItems: priced.orderItems,
      total: priced.total,
      buyerInput,
      preferenceId: mpResult.preferenceId,
    })

    res.json({
      orderId,
      preferenceId: mpResult.preferenceId,
      initPoint: mpResult.initPoint,
    })
  } catch (err) {
    if (err instanceof PricingError) {
      return res.status(400).json({ detail: err.message })
    }
    if (err instanceof OrdersStoreError || err instanceof OrdersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    if (err instanceof MercadoPagoError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected checkout error:', err)
    res.status(500).json({ detail: 'Error inesperado creando preferencia de pago' })
  }
})

export default router

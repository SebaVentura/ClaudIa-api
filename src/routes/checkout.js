import { Router } from 'express'
import { MercadoPagoError, createCheckoutPreference } from '../services/mercadopagoService.js'
import { createPendingOrder, updatePreferenceId, OrdersStoreError } from '../services/ordersStore.js'
import { PricingError, validateAndPriceItems } from '../services/pricing.js'

const router = Router()

router.post('/api/checkout/create-preference', async (req, res) => {
  const { items, buyerEmail } = req.body ?? {}

  if (!items?.length) {
    return res.status(400).json({ detail: 'Carrito vacío' })
  }

  try {
    const priced = await validateAndPriceItems(items)
    const order = await createPendingOrder(priced.orderItems, priced.total, buyerEmail)
    const orderId = order.orderId

    const mpResult = await createCheckoutPreference(orderId, priced.mpItems, buyerEmail)

    if (mpResult.preferenceId) {
      await updatePreferenceId(orderId, mpResult.preferenceId)
    }

    res.json({
      orderId,
      preferenceId: mpResult.preferenceId,
      initPoint: mpResult.initPoint,
    })
  } catch (err) {
    if (err instanceof PricingError) {
      return res.status(400).json({ detail: err.message })
    }
    if (err instanceof OrdersStoreError) {
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

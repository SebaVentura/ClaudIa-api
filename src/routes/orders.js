import { Router } from 'express'
import { getOrder, OrdersStoreError } from '../services/ordersStore.js'

const router = Router()

router.get('/api/orders/:orderId/status', async (req, res) => {
  try {
    const order = await getOrder(req.params.orderId)
    if (!order) {
      return res.status(404).json({ detail: 'Orden no encontrada' })
    }

    const payment = order.payment || {}
    res.json({
      orderId: req.params.orderId,
      status: order.status,
      total: order.total,
      paidAt: order.paidAt ?? null,
      updatedAt: order.updatedAt ?? null,
      paymentStatus: payment.payment_status ?? null,
      amountValidated: payment.amount_validated ?? null,
    })
  } catch (err) {
    if (err instanceof OrdersStoreError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected order status error:', err)
    res.status(500).json({ detail: 'Error al consultar la orden' })
  }
})

export default router

import { Router } from 'express'
import { MercadoPagoError } from '../services/mercadopagoService.js'
import { processMercadopagoWebhook } from '../services/payments.js'
import { OrdersStoreError } from '../services/ordersStore.js'

const router = Router()

async function handleWebhook(req, res) {
  try {
    const result = await processMercadopagoWebhook(req)
    res.json(result)
  } catch (err) {
    if (err instanceof OrdersStoreError) {
      console.error('Webhook orders store error:', err.message)
      return res.status(err.statusCode).json({ detail: err.message })
    }
    if (err instanceof MercadoPagoError) {
      if ([500, 502, 503].includes(err.statusCode)) {
        console.error('Webhook requiere reintento MP:', err.message)
        return res.status(err.statusCode).json({ detail: err.message })
      }
      console.warn('Webhook error MP no reintenable:', err.message)
      return res.json({ ok: true, reason: 'mercadopago_error', detail: err.message })
    }
    console.error('Error inesperado en webhook:', err)
    res.status(500).json({ detail: 'Error interno procesando webhook' })
  }
}

router.post('/api/webhooks/mercadopago', handleWebhook)
router.get('/api/webhooks/mercadopago', handleWebhook)

export default router

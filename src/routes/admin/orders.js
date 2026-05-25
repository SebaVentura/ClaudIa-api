import { Router } from 'express'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import {
  OrdersServiceError,
  listOrders,
  getOrderById,
  updateOrderStatusAdmin,
} from '../../services/ordersService.js'

const router = Router()

router.use(requireAdmin)

router.get('/', async (req, res) => {
  try {
    const orders = await listOrders({
      status: req.query.status,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
    })
    res.json(orders)
  } catch (err) {
    if (err instanceof OrdersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin orders list error:', err)
    res.status(500).json({ detail: 'Error al listar órdenes' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const order = await getOrderById(req.params.id)
    res.json(order)
  } catch (err) {
    if (err instanceof OrdersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin order get error:', err)
    res.status(500).json({ detail: 'Error al obtener la orden' })
  }
})

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body ?? {}
    const order = await updateOrderStatusAdmin(req.params.id, status)
    res.json(order)
  } catch (err) {
    if (err instanceof OrdersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin order status error:', err)
    res.status(500).json({ detail: 'Error al actualizar estado de la orden' })
  }
})

export default router

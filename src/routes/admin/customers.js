import { Router } from 'express'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import {
  CustomersServiceError,
  listCustomers,
  getCustomerById,
  getCustomerOrders,
} from '../../services/customersService.js'

const router = Router()

router.use(requireAdmin)

router.get('/', async (req, res) => {
  try {
    const customers = await listCustomers({ q: req.query.q })
    res.json(customers)
  } catch (err) {
    if (err instanceof CustomersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin customers list error:', err)
    res.status(500).json({ detail: 'Error al listar clientes' })
  }
})

router.get('/:id/orders', async (req, res) => {
  try {
    const orders = await getCustomerOrders(req.params.id)
    res.json(orders)
  } catch (err) {
    if (err instanceof CustomersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin customer orders error:', err)
    res.status(500).json({ detail: 'Error al listar órdenes del cliente' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.id)
    res.json(customer)
  } catch (err) {
    if (err instanceof CustomersServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin customer get error:', err)
    res.status(500).json({ detail: 'Error al obtener el cliente' })
  }
})

export default router

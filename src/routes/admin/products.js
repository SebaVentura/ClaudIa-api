import { Router } from 'express'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import {
  ProductsServiceError,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductActive,
  deactivateProduct,
} from '../../services/productsService.js'

const router = Router()

router.use(requireAdmin)

function parseActiveFilter(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

router.get('/', async (req, res) => {
  try {
    const products = await listProducts({
      active: parseActiveFilter(req.query.active),
      q: req.query.q,
      category: req.query.category,
    })
    res.json(products)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin products list error:', err)
    res.status(500).json({ detail: 'Error al listar productos' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    res.json(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin product get error:', err)
    res.status(500).json({ detail: 'Error al obtener producto' })
  }
})

router.post('/', async (req, res) => {
  try {
    const product = await createProduct(req.body)
    res.status(201).json(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin product create error:', err)
    res.status(500).json({ detail: 'Error al crear producto' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body)
    res.json(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin product update error:', err)
    res.status(500).json({ detail: 'Error al actualizar producto' })
  }
})

router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const product = await toggleProductActive(req.params.id)
    res.json(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin product toggle error:', err)
    res.status(500).json({ detail: 'Error al cambiar estado del producto' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const product = await deactivateProduct(req.params.id)
    res.json(product)
  } catch (err) {
    if (err instanceof ProductsServiceError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin product delete error:', err)
    res.status(500).json({ detail: 'Error al desactivar producto' })
  }
})

export default router

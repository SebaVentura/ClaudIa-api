import { Router } from 'express'
import { CatalogError, loadCatalog } from '../services/catalog.js'
import { toPublicProduct } from '../utils/productValidators.js'

const router = Router()

router.get('/api/products', async (_req, res) => {
  try {
    const products = await loadCatalog()
    res.json(products.filter((p) => p.active === true).map(toPublicProduct))
  } catch (err) {
    if (err instanceof CatalogError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected products error:', err)
    res.status(500).json({ detail: 'No se pudo leer el catálogo' })
  }
})

export default router

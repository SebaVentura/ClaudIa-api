import { Router } from 'express'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { getDashboardSummary } from '../../services/dashboardService.js'

const router = Router()

router.use(requireAdmin)

router.get('/summary', async (req, res) => {
  try {
    const summary = await getDashboardSummary({ period: req.query.period })
    res.json(summary)
  } catch (err) {
    console.error('Unexpected admin dashboard summary error:', err)
    res.status(500).json({ detail: 'Error al cargar métricas del dashboard' })
  }
})

export default router

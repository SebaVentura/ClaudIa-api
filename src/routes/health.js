import { Router } from 'express'

const router = Router()

router.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'claudia-api',
    phase: 5,
    runtime: 'node',
  })
})

export default router

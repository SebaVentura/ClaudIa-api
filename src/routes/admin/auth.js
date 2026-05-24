import { Router } from 'express'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { AuthError, login } from '../../services/authService.js'

const router = Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {}

  try {
    const result = login(username, password)
    res.json({
      token: result.token,
      user: result.user,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected admin login error:', err)
    res.status(500).json({ detail: 'Error inesperado en login' })
  }
})

router.get('/me', requireAdmin, (req, res) => {
  res.json({ user: req.admin })
})

router.post('/logout', (_req, res) => {
  res.status(204).send()
})

export default router

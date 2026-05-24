import { AuthError, verifyAccessToken } from '../services/authService.js'

function extractBearerToken(req) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token || null
}

export function requireAdmin(req, res, next) {
  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({ detail: 'Autenticación requerida' })
  }

  try {
    req.admin = verifyAccessToken(token)
    next()
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ detail: err.message })
    }
    console.error('Unexpected requireAdmin error:', err)
    res.status(500).json({ detail: 'Error de autenticación' })
  }
}

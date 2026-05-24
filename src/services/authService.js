import { timingSafeEqual } from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'

export class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function isAdminAuthConfigured() {
  return Boolean(config.adminUser && config.adminPassword && config.jwtSecret)
}

export function login(username, password) {
  if (!isAdminAuthConfigured()) {
    throw new AuthError('Autenticación admin no configurada en el servidor', 503)
  }

  const user = String(username ?? '').trim()
  const pass = String(password ?? '')

  if (!user || !pass) {
    throw new AuthError('Usuario y contraseña requeridos')
  }

  if (!safeEqual(user, config.adminUser) || !safeEqual(pass, config.adminPassword)) {
    throw new AuthError('Credenciales inválidas')
  }

  const token = jwt.sign({ sub: user, role: 'admin' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  })

  return { token, user: { username: user, role: 'admin' } }
}

export function verifyAccessToken(token) {
  if (!config.jwtSecret) {
    throw new AuthError('Autenticación admin no configurada en el servidor', 503)
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    if (payload.role !== 'admin' || !payload.sub) {
      throw new AuthError('Token inválido')
    }
    return { username: payload.sub, role: payload.role }
  } catch (err) {
    if (err instanceof AuthError) throw err
    throw new AuthError('Token inválido o expirado')
  }
}

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(__dirname, '../..')

dotenv.config({ path: path.join(SERVER_ROOT, '.env') })

function resolveDataPath(envKey, defaultRelative) {
  const raw = process.env[envKey] || defaultRelative
  return path.isAbsolute(raw) ? raw : path.resolve(SERVER_ROOT, raw)
}

export const config = {
  port: Number.parseInt(process.env.PORT || '3000', 10),
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  productsPath: resolveDataPath('PRODUCTS_PATH', './data/products.json'),
  ordersPath: resolveDataPath('ORDERS_PATH', './data/orders.json'),
  customersPath: resolveDataPath('CUSTOMERS_PATH', './data/customers.json'),
  mpAccessToken: (process.env.MP_ACCESS_TOKEN || '').trim(),
  mpEnv: (process.env.MP_ENV || 'sandbox').toLowerCase(),
  adminUser: (process.env.ADMIN_USER || '').trim(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  jwtSecret: (process.env.JWT_SECRET || '').trim(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '8h').trim(),
  uploadsDir: resolveDataPath('UPLOADS_DIR', './storage/uploads'),
  publicUploadsBaseUrl: (
    process.env.PUBLIC_UPLOADS_BASE_URL || 'http://127.0.0.1:3000/uploads'
  ).replace(/\/$/, ''),
}

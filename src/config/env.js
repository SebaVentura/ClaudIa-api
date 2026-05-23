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
  ordersPath: resolveDataPath('ORDERS_PATH', './storage/orders.json'),
  mpAccessToken: (process.env.MP_ACCESS_TOKEN || '').trim(),
  mpEnv: (process.env.MP_ENV || 'sandbox').toLowerCase(),
}

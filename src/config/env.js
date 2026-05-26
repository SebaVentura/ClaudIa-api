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

const nodeEnv = (process.env.NODE_ENV || 'development').trim()
const mongodbUri = (process.env.MONGODB_URI || '').trim()
const mongodbDb = (process.env.MONGODB_DB || '').trim()

const port = Number.parseInt(process.env.PORT || '3000', 10)
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  throw new Error(`PORT inválido: ${process.env.PORT}`)
}

if (mongodbUri && !mongodbDb) {
  throw new Error('MONGODB_DB es requerido cuando MONGODB_URI está definido')
}
if (mongodbDb && !mongodbUri) {
  throw new Error('MONGODB_URI es requerido cuando MONGODB_DB está definido')
}

export function isMongoConfigured() {
  return Boolean(mongodbUri && mongodbDb)
}

export const config = {
  port,
  nodeEnv,
  mongodbUri,
  mongodbDb,
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiPublicUrl: (process.env.API_PUBLIC_URL || 'http://127.0.0.1:3000').replace(/\/$/, ''),
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

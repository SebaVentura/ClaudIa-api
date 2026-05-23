import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/env.js'

export class OrdersStoreError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'OrdersStoreError'
    this.statusCode = statusCode
  }
}

function utcNowIso() {
  return new Date().toISOString()
}

async function ensureStorage() {
  const dir = path.dirname(config.ordersPath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(config.ordersPath)
  } catch {
    await writeAllAtomic([])
  }
}

async function readAll() {
  await ensureStorage()
  let raw
  try {
    raw = await fs.readFile(config.ordersPath, 'utf8')
  } catch (err) {
    console.error('orders.json inaccesible:', err.message)
    throw new OrdersStoreError('No se pudo leer el almacén de órdenes')
  }

  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) {
      console.error('orders.json: raíz no es un array')
      throw new OrdersStoreError('Almacén de órdenes corrupto (formato inválido)')
    }
    return data
  } catch (err) {
    if (err instanceof OrdersStoreError) throw err
    console.error('orders.json corrupto (JSON inválido):', err.message)
    throw new OrdersStoreError('Almacén de órdenes corrupto (JSON inválido)')
  }
}

async function writeAllAtomic(orders) {
  await ensureStorage()
  const tmp = `${config.ordersPath}.tmp`
  const content = JSON.stringify(orders, null, 2)
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, config.ordersPath)
}

export async function createPendingOrder(orderItems, total, buyerEmail = null) {
  const order = {
    orderId: uuidv4(),
    status: 'pending',
    items: orderItems,
    total,
    preferenceId: null,
    buyerEmail: buyerEmail ?? null,
    createdAt: utcNowIso(),
  }
  const orders = await readAll()
  orders.push(order)
  await writeAllAtomic(orders)
  return order
}

export async function updatePreferenceId(orderId, preferenceId) {
  const orders = await readAll()
  for (const order of orders) {
    if (order.orderId === orderId) {
      order.preferenceId = preferenceId
      break
    }
  }
  await writeAllAtomic(orders)
}

export async function getOrder(orderId) {
  const orders = await readAll()
  return orders.find((o) => o.orderId === orderId) ?? null
}

export async function updateOrderPaymentState(orderId, { status, payment, paidAt = null }) {
  const orders = await readAll()
  const target = orders.find((o) => o.orderId === orderId)
  if (!target) return null
  if (target.status === 'paid') return target

  target.status = status
  target.updatedAt = utcNowIso()
  target.payment = payment
  if (paidAt != null) target.paidAt = paidAt

  await writeAllAtomic(orders)
  return target
}

export async function touchOrderPaymentWebhook(orderId, paymentPatch) {
  const orders = await readAll()
  const target = orders.find((o) => o.orderId === orderId)
  if (!target) return null

  target.payment = { ...(target.payment || {}), ...paymentPatch }
  target.updatedAt = utcNowIso()
  await writeAllAtomic(orders)
  return target
}

export async function touchPaidOrderWebhook(orderId, paymentPatch) {
  const order = await getOrder(orderId)
  if (!order || order.status !== 'paid') return order
  return touchOrderPaymentWebhook(orderId, paymentPatch)
}

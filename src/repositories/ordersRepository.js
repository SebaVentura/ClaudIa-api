import fs from 'fs/promises'
import path from 'path'
import { config } from '../config/env.js'
import { writeJsonAtomic } from '../utils/jsonAtomicWrite.js'

export class OrdersStoreError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'OrdersStoreError'
    this.statusCode = statusCode
  }
}

async function ensureFile() {
  const dir = path.dirname(config.ordersPath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(config.ordersPath)
  } catch {
    await writeJsonAtomic(config.ordersPath, [])
  }
}

async function readRaw() {
  await ensureFile()
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
      throw new OrdersStoreError('Almacén de órdenes corrupto (formato inválido)')
    }
    return data
  } catch (err) {
    if (err instanceof OrdersStoreError) throw err
    if (err instanceof SyntaxError) {
      console.error('orders.json corrupto:', err.message)
      throw new OrdersStoreError('Almacén de órdenes corrupto (JSON inválido)')
    }
    throw err
  }
}

export async function readAll() {
  return readRaw()
}

export async function writeAll(orders) {
  if (!Array.isArray(orders)) {
    throw new OrdersStoreError('Almacén de órdenes corrupto al guardar')
  }
  await writeJsonAtomic(config.ordersPath, orders)
}

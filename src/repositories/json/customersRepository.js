import fs from 'fs/promises'
import path from 'path'
import { config } from '../../config/env.js'
import { writeJsonAtomic } from '../../utils/jsonAtomicWrite.js'

export class CustomersStoreError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'CustomersStoreError'
    this.statusCode = statusCode
  }
}

async function ensureFile() {
  const dir = path.dirname(config.customersPath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(config.customersPath)
  } catch {
    await writeJsonAtomic(config.customersPath, [])
  }
}

async function readRaw() {
  await ensureFile()
  let raw
  try {
    raw = await fs.readFile(config.customersPath, 'utf8')
  } catch (err) {
    console.error('customers.json inaccesible:', err.message)
    throw new CustomersStoreError('No se pudo leer el almacén de clientes')
  }

  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) {
      throw new CustomersStoreError('Almacén de clientes corrupto (formato inválido)')
    }
    return data
  } catch (err) {
    if (err instanceof CustomersStoreError) throw err
    if (err instanceof SyntaxError) {
      console.error('customers.json corrupto:', err.message)
      throw new CustomersStoreError('Almacén de clientes corrupto (JSON inválido)')
    }
    throw err
  }
}

export async function readAll() {
  return readRaw()
}

export async function writeAll(customers) {
  if (!Array.isArray(customers)) {
    throw new CustomersStoreError('Almacén de clientes corrupto al guardar')
  }
  await writeJsonAtomic(config.customersPath, customers)
}

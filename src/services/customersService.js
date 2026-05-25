import { v4 as uuidv4 } from 'uuid'
import {
  readAll as readCustomers,
  writeAll as writeCustomers,
  CustomersStoreError,
} from '../repositories/customersRepository.js'
import { readAll as readOrders } from '../repositories/ordersRepository.js'
import { normalizeBuyerInput, normalizeOrder } from '../utils/orderMappers.js'

export class CustomersServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'CustomersServiceError'
    this.statusCode = statusCode
  }
}

function utcNowIso() {
  return new Date().toISOString()
}

function wrapRepositoryError(err) {
  if (err instanceof CustomersStoreError) {
    throw new CustomersServiceError(err.message, err.statusCode)
  }
  throw err
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeCustomer(raw) {
  const customer = raw && typeof raw === 'object' ? raw : {}
  return {
    id: customer.id,
    name: customer.name ?? '',
    email: normalizeEmail(customer.email),
    phone: customer.phone ?? '',
    totalOrders: Number(customer.totalOrders ?? 0),
    totalSpent: Number(customer.totalSpent ?? 0),
    lastPurchaseAt: customer.lastPurchaseAt ?? null,
    createdAt: customer.createdAt ?? utcNowIso(),
    updatedAt: customer.updatedAt ?? customer.createdAt ?? null,
  }
}

export async function upsertFromBuyer(buyerInput) {
  const buyer = normalizeBuyerInput(buyerInput)
  const email = normalizeEmail(buyer.email)
  if (!email) return null

  try {
    const customers = (await readCustomers()).map(normalizeCustomer)
    const index = customers.findIndex((c) => c.email === email)
    const now = utcNowIso()

    if (index === -1) {
      const created = {
        id: uuidv4(),
        name: buyer.name,
        email,
        phone: buyer.phone,
        totalOrders: 0,
        totalSpent: 0,
        lastPurchaseAt: null,
        createdAt: now,
        updatedAt: now,
      }
      customers.push(created)
      await writeCustomers(customers)
      return created.id
    }

    const existing = customers[index]
    customers[index] = {
      ...existing,
      name: buyer.name || existing.name,
      phone: buyer.phone || existing.phone,
      updatedAt: now,
    }
    await writeCustomers(customers)
    return existing.id
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function recalculateCustomerStats(customerId) {
  const id = String(customerId || '').trim()
  if (!id) return null

  try {
    const orders = (await readOrders()).map(normalizeOrder)
    const paidOrders = orders.filter((o) => o.customerId === id && o.status === 'paid')

    const totalOrders = paidOrders.length
    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0)
    const lastPurchaseAt = paidOrders
      .map((o) => o.paidAt || o.updatedAt || o.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

    const customers = (await readCustomers()).map(normalizeCustomer)
    const index = customers.findIndex((c) => c.id === id)
    if (index === -1) return null

    customers[index] = {
      ...customers[index],
      totalOrders,
      totalSpent,
      lastPurchaseAt,
      updatedAt: utcNowIso(),
    }
    await writeCustomers(customers)
    return normalizeCustomer(customers[index])
  } catch (err) {
    if (err instanceof CustomersServiceError) throw err
    wrapRepositoryError(err)
  }
}

function matchesCustomerQuery(customer, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [customer.name, customer.email, customer.phone].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(needle)
}

export async function listCustomers({ q } = {}) {
  try {
    let customers = (await readCustomers()).map(normalizeCustomer)
    if (q) customers = customers.filter((c) => matchesCustomerQuery(c, String(q).trim()))
    customers.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return customers
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function getCustomerById(id) {
  const customerId = String(id || '').trim()
  if (!customerId) throw new CustomersServiceError('id requerido')

  try {
    const customer = (await readCustomers()).map(normalizeCustomer).find((c) => c.id === customerId)
    if (!customer) throw new CustomersServiceError('Cliente no encontrado', 404)
    return customer
  } catch (err) {
    if (err instanceof CustomersServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function getCustomerOrders(customerId) {
  const id = String(customerId || '').trim()
  if (!id) throw new CustomersServiceError('id requerido')

  await getCustomerById(id)

  try {
    const orders = (await readOrders())
      .map(normalizeOrder)
      .filter((o) => o.customerId === id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return orders
  } catch (err) {
    wrapRepositoryError(err)
  }
}

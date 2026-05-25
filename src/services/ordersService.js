import { v4 as uuidv4 } from 'uuid'
import {
  readAll as readOrders,
  writeAll as writeOrders,
  OrdersStoreError,
} from '../repositories/ordersRepository.js'
import {
  normalizeBuyerInput,
  normalizeOrder,
  toPersistedOrder,
} from '../utils/orderMappers.js'
import { validateAdminStatusTransition } from '../utils/orderValidators.js'
import { recalculateCustomerStats, upsertFromBuyer } from './customersService.js'

export class OrdersServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'OrdersServiceError'
    this.statusCode = statusCode
  }
}

function utcNowIso() {
  return new Date().toISOString()
}

function wrapRepositoryError(err) {
  if (err instanceof OrdersStoreError) {
    throw new OrdersServiceError(err.message, err.statusCode)
  }
  throw err
}

function findOrderIndex(orders, orderId) {
  return orders.findIndex((o) => o?.orderId === orderId || o?.id === orderId)
}

export async function getOrder(orderId) {
  const id = String(orderId || '').trim()
  if (!id) return null

  try {
    const orders = await readOrders()
    const raw = orders.find((o) => o?.orderId === id || o?.id === id)
    return raw ? normalizeOrder(raw) : null
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export function createOrderId() {
  return uuidv4()
}

function buildOrderItems(orderItems) {
  return (orderItems ?? []).map((item) => {
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unitPrice ?? 0)
    return {
      productId: item.productId,
      title: item.title ?? '',
      unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
    }
  })
}

/**
 * Tras preferencia MP OK: upsert cliente (si hay email) y persiste una sola orden
 * en data/orders.json con customerId y preferenceId.
 */
export async function finalizeCheckoutOrder({
  orderId,
  orderItems,
  total,
  buyerInput = null,
  preferenceId,
}) {
  const id = String(orderId || '').trim()
  if (!id) throw new OrdersServiceError('orderId requerido')
  if (!preferenceId) {
    throw new OrdersServiceError('preferenceId requerido para persistir la orden')
  }

  const buyer = normalizeBuyerInput(buyerInput)
  const now = utcNowIso()
  let customerId = null

  if (buyer.email) {
    customerId = await upsertFromBuyer(buyer)
  }

  const order = normalizeOrder({
    id,
    orderId: id,
    customerId,
    status: 'pending',
    items: buildOrderItems(orderItems),
    total,
    buyer,
    mercadoPago: {
      preferenceId: String(preferenceId),
      paymentId: '',
      status: '',
    },
    preferenceId: String(preferenceId),
    delivery: { status: 'pending', downloadLinks: [], sentAt: null },
    createdAt: now,
    updatedAt: now,
  })

  try {
    const orders = await readOrders()
    if (findOrderIndex(orders, id) !== -1) {
      throw new OrdersServiceError(`Ya existe una orden con id: ${id}`, 409)
    }
    orders.push(toPersistedOrder(order))
    await writeOrders(orders)
    return order
  } catch (err) {
    if (err instanceof OrdersServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function createPendingOrder(
  orderItems,
  total,
  buyerInput = null,
  { orderId: presetOrderId = null, preferenceId = null } = {},
) {
  return finalizeCheckoutOrder({
    orderId: presetOrderId || uuidv4(),
    orderItems,
    total,
    buyerInput,
    preferenceId: preferenceId || 'manual',
  })
}

export async function attachBuyerToOrder(orderId, buyerInput = null) {
  const id = String(orderId || '').trim()
  if (!id) throw new OrdersServiceError('id requerido')

  const buyer = normalizeBuyerInput(buyerInput)
  if (!buyer.email) {
    return getOrder(id)
  }

  try {
    const customerId = await upsertFromBuyer(buyer)
    if (!customerId) return getOrder(id)

    const orders = await readOrders()
    const index = findOrderIndex(orders, id)
    if (index === -1) throw new OrdersServiceError('Orden no encontrada', 404)

    const order = normalizeOrder(orders[index])
    order.customerId = customerId
    order.buyer = buyer
    order.updatedAt = utcNowIso()
    orders[index] = toPersistedOrder(order)
    await writeOrders(orders)
    return normalizeOrder(orders[index])
  } catch (err) {
    if (err instanceof OrdersServiceError) throw err
    wrapRepositoryError(err)
  }
}

export async function updatePreferenceId(orderId, preferenceId) {
  const id = String(orderId || '').trim()
  if (!id) return

  try {
    const orders = await readOrders()
    const index = findOrderIndex(orders, id)
    if (index === -1) return

    const order = normalizeOrder(orders[index])
    order.mercadoPago.preferenceId = preferenceId
    order.preferenceId = preferenceId
    order.updatedAt = utcNowIso()
    orders[index] = toPersistedOrder(order)
    await writeOrders(orders)
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function updateOrderPaymentState(orderId, { status, payment, paidAt = null }) {
  const id = String(orderId || '').trim()
  if (!id) return null

  try {
    const orders = await readOrders()
    const index = findOrderIndex(orders, id)
    if (index === -1) return null

    const order = normalizeOrder(orders[index])
    if (order.status === 'paid') return order

    order.status = status
    order.updatedAt = utcNowIso()
    order.payment = payment ?? order.payment
    if (payment) {
      order.mercadoPago.paymentId = String(payment.payment_id ?? order.mercadoPago.paymentId)
      order.mercadoPago.status = String(payment.payment_status ?? order.mercadoPago.status)
    }
    if (paidAt != null) order.paidAt = paidAt

    if (status === 'paid') {
      const customerId = await upsertFromBuyer(order.buyer)
      if (customerId) {
        order.customerId = customerId
        await recalculateCustomerStats(customerId)
      }
    }

    orders[index] = toPersistedOrder(order)
    await writeOrders(orders)
    return normalizeOrder(orders[index])
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function touchOrderPaymentWebhook(orderId, paymentPatch) {
  const id = String(orderId || '').trim()
  if (!id) return null

  try {
    const orders = await readOrders()
    const index = findOrderIndex(orders, id)
    if (index === -1) return null

    const order = normalizeOrder(orders[index])
    order.payment = { ...(order.payment || {}), ...paymentPatch }
    if (paymentPatch.payment_id) {
      order.mercadoPago.paymentId = String(paymentPatch.payment_id)
    }
    if (paymentPatch.payment_status) {
      order.mercadoPago.status = String(paymentPatch.payment_status)
    }
    order.updatedAt = utcNowIso()
    orders[index] = toPersistedOrder(order)
    await writeOrders(orders)
    return order
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function touchPaidOrderWebhook(orderId, paymentPatch) {
  const order = await getOrder(orderId)
  if (!order || order.status !== 'paid') return order
  return touchOrderPaymentWebhook(orderId, paymentPatch)
}

function matchesOrderQuery(order, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  const itemTitles = order.items.map((i) => i.title).join(' ')
  const haystack = [
    order.orderId,
    order.buyer?.email,
    order.buyer?.name,
    itemTitles,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function inDateRange(isoDate, from, to) {
  if (!isoDate) return true
  const ts = Date.parse(isoDate)
  if (Number.isNaN(ts)) return true
  if (from) {
    const fromTs = Date.parse(from)
    if (!Number.isNaN(fromTs) && ts < fromTs) return false
  }
  if (to) {
    const toTs = Date.parse(to)
    if (!Number.isNaN(toTs) && ts > toTs) return false
  }
  return true
}

export async function listOrders({ status, q, from, to } = {}) {
  try {
    let orders = (await readOrders()).map(normalizeOrder)

    if (status) {
      orders = orders.filter((o) => o.status === status)
    }
    if (q) orders = orders.filter((o) => matchesOrderQuery(o, String(q).trim()))
    if (from || to) {
      orders = orders.filter((o) => inDateRange(o.createdAt, from, to))
    }

    orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return orders
  } catch (err) {
    wrapRepositoryError(err)
  }
}

export async function getOrderById(orderId) {
  const order = await getOrder(orderId)
  if (!order) throw new OrdersServiceError('Orden no encontrada', 404)
  return order
}

export async function updateOrderStatusAdmin(orderId, nextStatus) {
  const id = String(orderId || '').trim()
  const status = String(nextStatus || '').trim()
  if (!id) throw new OrdersServiceError('id requerido')
  if (!status) throw new OrdersServiceError('status requerido')

  try {
    const orders = await readOrders()
    const index = findOrderIndex(orders, id)
    if (index === -1) throw new OrdersServiceError('Orden no encontrada', 404)

    const order = normalizeOrder(orders[index])
    const transitionError = validateAdminStatusTransition(order.status, status)
    if (transitionError) throw new OrdersServiceError(transitionError)

    order.status = status
    order.updatedAt = utcNowIso()
    if (status === 'delivered') {
      order.deliveredAt = utcNowIso()
      order.delivery = {
        ...order.delivery,
        status: 'delivered',
      }
    }

    orders[index] = toPersistedOrder(order)
    await writeOrders(orders)
    return normalizeOrder(orders[index])
  } catch (err) {
    if (err instanceof OrdersServiceError) throw err
    wrapRepositoryError(err)
  }
}

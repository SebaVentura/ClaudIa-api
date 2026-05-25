function utcNowIso() {
  return new Date().toISOString()
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unitPrice ?? 0)
    const subtotal = Number.isFinite(Number(item.subtotal))
      ? Number(item.subtotal)
      : unitPrice * quantity
    return {
      productId: item.productId,
      title: item.title ?? '',
      unitPrice,
      quantity,
      subtotal,
    }
  })
}

function normalizeBuyer(raw) {
  const buyer = raw?.buyer && typeof raw.buyer === 'object' ? raw.buyer : {}
  const email = String(buyer.email ?? raw.buyerEmail ?? '').trim()
  return {
    name: String(buyer.name ?? '').trim(),
    email,
    phone: String(buyer.phone ?? '').trim(),
  }
}

function normalizeMercadoPago(raw) {
  const legacyPayment = raw?.payment && typeof raw.payment === 'object' ? raw.payment : {}
  const mp = raw?.mercadoPago && typeof raw.mercadoPago === 'object' ? raw.mercadoPago : {}
  return {
    preferenceId: String(mp.preferenceId ?? raw.preferenceId ?? '').trim(),
    paymentId: String(mp.paymentId ?? legacyPayment.payment_id ?? '').trim(),
    status: String(mp.status ?? legacyPayment.payment_status ?? '').trim(),
  }
}

function legacyPaymentBlock(mercadoPago, rawPayment) {
  if (rawPayment && typeof rawPayment === 'object' && Object.keys(rawPayment).length) {
    return rawPayment
  }
  if (!mercadoPago.paymentId && !mercadoPago.status) return rawPayment || {}
  return {
    payment_id: mercadoPago.paymentId,
    payment_status: mercadoPago.status,
  }
}

export function normalizeOrder(raw) {
  const order = raw && typeof raw === 'object' ? raw : {}
  const orderId = String(order.orderId ?? order.id ?? '').trim()
  const buyer = normalizeBuyer(order)
  const mercadoPago = normalizeMercadoPago(order)
  const payment = legacyPaymentBlock(mercadoPago, order.payment)

  return {
    id: orderId,
    orderId,
    customerId: order.customerId ?? null,
    status: order.status ?? 'pending',
    items: normalizeItems(order.items),
    total: Number(order.total ?? 0),
    buyer,
    mercadoPago,
    payment,
    preferenceId: mercadoPago.preferenceId || null,
    buyerEmail: buyer.email || order.buyerEmail || null,
    delivery: {
      status: order.delivery?.status ?? 'pending',
      downloadLinks: Array.isArray(order.delivery?.downloadLinks)
        ? order.delivery.downloadLinks
        : [],
      sentAt: order.delivery?.sentAt ?? null,
    },
    createdAt: order.createdAt ?? utcNowIso(),
    paidAt: order.paidAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    updatedAt: order.updatedAt ?? order.createdAt ?? null,
  }
}

export function toPersistedOrder(order) {
  const normalized = normalizeOrder(order)
  return {
    id: normalized.id,
    orderId: normalized.orderId,
    customerId: normalized.customerId,
    status: normalized.status,
    items: normalized.items,
    total: normalized.total,
    buyer: normalized.buyer,
    mercadoPago: normalized.mercadoPago,
    delivery: normalized.delivery,
    createdAt: normalized.createdAt,
    paidAt: normalized.paidAt,
    deliveredAt: normalized.deliveredAt,
    updatedAt: normalized.updatedAt,
    payment: normalized.payment,
    preferenceId: normalized.preferenceId,
    buyerEmail: normalized.buyerEmail,
  }
}

export function normalizeBuyerInput(input) {
  if (input == null) {
    return { name: '', email: '', phone: '' }
  }
  if (typeof input === 'string') {
    return { name: '', email: input.trim(), phone: '' }
  }
  if (typeof input === 'object') {
    return {
      name: String(input.name ?? '').trim(),
      email: String(input.email ?? '').trim(),
      phone: String(input.phone ?? '').trim(),
    }
  }
  return { name: '', email: '', phone: '' }
}

import { listCustomers } from './customersService.js'
import { listOrders } from './ordersService.js'
import { listProducts } from './productsService.js'

const AR_TZ = 'America/Argentina/Buenos_Aires'

const PERIOD_CONFIG = {
  today: { days: 1, label: 'Hoy' },
  '7d': { days: 7, label: 'Últimos 7 días' },
  '30d': { days: 30, label: 'Últimos 30 días' },
  month: { monthCurrent: true, label: 'Mes actual' },
}

function toArDateKey(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function startOfTodayArIso() {
  const now = new Date()
  const key = toArDateKey(now)
  return `${key}T00:00:00`
}

function startOfMonthArIso() {
  const now = new Date()
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
  }).format(now)
  return `${month}-01T00:00:00`
}

function resolvePeriod(periodRaw) {
  const period = String(periodRaw || '7d').toLowerCase()
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG['7d']
  const now = new Date()

  if (config.monthCurrent) {
    const fromIso = startOfMonthArIso()
    return { key: period in PERIOD_CONFIG ? period : '7d', label: config.label, fromIso, toIso: now.toISOString() }
  }

  if (config.days === 1) {
    const fromIso = startOfTodayArIso()
    return { key: period in PERIOD_CONFIG ? period : '7d', label: config.label, fromIso, toIso: now.toISOString() }
  }

  const from = new Date(now)
  from.setDate(from.getDate() - (config.days - 1))
  return {
    key: period in PERIOD_CONFIG ? period : '7d',
    label: config.label,
    fromIso: from.toISOString(),
    toIso: now.toISOString(),
  }
}

function isInRange(isoDate, fromIso, toIso) {
  if (!isoDate) return false
  const ts = Date.parse(isoDate)
  if (Number.isNaN(ts)) return false
  return ts >= Date.parse(fromIso) && ts <= Date.parse(toIso)
}

function toMoney(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function normalizeOrderDate(order) {
  return order.paidAt || order.createdAt || null
}

export async function getDashboardSummary({ period = '7d' } = {}) {
  const periodInfo = resolvePeriod(period)
  const [orders, customers, products] = await Promise.all([
    listOrders(),
    listCustomers(),
    listProducts(),
  ])

  const ordersInRange = orders.filter((o) =>
    isInRange(normalizeOrderDate(o), periodInfo.fromIso, periodInfo.toIso),
  )
  const paidOrders = ordersInRange.filter((o) => o.status === 'paid')
  const pendingOrders = ordersInRange.filter((o) => o.status === 'pending')
  const rejectedOrCancelled = ordersInRange.filter((o) =>
    ['rejected', 'cancelled'].includes(String(o.status)),
  )

  const revenueTotal = paidOrders.reduce((sum, o) => sum + toMoney(o.total), 0)
  const avgTicket = paidOrders.length > 0 ? revenueTotal / paidOrders.length : 0
  const productsSold = paidOrders.reduce(
    (sum, o) => sum + o.items.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    0,
  )

  const customerIdsInPaid = new Set(
    paidOrders.map((o) => o.customerId).filter(Boolean),
  )

  const customerFirstPaid = new Map()
  for (const order of orders.filter((o) => o.status === 'paid')) {
    if (!order.customerId) continue
    const dateIso = normalizeOrderDate(order)
    if (!dateIso) continue
    const prev = customerFirstPaid.get(order.customerId)
    if (!prev || Date.parse(dateIso) < Date.parse(prev)) {
      customerFirstPaid.set(order.customerId, dateIso)
    }
  }

  let newCustomers = 0
  for (const customerId of customerIdsInPaid) {
    const firstPaid = customerFirstPaid.get(customerId)
    if (firstPaid && isInRange(firstPaid, periodInfo.fromIso, periodInfo.toIso)) {
      newCustomers += 1
    }
  }

  const salesByDayMap = new Map()
  for (const order of paidOrders) {
    const key = toArDateKey(normalizeOrderDate(order))
    if (!key) continue
    const current = salesByDayMap.get(key) || { date: key, revenue: 0, orders: 0 }
    current.revenue += toMoney(order.total)
    current.orders += 1
    salesByDayMap.set(key, current)
  }
  const salesByDay = Array.from(salesByDayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  const productSales = new Map()
  for (const order of paidOrders) {
    for (const item of order.items || []) {
      const key = String(item.productId || item.title || '').trim()
      if (!key) continue
      const current = productSales.get(key) || {
        productId: key,
        title: String(item.title || key),
        quantity: 0,
        revenue: 0,
      }
      const quantity = Number(item.quantity || 0)
      const subtotal = Number(item.subtotal || (item.unitPrice || 0) * quantity)
      current.quantity += quantity
      current.revenue += toMoney(subtotal)
      productSales.set(key, current)
    }
  }

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 8)

  const recentOrders = [...ordersInRange]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 8)
    .map((o) => ({
      orderId: o.orderId,
      createdAt: o.createdAt,
      status: o.status,
      total: toMoney(o.total),
      customerEmail: o.buyer?.email || o.buyerEmail || '',
      customerName: o.buyer?.name || '',
    }))

  const bestDay = salesByDay.reduce(
    (best, day) => (day.revenue > best.revenue ? day : best),
    { date: null, revenue: 0, orders: 0 },
  )

  const topProduct = topProducts[0] || null

  return {
    period: periodInfo,
    kpis: {
      revenueTotal,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      rejectedOrCancelledOrders: rejectedOrCancelled.length,
      averageTicket: avgTicket,
      customersTotal: customers.length,
      newCustomers,
      productsTotal: products.length,
      productsSold,
    },
    salesByDay,
    topProducts,
    recentOrders,
    insights: {
      topProduct: topProduct
        ? {
            productId: topProduct.productId,
            title: topProduct.title,
            quantity: topProduct.quantity,
            revenue: topProduct.revenue,
          }
        : null,
      bestDay: bestDay.date ? bestDay : null,
      pendingToReview: pendingOrders.length,
      averageTicket: avgTicket,
      revenueTotal,
    },
    trafficPlaceholders: [
      { key: 'visits', title: 'Visitas', message: 'Requiere activar tracking' },
      { key: 'productClicks', title: 'Clicks en productos', message: 'Requiere activar tracking' },
      { key: 'abandonedCarts', title: 'Carritos abandonados', message: 'Requiere activar tracking' },
      { key: 'inquiries', title: 'Consultas', message: 'Próximamente' },
      { key: 'peakHours', title: 'Horarios de mayor tráfico', message: 'Requiere activar tracking' },
    ],
  }
}

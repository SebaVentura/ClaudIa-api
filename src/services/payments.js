import {
  MercadoPagoError,
  MercadoPagoNotFoundError,
  getPayment,
} from './mercadopagoService.js'
import {
  getOrder,
  touchOrderPaymentWebhook,
  touchPaidOrderWebhook,
  updateOrderPaymentState,
} from './ordersStore.js'

const MP_TO_INTERNAL = {
  pending: 'pending',
  in_process: 'in_process',
  approved: 'paid',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'charged_back',
}

function utcNowIso() {
  return new Date().toISOString()
}

function quantizeAmount(value) {
  return Math.round(Number(value) * 100) / 100
}

export function amountsMatch(expected, received) {
  return quantizeAmount(expected) === quantizeAmount(received)
}

function floatAmount(value) {
  return quantizeAmount(value)
}

export function isPaymentNotification(req, body) {
  const topic = req.query.topic
  const queryType = req.query.type
  const bodyType = body?.type
  const action = String(body?.action ?? '')

  if (topic && topic !== 'payment') return false
  if (queryType && queryType !== 'payment') return false
  if (bodyType && bodyType !== 'payment' && !action.includes('payment')) return false
  return true
}

export function extractPaymentId(req, body) {
  const { topic, type: queryType, id: queryId } = req.query

  if (topic === 'payment' || queryType === 'payment' || queryId) {
    if (queryId) return String(queryId).trim()
  }

  const bodyType = body?.type
  if (bodyType === 'payment' || String(body?.action ?? '').includes('payment')) {
    const dataId = body?.data?.id
    if (dataId != null) return String(dataId).trim()
  }

  if (body?.id != null) return String(body.id).trim()
  return null
}

export function mapMpStatusToInternal(mpStatus, amountValidated) {
  if (mpStatus === 'approved') {
    return amountValidated ? 'paid' : 'amount_mismatch'
  }
  return MP_TO_INTERNAL[mpStatus] ?? 'pending'
}

export function buildPaymentBlock(payment, { webhookAt, amountValidated, expected }) {
  const received = payment.transaction_amount ?? 0
  return {
    payment_id: String(payment.id ?? ''),
    payment_status: payment.status,
    payment_status_detail: payment.status_detail,
    transaction_amount: received,
    currency_id: payment.currency_id,
    payment_method_id: payment.payment_method_id,
    date_approved: payment.date_approved ?? null,
    webhook_received_at: webhookAt,
    amount_validated: amountValidated,
    expected_amount: floatAmount(expected),
    received_amount: floatAmount(received),
  }
}

export async function processMercadopagoWebhook(req) {
  const webhookAt = utcNowIso()
  const body = req.body && typeof req.body === 'object' ? req.body : {}

  if (!isPaymentNotification(req, body)) {
    console.log('Webhook ignorado: no corresponde a payment')
    return { ok: true, ignored: true, reason: 'not_payment_notification' }
  }

  const paymentId = extractPaymentId(req, body)
  if (!paymentId) {
    console.warn('Webhook sin payment_id')
    return { ok: true, reason: 'missing_payment_id' }
  }

  console.log('Webhook payment_id=%s', paymentId)

  let payment
  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    if (err instanceof MercadoPagoNotFoundError) {
      console.warn('Pago no encontrado en MP:', paymentId)
      return { ok: true, reason: 'payment_not_found' }
    }
    throw err
  }

  const externalReference = (payment.external_reference || '').trim()
  if (!externalReference) {
    console.warn('Pago sin external_reference payment_id=%s', paymentId)
    return { ok: true, reason: 'missing_external_reference' }
  }

  const order = await getOrder(externalReference)
  if (!order) {
    console.warn('Orden no encontrada orderId=%s', externalReference)
    return { ok: true, reason: 'order_not_found' }
  }

  const orderId = order.orderId
  const currentStatus = order.status
  const existingPayment = order.payment || {}
  const existingPid = String(existingPayment.payment_id ?? '')

  const expectedTotal = Number(order.total ?? 0)
  const receivedAmount = payment.transaction_amount ?? 0
  const amountValidated = amountsMatch(expectedTotal, receivedAmount)

  const paymentBlock = buildPaymentBlock(payment, {
    webhookAt,
    amountValidated,
    expected: expectedTotal,
  })

  const mpStatus = payment.status ?? ''

  if (currentStatus === 'paid') {
    if (existingPid === String(paymentId)) {
      await touchPaidOrderWebhook(orderId, { webhook_received_at: webhookAt })
      console.log('Webhook idempotente en orden paid orderId=%s', orderId)
      return { ok: true, orderId, status: 'paid', skipped: true }
    }
    console.error(
      'ALERTA: payment_id distinto en orden paid orderId=%s existing=%s incoming=%s',
      orderId,
      existingPid,
      paymentId,
    )
    return { ok: true, reason: 'paid_order_different_payment', orderId }
  }

  if (existingPid === String(paymentId)) {
    const newInternal = mapMpStatusToInternal(mpStatus, amountValidated)
    if (currentStatus === newInternal) {
      await touchOrderPaymentWebhook(orderId, { webhook_received_at: webhookAt })
      console.log('Webhook duplicado mismo estado orderId=%s status=%s', orderId, currentStatus)
      return { ok: true, orderId, status: currentStatus, skipped: true }
    }
  }

  const newStatus = mapMpStatusToInternal(mpStatus, amountValidated)
  let paidAt = null
  if (newStatus === 'paid') {
    paidAt = payment.date_approved || webhookAt
  }

  if (mpStatus === 'approved' && !amountValidated) {
    console.error(
      'Monto no coincide orderId=%s expected=%s received=%s',
      orderId,
      paymentBlock.expected_amount,
      paymentBlock.received_amount,
    )
  }

  const updated = await updateOrderPaymentState(orderId, {
    status: newStatus,
    payment: paymentBlock,
    paidAt,
  })

  if (!updated) {
    console.warn('No se pudo actualizar orden orderId=%s', orderId)
    return { ok: true, reason: 'order_update_failed' }
  }

  console.log(
    'Orden actualizada orderId=%s status=%s mp_status=%s amount_validated=%s',
    orderId,
    newStatus,
    mpStatus,
    amountValidated,
  )

  return {
    ok: true,
    orderId,
    status: newStatus,
    paymentStatus: mpStatus,
    amountValidated,
  }
}

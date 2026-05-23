import { config } from '../config/env.js'

const MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences'
const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments'

export class MercadoPagoError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'MercadoPagoError'
    this.statusCode = statusCode
  }
}

export class MercadoPagoNotFoundError extends MercadoPagoError {
  constructor(message = 'Pago no encontrado en Mercado Pago') {
    super(message, 404)
    this.name = 'MercadoPagoNotFoundError'
  }
}

function mpHeaders() {
  if (!config.mpAccessToken) {
    throw new MercadoPagoError('Mercado Pago no está configurado en el backend', 500)
  }
  return {
    Authorization: `Bearer ${config.mpAccessToken}`,
    'Content-Type': 'application/json',
  }
}

function shouldIncludeAutoReturn(appUrl) {
  const lower = appUrl.toLowerCase()
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false
  return appUrl.startsWith('https://')
}

function resolveInitPoint(preference) {
  const point =
    config.mpEnv === 'sandbox'
      ? preference.sandbox_init_point || preference.init_point
      : preference.init_point || preference.sandbox_init_point
  if (!point) {
    throw new MercadoPagoError('Mercado Pago no devolvió URL de checkout', 502)
  }
  return point
}

async function parseMpError(response) {
  const bodyText = await response.text()
  const parts = []
  try {
    const body = bodyText.trim() ? JSON.parse(bodyText) : {}
    for (const key of ['message', 'error', 'cause']) {
      if (body[key] != null && body[key] !== '') parts.push(`${key}: ${body[key]}`)
    }
  } catch {
    if (bodyText.trim()) parts.push(bodyText.trim().slice(0, 500))
  }
  console.error('Mercado Pago error status:', response.status, 'body:', bodyText.slice(0, 500))
  return parts.length ? parts.join(' | ') : 'Revisar logs del backend.'
}

export async function createCheckoutPreference(orderId, mpItems, buyerEmail = null) {
  const appUrl = config.appUrl
  const includeAutoReturn = shouldIncludeAutoReturn(appUrl)

  const payload = {
    items: mpItems,
    external_reference: orderId,
    back_urls: {
      success: `${appUrl}/gracias?orderId=${orderId}&status=success`,
      failure: `${appUrl}/gracias?orderId=${orderId}&status=failure`,
      pending: `${appUrl}/gracias?orderId=${orderId}&status=pending`,
    },
    metadata: {
      order_id: orderId,
      source: 'claudia_landing',
    },
  }

  if (includeAutoReturn) payload.auto_return = 'approved'
  if (buyerEmail?.trim()) payload.payer = { email: buyerEmail.trim() }

  console.log('Mercado Pago preference payload (sanitized):', JSON.stringify(payload))
  console.log('auto_return included:', includeAutoReturn ? 'yes' : 'no')

  let response
  try {
    response = await fetch(MP_PREFERENCES_URL, {
      method: 'POST',
      headers: mpHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    throw new MercadoPagoError(
      isTimeout ? 'Timeout conectando con Mercado Pago' : 'No se pudo conectar con Mercado Pago',
      503,
    )
  }

  console.log('Mercado Pago preference response status:', response.status)

  if (response.status >= 400) {
    const detail = await parseMpError(response)
    const statusCode = response.status >= 500 ? 502 : 400
    throw new MercadoPagoError(`Mercado Pago rechazó la preferencia: ${detail}`, statusCode)
  }

  const data = await response.json()
  return {
    preferenceId: data.id,
    initPoint: resolveInitPoint(data),
  }
}

export async function getPayment(paymentId) {
  const url = `${MP_PAYMENTS_URL}/${paymentId}`

  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: mpHeaders(),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    throw new MercadoPagoError(
      isTimeout ? 'Timeout consultando pago en Mercado Pago' : 'No se pudo conectar con Mercado Pago',
      503,
    )
  }

  console.log('Mercado Pago payment response status:', response.status, 'payment_id=', paymentId)

  if (response.status === 404) {
    throw new MercadoPagoNotFoundError()
  }

  if (response.status >= 500) {
    throw new MercadoPagoError('Mercado Pago no disponible al consultar el pago', 503)
  }

  if (response.status >= 400) {
    const detail = await parseMpError(response)
    throw new MercadoPagoError(`Mercado Pago rechazó la consulta del pago: ${detail}`, 400)
  }

  const data = await response.json()
  if (!data || typeof data !== 'object') {
    throw new MercadoPagoError('Respuesta de pago inválida', 502)
  }
  return data
}

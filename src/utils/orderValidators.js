const ADMIN_ALLOWED_TRANSITIONS = {
  pending: new Set(['cancelled']),
  paid: new Set(['delivered']),
}

const ADMIN_MANUAL_STATUSES = new Set(['cancelled', 'delivered'])

export function validateAdminStatusTransition(currentStatus, nextStatus) {
  const current = String(currentStatus || '').trim()
  const next = String(nextStatus || '').trim()

  if (!ADMIN_MANUAL_STATUSES.has(next)) {
    return `Estado "${next}" no puede asignarse manualmente desde admin`
  }

  if (next === 'paid') {
    return 'No se puede marcar paid manualmente desde admin'
  }

  const allowed = ADMIN_ALLOWED_TRANSITIONS[current]
  if (!allowed?.has(next)) {
    return `Transición no permitida: ${current} → ${next}`
  }

  return null
}

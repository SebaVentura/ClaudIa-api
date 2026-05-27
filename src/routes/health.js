import { Router } from 'express'
import { config } from '../config/env.js'
import { getMongoHealthState } from '../config/mongo.js'

const router = Router()

function buildHealthPayload() {
  const mongo = getMongoHealthState()
  const mongoRequired = mongo.configured
  const serviceOk = !mongoRequired || mongo.connected

  return {
    status: serviceOk ? 'ok' : 'degraded',
    service: 'claudia-api',
    phase: 5,
    runtime: 'node',
    ok: serviceOk,
    environment: config.nodeEnv,
    persistence: 'json',
    mongo: {
      configured: mongo.configured,
      connected: mongo.connected,
    },
  }
}

function handleHealth(_req, res) {
  const body = buildHealthPayload()
  const statusCode = body.ok ? 200 : 503
  res.status(statusCode).json(body)
}

router.get('/api/health', handleHealth)
router.get('/health', handleHealth)

export default router

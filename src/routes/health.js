import { Router } from 'express'
import { config } from '../config/env.js'
import { getMongoHealthState } from '../config/mongo.js'
import { describeStorageBackend, getStorageBackend } from '../config/persistence.js'

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
    mongo: {
      configured: mongo.configured,
      connected: mongo.connected,
    },
    storage: {
      backend: getStorageBackend(),
      description: describeStorageBackend(),
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

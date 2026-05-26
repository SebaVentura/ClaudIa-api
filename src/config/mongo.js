import mongoose from 'mongoose'
import { config, isMongoConfigured } from './env.js'

let listenersRegistered = false
let lastConnectError = null

function redactMongoUri(uri) {
  try {
    const parsed = new URL(uri)
    if (parsed.password) parsed.password = '***'
    if (parsed.username) parsed.username = '***'
    return parsed.toString()
  } catch {
    return 'mongodb://<redacted>'
  }
}

function registerConnectionListeners() {
  if (listenersRegistered) return
  listenersRegistered = true

  mongoose.connection.on('connected', () => {
    console.log('[MONGO] Connected')
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[MONGO] Disconnected')
  })

  mongoose.connection.on('error', (err) => {
    console.error('[MONGO] Connection error:', err.message)
  })
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1
}

export function getMongoHealthState() {
  const configured = isMongoConfigured()
  return {
    configured,
    connected: configured ? isMongoConnected() : false,
    error: lastConnectError?.message ?? null,
  }
}

/**
 * Intenta conectar a MongoDB. No lanza si falla (etapa inicial: JSON sigue operativo).
 * @returns {Promise<{ connected: boolean, skipped: boolean, error?: Error }>}
 */
export async function connectMongo() {
  registerConnectionListeners()

  if (!isMongoConfigured()) {
    console.log('[MONGO] Skipped (MONGODB_URI o MONGODB_DB no configurados)')
    return { connected: false, skipped: true }
  }

  if (isMongoConnected()) {
    return { connected: true, skipped: false }
  }

  console.log('[MONGO] Connecting...', redactMongoUri(config.mongodbUri))

  try {
    lastConnectError = null
    await mongoose.connect(config.mongodbUri, {
      dbName: config.mongodbDb,
      serverSelectionTimeoutMS: 10_000,
    })
    return { connected: true, skipped: false }
  } catch (err) {
    lastConnectError = err
    console.error('[MONGO] Connection error:', err.message)
    return { connected: false, skipped: false, error: err }
  }
}

export async function closeMongo() {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
  console.log('[MONGO] Disconnected')
}

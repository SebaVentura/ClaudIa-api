import { isMongoConfigured } from './env.js'
import { isMongoConnected } from './mongo.js'

/**
 * STORAGE_BACKEND:
 * - auto (default): Mongo si está configurado y conectado; si no, JSON.
 * - mongo: fuerza Mongo (error si no conectado).
 * - json: fuerza JSON (rollback).
 */
export function getStorageBackend() {
  const mode = (process.env.STORAGE_BACKEND || 'auto').trim().toLowerCase()
  if (mode === 'json') return 'json'
  if (mode === 'mongo') return 'mongo'
  if (mode === 'auto') {
    return isMongoConfigured() && isMongoConnected() ? 'mongo' : 'json'
  }
  console.warn(`[STORAGE] STORAGE_BACKEND inválido "${mode}", usando auto`)
  return isMongoConfigured() && isMongoConnected() ? 'mongo' : 'json'
}

export function useMongoPersistence() {
  return getStorageBackend() === 'mongo'
}

export function describeStorageBackend() {
  const backend = getStorageBackend()
  const mode = (process.env.STORAGE_BACKEND || 'auto').trim().toLowerCase()
  if (backend === 'mongo') {
    return `mongo (mode=${mode})`
  }
  if (isMongoConfigured() && !isMongoConnected()) {
    return `json (mode=${mode}, Mongo configurado pero sin conexión)`
  }
  return `json (mode=${mode})`
}

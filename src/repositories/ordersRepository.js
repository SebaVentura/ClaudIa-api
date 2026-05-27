import { getStorageBackend } from '../config/persistence.js'
import * as jsonRepo from './json/ordersRepository.js'
import * as mongoRepo from './mongo/ordersRepository.js'

export { OrdersStoreError } from './json/ordersRepository.js'

function backend() {
  return getStorageBackend() === 'mongo' ? mongoRepo : jsonRepo
}

export async function readAll() {
  return backend().readAll()
}

export async function writeAll(orders) {
  return backend().writeAll(orders)
}

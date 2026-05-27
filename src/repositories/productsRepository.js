import { getStorageBackend } from '../config/persistence.js'
import * as jsonRepo from './json/productsRepository.js'
import * as mongoRepo from './mongo/productsRepository.js'

export { ProductsRepositoryError } from './json/productsRepository.js'

function backend() {
  return getStorageBackend() === 'mongo' ? mongoRepo : jsonRepo
}

export async function readAll() {
  return backend().readAll()
}

export async function writeAll(products) {
  return backend().writeAll(products)
}

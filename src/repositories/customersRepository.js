import { useMongoPersistence } from '../config/persistence.js'
import * as jsonRepo from './json/customersRepository.js'
import * as mongoRepo from './mongo/customersRepository.js'

export { CustomersStoreError } from './json/customersRepository.js'

function backend() {
  return useMongoPersistence() ? mongoRepo : jsonRepo
}

export async function readAll() {
  return backend().readAll()
}

export async function writeAll(customers) {
  return backend().writeAll(customers)
}

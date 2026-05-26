import { Customer } from '../../models/Customer.js'
import { leanDocs } from '../../utils/mongoDocument.js'
import { CustomersStoreError } from '../json/customersRepository.js'

function prepareCustomer(doc) {
  const customer = { ...doc }
  if (!customer.id) {
    throw new CustomersStoreError('Cliente sin id')
  }
  customer.email = String(customer.email || '')
    .trim()
    .toLowerCase()
  return customer
}

export async function readAll() {
  try {
    const docs = await Customer.find({}).sort({ updatedAt: -1 }).lean()
    return leanDocs(docs)
  } catch (err) {
    console.error('[MONGO] customers readAll:', err.message)
    throw new CustomersStoreError('No se pudo leer el almacén de clientes')
  }
}

export async function writeAll(customers) {
  if (!Array.isArray(customers)) {
    throw new CustomersStoreError('Almacén de clientes corrupto al guardar')
  }

  try {
    const ops = customers.map((raw) => {
      const customer = prepareCustomer(raw)
      return {
        updateOne: {
          filter: { id: customer.id },
          update: { $set: customer },
          upsert: true,
        },
      }
    })

    if (ops.length) {
      await Customer.bulkWrite(ops, { ordered: false })
    }
  } catch (err) {
    console.error('[MONGO] customers writeAll:', err.message)
    if (err.code === 11000) {
      throw new CustomersStoreError('Cliente duplicado (email o id)', 409)
    }
    throw new CustomersStoreError('No se pudo guardar el almacén de clientes')
  }
}

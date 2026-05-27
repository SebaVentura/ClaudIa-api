/**
 * Migra data/*.json → MongoDB (idempotente, no borra JSON ni documentos huérfanos en Mongo).
 *
 * Uso:
 *   node scripts/migrate-json-to-mongo.js
 *   node scripts/migrate-json-to-mongo.js --dry-run
 */
import fs from 'fs/promises'
import { config, isMongoConfigured, SERVER_ROOT } from '../src/config/env.js'
import { connectMongo, closeMongo } from '../src/config/mongo.js'
import { Product } from '../src/models/Product.js'
import { Customer } from '../src/models/Customer.js'
import { Order } from '../src/models/Order.js'

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') }
}

async function readJsonArray(filePath, label) {
  const raw = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new Error(`${label}: se esperaba un array en ${filePath}`)
  }
  return data
}

function prepareProduct(doc, index) {
  const product = { ...doc }
  if (!product.id) throw new Error('Producto sin id')
  const link = product.downloadLink ?? product.deliveryUrl ?? product.downloadUrl ?? ''
  product.deliveryUrl = product.deliveryUrl ?? link
  product.downloadUrl = product.downloadUrl ?? link
  if (typeof index === 'number' && index >= 0) {
    product.position = index
  }
  return product
}

function prepareCustomer(doc) {
  const customer = { ...doc }
  if (!customer.id) throw new Error('Cliente sin id')
  customer.email = String(customer.email || '')
    .trim()
    .toLowerCase()
  return customer
}

function prepareOrder(doc) {
  const order = { ...doc }
  const orderId = String(order.orderId ?? order.id ?? '').trim()
  if (!orderId) throw new Error('Orden sin orderId/id')
  order.orderId = orderId
  order.id = orderId
  return order
}

async function upsertCollection({
  Model,
  items,
  filterKey,
  prepare,
  label,
  dryRun,
  withIndex = false,
}) {
  const summary = { total: items.length, upserted: 0, updated: 0, unchanged: 0, errors: 0 }

  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i]
    try {
      const doc = withIndex ? prepare(raw, i) : prepare(raw)
      const filter = { [filterKey]: doc[filterKey] }

      if (dryRun) {
        const exists = await Model.exists(filter)
        if (exists) summary.updated += 1
        else summary.upserted += 1
        continue
      }

      const result = await Model.updateOne(filter, { $set: doc }, { upsert: true })
      if (result.upsertedCount > 0) summary.upserted += 1
      else if (result.modifiedCount > 0) summary.updated += 1
      else summary.unchanged += 1
    } catch (err) {
      summary.errors += 1
      console.error(`[${label}] Error en documento:`, err.message)
    }
  }

  return summary
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2))

  if (!isMongoConfigured()) {
    console.error('Configurar MONGO_URI en .env')
    process.exit(1)
  }

  console.log('=== Migración JSON → MongoDB ===')
  console.log('Raíz:', SERVER_ROOT)
  console.log('DB:', config.mongoDb || '(desde URI)')
  if (dryRun) console.log('Modo: DRY-RUN (sin escritura)')

  const mongo = await connectMongo()
  if (!mongo.connected) {
    console.error('No se pudo conectar a MongoDB')
    process.exit(1)
  }

  const products = await readJsonArray(config.productsPath, 'products')
  const orders = await readJsonArray(config.ordersPath, 'orders')
  const customers = await readJsonArray(config.customersPath, 'customers')

  const productsSummary = await upsertCollection({
    Model: Product,
    items: products,
    filterKey: 'id',
    prepare: prepareProduct,
    label: 'products',
    dryRun,
    withIndex: true,
  })

  const customersSummary = await upsertCollection({
    Model: Customer,
    items: customers,
    filterKey: 'id',
    prepare: prepareCustomer,
    label: 'customers',
    dryRun,
  })

  const ordersSummary = await upsertCollection({
    Model: Order,
    items: orders,
    filterKey: 'orderId',
    prepare: prepareOrder,
    label: 'orders',
    dryRun,
  })

  console.log('\n--- Resumen ---')
  console.log('products:', productsSummary)
  console.log('customers:', customersSummary)
  console.log('orders:', ordersSummary)
  console.log('\nLos archivos JSON no fueron modificados.')

  await closeMongo()
}

main().catch((err) => {
  console.error('Migración fallida:', err.message)
  process.exit(1)
})

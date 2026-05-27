/**
 * Verifica conteos y claves en MongoDB vs JSON local.
 */
import fs from 'fs/promises'
import { config, isMongoConfigured } from '../src/config/env.js'
import { connectMongo, closeMongo } from '../src/config/mongo.js'
import { Product } from '../src/models/Product.js'
import { Customer } from '../src/models/Customer.js'
import { Order } from '../src/models/Order.js'

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function main() {
  if (!isMongoConfigured()) {
    console.error('Configurar MONGO_URI en .env')
    process.exit(1)
  }

  const mongo = await connectMongo()
  if (!mongo.connected) {
    console.error('No se pudo conectar a MongoDB')
    process.exit(1)
  }

  const [jsonProducts, jsonCustomers, jsonOrders] = await Promise.all([
    readJsonArray(config.productsPath),
    readJsonArray(config.customersPath),
    readJsonArray(config.ordersPath),
  ])

  const [mongoProducts, mongoCustomers, mongoOrders] = await Promise.all([
    Product.countDocuments(),
    Customer.countDocuments(),
    Order.countDocuments(),
  ])

  const jsonFirstProductId = jsonProducts[0]?.id ?? null
  const mongoFirst = await Product.findOne({})
    .sort({ position: 1, id: 1 })
    .select('id position title')
    .lean()
  const mongoFirstProductId = mongoFirst?.id ?? null
  const firstProductMatch = Boolean(
    jsonFirstProductId && mongoFirstProductId && jsonFirstProductId === mongoFirstProductId,
  )

  const sampleOrder = await Order.findOne({}).select('orderId status').lean()

  console.log('=== Verificación MongoDB ===')
  console.log({
    json: {
      products: jsonProducts.length,
      customers: jsonCustomers.length,
      orders: jsonOrders.length,
    },
    mongo: { products: mongoProducts, customers: mongoCustomers, orders: mongoOrders },
  })
  console.log('products order check:', {
    jsonFirstProductId,
    mongoFirstProductId,
    mongoFirstPosition: mongoFirst?.position ?? null,
    match: firstProductMatch,
  })
  if (!firstProductMatch) {
    console.warn('AVISO: el primer producto JSON y Mongo (por position) NO coinciden')
  } else {
    console.log('OK: primer producto coincide con products.json')
  }
  console.log('sampleOrder:', sampleOrder)

  await closeMongo()

  if (jsonProducts.length !== mongoProducts) {
    process.exitCode = 1
  }
  if (!firstProductMatch && jsonFirstProductId) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

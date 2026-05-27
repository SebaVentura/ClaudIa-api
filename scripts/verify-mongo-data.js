/**
 * Verifica conteos y claves en MongoDB vs JSON local.
 */
import fs from 'fs/promises'
import { config, isMongoConfigured } from '../src/config/env.js'
import { connectMongo, closeMongo } from '../src/config/mongo.js'
import { Product } from '../src/models/Product.js'
import { Customer } from '../src/models/Customer.js'
import { Order } from '../src/models/Order.js'

async function readJsonCount(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
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
    readJsonCount(config.productsPath),
    readJsonCount(config.customersPath),
    readJsonCount(config.ordersPath),
  ])

  const [mongoProducts, mongoCustomers, mongoOrders] = await Promise.all([
    Product.countDocuments(),
    Customer.countDocuments(),
    Order.countDocuments(),
  ])

  const sampleProduct = await Product.findOne({}).select('id title active').lean()
  const sampleOrder = await Order.findOne({}).select('orderId status').lean()

  console.log('=== Verificación MongoDB ===')
  console.log({
    json: { products: jsonProducts, customers: jsonCustomers, orders: jsonOrders },
    mongo: { products: mongoProducts, customers: mongoCustomers, orders: mongoOrders },
  })
  console.log('sampleProduct:', sampleProduct)
  console.log('sampleOrder:', sampleOrder)

  await closeMongo()
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

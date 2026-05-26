import cors from 'cors'
import express from 'express'
import { config } from './config/env.js'
import { connectMongo } from './config/mongo.js'
import { describeStorageBackend } from './config/persistence.js'
import healthRouter from './routes/health.js'
import productsRouter from './routes/products.js'
import checkoutRouter from './routes/checkout.js'
import webhooksRouter from './routes/webhooks.js'
import ordersRouter from './routes/orders.js'
import adminRouter from './routes/admin/index.js'

const app = express()

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
)

app.use(express.json())

app.use('/uploads', express.static(config.uploadsDir))

app.use(healthRouter)
app.use(productsRouter)
app.use(checkoutRouter)
app.use(webhooksRouter)
app.use(ordersRouter)
app.use('/api/admin', adminRouter)

async function startServer() {
  const mongo = await connectMongo()

  app.listen(config.port, () => {
    console.log(`ClaudIA API (Node) listening on http://127.0.0.1:${config.port}`)
    console.log('NODE_ENV:', config.nodeEnv)
    console.log('Products:', config.productsPath)
    console.log('Orders:', config.ordersPath)
    console.log('Customers:', config.customersPath)
    if (config.ordersPath.replace(/\\/g, '/').includes('/storage/')) {
      console.warn(
        'AVISO: ORDERS_PATH apunta a storage/. Usar ./data/orders.json para alinear con customers.',
      )
    }
    if (mongo.skipped) {
      console.log('[MONGO] No configurado — persistencia JSON activa')
    } else if (mongo.connected) {
      console.log('[MONGO] Listo')
    } else {
      console.warn(
        '[MONGO] Sin conexión — API operativa con JSON; /api/health reportará 503 para Mongo',
      )
    }
    console.log('[STORAGE]', describeStorageBackend())
    console.log('MP_ENV:', config.mpEnv)
    console.log('MP_ACCESS_TOKEN loaded:', config.mpAccessToken ? 'yes' : 'no')
    console.log('Admin auth configured:', config.adminUser && config.jwtSecret ? 'yes' : 'no')
    console.log('Uploads dir:', config.uploadsDir)
    console.log('Public uploads base:', config.publicUploadsBaseUrl)
  })
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar:', err.message)
  process.exit(1)
})

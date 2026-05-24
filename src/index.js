import cors from 'cors'
import express from 'express'
import { config } from './config/env.js'
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

app.listen(config.port, () => {
  console.log(`ClaudIA API (Node) listening on http://127.0.0.1:${config.port}`)
  console.log('Products:', config.productsPath)
  console.log('Orders:', config.ordersPath)
  console.log('MP_ENV:', config.mpEnv)
  console.log('MP_ACCESS_TOKEN loaded:', config.mpAccessToken ? 'yes' : 'no')
  console.log('Admin auth configured:', config.adminUser && config.jwtSecret ? 'yes' : 'no')
  console.log('Uploads dir:', config.uploadsDir)
  console.log('Public uploads base:', config.publicUploadsBaseUrl)
})

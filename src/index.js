import cors from 'cors'
import express from 'express'
import { config } from './config/env.js'
import healthRouter from './routes/health.js'
import productsRouter from './routes/products.js'
import checkoutRouter from './routes/checkout.js'
import webhooksRouter from './routes/webhooks.js'
import ordersRouter from './routes/orders.js'

const app = express()

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
)

app.use(express.json())

app.use(healthRouter)
app.use(productsRouter)
app.use(checkoutRouter)
app.use(webhooksRouter)
app.use(ordersRouter)

app.listen(config.port, () => {
  console.log(`ClaudIA API (Node) listening on http://127.0.0.1:${config.port}`)
  console.log('Products:', config.productsPath)
  console.log('Orders:', config.ordersPath)
  console.log('MP_ENV:', config.mpEnv)
  console.log('MP_ACCESS_TOKEN loaded:', config.mpAccessToken ? 'yes' : 'no')
})

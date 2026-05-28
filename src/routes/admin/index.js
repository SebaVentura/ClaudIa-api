import { Router } from 'express'
import authRouter from './auth.js'
import productsRouter from './products.js'
import productImagesRouter from './productImages.js'
import ordersRouter from './orders.js'
import customersRouter from './customers.js'
import dashboardRouter from './dashboard.js'

const router = Router()

router.use(authRouter)
router.use('/products', productImagesRouter)
router.use('/products', productsRouter)
router.use('/orders', ordersRouter)
router.use('/customers', customersRouter)
router.use('/dashboard', dashboardRouter)

export default router

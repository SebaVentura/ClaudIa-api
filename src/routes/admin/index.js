import { Router } from 'express'
import authRouter from './auth.js'
import productsRouter from './products.js'
import productImagesRouter from './productImages.js'

const router = Router()

router.use(authRouter)
router.use('/products', productImagesRouter)
router.use('/products', productsRouter)

export default router

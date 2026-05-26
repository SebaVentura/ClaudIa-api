import { Product } from '../../models/Product.js'
import { leanDocs } from '../../utils/mongoDocument.js'
import { ProductsRepositoryError } from '../json/productsRepository.js'

function prepareProduct(doc) {
  const product = { ...doc }
  if (!product.id) {
    throw new ProductsRepositoryError('Producto sin id')
  }
  const link = product.downloadLink ?? product.deliveryUrl ?? product.downloadUrl ?? ''
  if (!product.deliveryUrl) product.deliveryUrl = link
  if (!product.downloadUrl) product.downloadUrl = link
  return product
}

export async function readAll() {
  try {
    const docs = await Product.find({}).sort({ title: 1 }).lean()
    return leanDocs(docs).map(prepareProduct)
  } catch (err) {
    console.error('[MONGO] products readAll:', err.message)
    throw new ProductsRepositoryError('No se pudo leer el catálogo')
  }
}

export async function writeAll(products) {
  if (!Array.isArray(products)) {
    throw new ProductsRepositoryError('Formato de catálogo inválido al guardar')
  }

  try {
    const ops = products.map((raw) => {
      const product = prepareProduct(raw)
      return {
        updateOne: {
          filter: { id: product.id },
          update: { $set: product },
          upsert: true,
        },
      }
    })

    if (ops.length) {
      await Product.bulkWrite(ops, { ordered: false })
    }
  } catch (err) {
    console.error('[MONGO] products writeAll:', err.message)
    if (err.code === 11000) {
      throw new ProductsRepositoryError('Producto duplicado en catálogo', 409)
    }
    throw new ProductsRepositoryError('No se pudo guardar el catálogo')
  }
}

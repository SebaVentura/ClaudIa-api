import { Order } from '../../models/Order.js'
import { leanDocs } from '../../utils/mongoDocument.js'
import { OrdersStoreError } from '../json/ordersRepository.js'

function prepareOrder(doc) {
  const order = { ...doc }
  const orderId = String(order.orderId ?? order.id ?? '').trim()
  if (!orderId) {
    throw new OrdersStoreError('Orden sin orderId')
  }
  order.orderId = orderId
  order.id = orderId
  return order
}

export async function readAll() {
  try {
    const docs = await Order.find({}).sort({ createdAt: -1 }).lean()
    return leanDocs(docs).map(prepareOrder)
  } catch (err) {
    console.error('[MONGO] orders readAll:', err.message)
    throw new OrdersStoreError('No se pudo leer el almacén de órdenes')
  }
}

export async function writeAll(orders) {
  if (!Array.isArray(orders)) {
    throw new OrdersStoreError('Almacén de órdenes corrupto al guardar')
  }

  try {
    const ops = orders.map((raw) => {
      const order = prepareOrder(raw)
      return {
        updateOne: {
          filter: { orderId: order.orderId },
          update: { $set: order },
          upsert: true,
        },
      }
    })

    if (ops.length) {
      await Order.bulkWrite(ops, { ordered: false })
    }
  } catch (err) {
    console.error('[MONGO] orders writeAll:', err.message)
    if (err.code === 11000) {
      throw new OrdersStoreError('Orden duplicada', 409)
    }
    throw new OrdersStoreError('No se pudo guardar el almacén de órdenes')
  }
}

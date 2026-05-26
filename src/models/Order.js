import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    productId: String,
    title: String,
    unitPrice: Number,
    quantity: Number,
    subtotal: Number,
  },
  { _id: false },
)

const buyerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { _id: false },
)

const mercadoPagoSchema = new mongoose.Schema(
  {
    preferenceId: { type: String, default: '' },
    paymentId: { type: String, default: '' },
    status: { type: String, default: '' },
  },
  { _id: false },
)

const deliverySchema = new mongoose.Schema(
  {
    status: { type: String, default: 'pending' },
    downloadLinks: { type: [String], default: [] },
    sentAt: { type: String, default: null },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true },
    orderId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, default: null, index: true },
    status: { type: String, default: 'pending', index: true },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, default: 0 },
    buyer: { type: buyerSchema, default: () => ({}) },
    mercadoPago: { type: mercadoPagoSchema, default: () => ({}) },
    delivery: { type: deliverySchema, default: () => ({}) },
    payment: { type: mongoose.Schema.Types.Mixed, default: {} },
    preferenceId: { type: String, default: null },
    buyerEmail: { type: String, default: null },
    paidAt: { type: String, default: null },
    deliveredAt: { type: String, default: null },
  },
  {
    strict: false,
    timestamps: false,
    versionKey: false,
    collection: 'orders',
  },
)

orderSchema.index({ createdAt: -1 })

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema)

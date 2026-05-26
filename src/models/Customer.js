import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastPurchaseAt: { type: String, default: null },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: 'customers',
  },
)

export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema)

import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    position: { type: Number, default: null },
    deliveryUrl: { type: String, default: '' },
    downloadUrl: { type: String, default: '' },
  },
  {
    strict: false,
    timestamps: false,
    versionKey: false,
    collection: 'products',
  },
)

productSchema.index({ position: 1, id: 1 })
productSchema.index({ active: 1 })
productSchema.index({ category: 1 })

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema)

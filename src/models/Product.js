import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
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

productSchema.index({ active: 1 })
productSchema.index({ category: 1 })

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema)

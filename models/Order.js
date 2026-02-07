const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    shopProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopProduct',
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    // Immutable snapshot (price must NEVER change even if product updates later)
    snapshot: {
      partNumber: String,
      partName: String,

      brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
      model: { type: mongoose.Schema.Types.ObjectId, ref: 'Model' },
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

      price: { type: Number, required: true },
      discountedPrice: Number,

      image: String
    }
  },
  { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    name: String,
    contact: String,
    address: String,
    area: String,
    place: String,
    latitude: Number,
    longitude: Number
  },
  { _id: false }
);

const orderStatusSchema = new mongoose.Schema(
  {
    status: String,
    date: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Relations
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    masterOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterOrder' },

    // Items
    items: [orderItemSchema],

    // Address
    deliveryAddress: deliveryAddressSchema,

    // Amounts (ALL NUMBERS)
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true },

    // Coupon
    coupon: {
      code: String,
      discountType: String,
      discountValue: Number,
      discountAmount: Number
    },

    // Payment
    paymentType: { type: String, enum: ['COD', 'CARD', 'WALLET'], required: true },
    paymentStatus: { type: String, default: 'Pending' },
    transactionId: String,

    // Delivery
    assignedDeliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy' },
    deliveryDistance: { type: Number, default: 0 },
    deliveryEarning: { type: Number, default: 0 },

    // Status
    status: { type: String, default: 'Pending' },
    statusHistory: {
      type: [orderStatusSchema],
      default: [{ status: 'Pending', date: new Date() }]
    },

    // Cancellation details
    cancellation: {
      isCancelled: { type: Boolean, default: false },
      cancelledAt: Date,
      cancelledBy: { type: String, enum: ['customer', 'shop', 'admin'] },
      reason: { type: String },
      additionalComments: { type: String }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
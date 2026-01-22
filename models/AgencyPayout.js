const mongoose = require('mongoose');

const agencyPayoutSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryAgency',
      required: true
    },
    deliveryBoyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBoy',
      default: null
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    from: {
      type: Date,
      required: true
    },
    to: {
      type: Date,
      required: true
    },
    month: {
      type: String,
      required: true  // e.g., "January 2026"
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Paid', 'Failed'],
      default: 'Pending'
    },
    transactionId: {
      type: String,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Check', 'Cash', 'Online'],
      default: 'Bank Transfer'
    },
    notes: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index for efficient queries
agencyPayoutSchema.index({ agencyId: 1, from: 1, to: 1 });
agencyPayoutSchema.index({ agencyId: 1, month: 1 });

module.exports = mongoose.model('AgencyPayout', agencyPayoutSchema);
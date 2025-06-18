const mongoose = require('mongoose');

const agencyPayoutSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgency' },
  totalAmount: Number,
  commission: Number,
  netPayable: Number,
  totalDeliveries: Number,
  status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  from: String,
  to: String
}, { timestamps: true });

module.exports = mongoose.model('AgencyPayout', agencyPayoutSchema);
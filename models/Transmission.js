const mongoose = require('mongoose');

const transmissionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['Manual', 'Automatic', 'CVT', 'Hybrid', 'EV'], 
    required: true 
  },

  mechanism: { 
    type: String, 
    enum: ['TorqueConverter', 'DCT', 'AMT', 'eCVT'] 
  },

  variant: { type: String },          // Wet, Dry, Belt, Chain
  gearCount: { type: Number },        // 5, 6, 7, 8, 10
  layout: { 
    type: String, 
    enum: ['FWD', 'RWD', 'AWD'] 
  },

  oemCode: { type: String, unique: true },  // ZF8HP70, AisinTF80

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Transmission', transmissionSchema);
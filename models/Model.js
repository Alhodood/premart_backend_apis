const mongoose = require('mongoose');
const modelSchema = new mongoose.Schema({
    modelName: String,
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true
    },

    visibility:{ type: Boolean, default: true }
},
    { timestamps: true })
module.exports = mongoose.model('Model', modelSchema);
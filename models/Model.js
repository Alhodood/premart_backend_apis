const mongoose = require('mongoose');
const modelSchema = new mongoose.Schema({
    modelName: String,

    visibility:{ type: Boolean, default: true }
},
    { timestamps: true })
module.exports = mongoose.model('Model', modelSchema);
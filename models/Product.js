const mongoose = require('mongoose');

const PartSchema = new mongoose.Schema({
  partNumber: { type: String, required: true },
  partName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  price: Number,
  discountedPrice: Number,
  description: String,
  imageUrl: [],           // URL to the part's image
  notes: String,
  madeIn: String,     
  skuNumber:String,   // e.g., "Japan", "USA"
  stockStatus: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'in_stock'
  }
});

const SubCategorySchema = new mongoose.Schema({
  categoryTab: String, 
  categoryTabImageUrl: [String],
  subCategoryTab: String,         // e.g., "Engine Gasket", "Short Block Assembly"
  subCategoryTabImageUrl: [String],        // Exploded image URL
  parts: [PartSchema]
});

const ProductSchema = new mongoose.Schema({
  brand: { type: String, required: true },            // Toyota, Lexus, etc.
  year: { type: Number, required: true },             // 2022, 2023, etc.
  model: { type: String, required: true },            // e.g., 4RUNNER
  frameCode: String,                                  // GRN280, etc.
  region: String,                                     // e.g., "Asia and Middle East"
  engineCode: String,                                 // e.g., 1GRFE
  transmission: String,                               // e.g., 5FC


  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },

  subCategories: [SubCategorySchema],
  
  ratings: {
  average: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }
},// Each tab with image + parts,

  vinMetadata: {
    wmi: String,
    vds: String,
    vis: String
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
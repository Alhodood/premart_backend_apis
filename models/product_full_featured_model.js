// product_full_featured_model.js
// Full-featured Mongoose model for Product + Parts Catalog
// Ready for production: stocks, pricing, supplier, analytics, audit, indexing, hooks

const mongoose = require('mongoose');
const { Schema } = mongoose;

// --- Sub-schemas ---
const PriceHistorySchema = new Schema({
  price: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  from: { type: Date, default: Date.now },
  to: { type: Date },
  source: { type: String } // e.g. supplier, marketplace
}, { _id: false });

const StockLevelSchema = new Schema({
  locationId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
  qty: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
  available: { type: Number }, // computed if not supplied
  lastUpdatedAt: { type: Date, default: Date.now }
}, { _id: false });

const SupplierSchema = new Schema({
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  name: { type: String },
  sku: { type: String },
  leadTimeDays: { type: Number },
  costPrice: { type: Number },
  currency: { type: String, default: 'USD' },
  contact: { type: String }
}, { _id: false });

const AnalyticsSchema = new Schema({
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  lastSeen: { type: Date }
}, { _id: false });

const PartSchema = new Schema({
  partNumber: { type: String, required: true },
  partName: { type: String, required: true },
  description: { type: String },
  qty: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  price: { type: Number },
  currency: { type: String, default: 'USD' },
  images: [{ type: String }],
  madeIn: { type: String },
  manufacturer: { type: String },
  alternatePartNumbers: [{ type: String }],
  oemNumbers: [{ type: String }],
  positionNumber: { type: String },
  sourceId: { type: String },
  suppliers: [ SupplierSchema ],
  stockLevels: [ StockLevelSchema ],
  priceHistory: [ PriceHistorySchema ],
  rawPayload: { type: Schema.Types.Mixed }
}, { _id: false });

const SubCategorySchema = new Schema({
  code: { type: String },
  name: { type: String },
  parts: [ PartSchema ]
}, { _id: false });

// Compatibility entry for fitment info
const FitmentSchema = new Schema({
  catalogId: { type: String },
  modelId: { type: String },
  yearFrom: { type: Number },
  yearTo: { type: Number },
  engineCode: { type: String }
}, { _id: false });

// --- Main Product Schema ---
const ProductSchema = new Schema({
  commonProductId: { type: String, required: true, unique: true },
  brand: { type: String, index: true, required: true },
  model: { type: String, index: true, required: true },
  trim: { type: String },
  year: { type: Number, index: true },
  vin: { type: String },

  // marketplace/shop metadata
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
  source: { type: String },
  sourceUpdatedAt: { type: Date },
  lastSyncedAt: { type: Date },

  // hierarchy and parts
  categories: [{ type: String }],
  subCategories: [ SubCategorySchema ],
  parts: [ PartSchema ], // quick access: flattened parts
  totalPartsCount: { type: Number, default: 0 },

  // global stock/price aggregated
  aggregatedStock: { type: Number, default: 0 },
  minPrice: { type: Number },
  maxPrice: { type: Number },
  priceHistory: [ PriceHistorySchema ],

  // suppliers and procurement
  preferredSuppliers: [ SupplierSchema ],

  // compatibility/fitment
  fitment: [ FitmentSchema ],

  // analytics & meta
  seo: {
    title: { type: String },
    metaDescription: { type: String }
  },
  analytics: AnalyticsSchema,

  // free-form original payload for auditing
  rawPayload: { type: Schema.Types.Mixed },

  // operational flags
  isActive: { type: Boolean, default: true },
  visibility: { type: String, enum: ['public','private','draft'], default: 'public' }
}, { timestamps: true, versionKey: 'version' });

// --- Indexes ---
ProductSchema.index({ brand: 1, model: 1, year: 1 });
ProductSchema.index({ 'parts.partNumber': 1 });
ProductSchema.index({ 'seo.title': 'text', 'parts.partName': 'text', 'parts.description': 'text' });

// --- Virtuals ---
ProductSchema.virtual('availability').get(function() {
  if (this.aggregatedStock == null) return 'unknown';
  return this.aggregatedStock > 0 ? 'in_stock' : 'out_of_stock';
});

// --- Pre-save hooks ---
ProductSchema.pre('save', function(next) {
  // recompute aggregatedStock & totalPartsCount
  try {
    if (this.parts && this.parts.length) {
      this.totalPartsCount = this.parts.length;
      this.aggregatedStock = this.parts.reduce((acc, p) => {
        const partStock = (p.stockLevels || []).reduce((sAcc, s) => sAcc + (s.qty - (s.reserved || 0)), 0);
        return acc + partStock;
      }, 0);

      // compute min/max price across parts
      const prices = this.parts.map(p => p.price).filter(v => typeof v === 'number');
      if (prices.length) {
        this.minPrice = Math.min(...prices);
        this.maxPrice = Math.max(...prices);
      }
    }
  } catch (err) {
    return next(err);
  }
  next();
});

// --- Instance methods ---
ProductSchema.methods.getPartByNumber = function(partNumber) {
  return (this.parts || []).find(p => p.partNumber === partNumber) || null;
};

ProductSchema.methods.incrementView = function() {
  this.analytics = this.analytics || { views: 0, clicks: 0, conversions: 0 };
  this.analytics.views = (this.analytics.views || 0) + 1;
  this.analytics.lastSeen = new Date();
  return this.save();
};

// --- Statics ---
ProductSchema.statics.upsertByCommonId = async function(commonProductId, payload) {
  return this.findOneAndUpdate(
    { commonProductId },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

ProductSchema.statics.searchParts = function(query, options = {}) {
  // simple full-text search over product & parts
  const search = { $text: { $search: query } };
  return this.find(search).limit(options.limit || 50);
};

// --- Compound aggregation helper ---
ProductSchema.statics.aggregateStockByShop = function(shopId) {
  return this.aggregate([
    { $match: { shopId: mongoose.Types.ObjectId(shopId) } },
    { $group: { _id: '$shopId', totalStock: { $sum: '$aggregatedStock' }, products: { $sum: 1 } } }
  ]);
};

// --- Export ---
module.exports = mongoose.model('ProductFull', ProductSchema);

// --- Usage examples (run separately) ---
/*
const Product = require('./product_full_featured_model');

// upsert
await Product.upsertByCommonId('skoda_citigo_2020', { brand: 'Skoda', model: 'Citigo', year: 2020, parts: [...] });

// search
const results = await Product.searchParts('tyre pressure');

// increment view
await product.incrementView();

// aggregate stock
await Product.aggregateStockByShop(shopId);
*/

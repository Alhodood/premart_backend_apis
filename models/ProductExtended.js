// // models/ProductExtended.js
// // New extended Product + Part schema — drop-in additional/extended model.
// // Uses CommonJS exports to match your project style.

// const mongoose = require('mongoose');
// const crypto = require('crypto');

// const { Schema } = mongoose;

// /**
//  * Helper normalizer for part numbers (canonical)
//  */
// function canonicalizePartNumber(pn = '') {
//   if (!pn) return '';
//   return pn.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
// }

// /**
//  * Part Schema (extended)
//  */
// const PartSchema = new Schema({
//   partNumber: { type: String, required: true, index: true }, // raw as-provided
//   canonicalPartNumber: { type: String, index: true }, // normalized for matching
//   alternatePartNumbers: [{ type: String }], // vendor / cross refs
//   oemNumbers: [{ type: String }], // OEM numbers
//   partName: { type: String, required: true, text: true }, // searchable
//   description: { type: String, text: true },
//   quantity: { type: Number, default: 0 },
//   stockStatus: {
//     type: String,
//     enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
//     default: 'in_stock',
//     index: true
//   },

//   // pricing + history
//   price: { type: Number },
//   currency: { type: String, default: 'USD' },
//   discountedPrice: { type: Number },
//   priceHistory: [{
//     price: Number,
//     currency: String,
//     source: String,
//     date: { type: Date, default: Date.now }
//   }],

//   // supplier & logistics
//   supplier: {
//     id: String,
//     name: String,
//     contact: String
//   },
//   stockLevels: [{
//     locationId: String,
//     locationName: String,
//     qty: Number,
//     reserved: { type: Number, default: 0 }
//   }],
//   leadTimeDays: Number,
//   minOrderQty: { type: Number, default: 1 },

//   // media
//   images: [{
//     url: String,
//     width: Number,
//     height: Number,
//     type: { type: String }, // exploded_diagram, thumbnail, product_photo
//     isPrimary: { type: Boolean, default: false }
//   }],
//   thumbnailUrl: String, // convenience

//   // logistics / product attributes
//   madeIn: String,
//   manufacturer: String,
//   skuNumber: String,

//   // meta / extra
//   notes: String,
//   tags: [{ type: String, index: true }], // quick filters
//   attributes: { type: Schema.Types.Mixed }, // flexible attributes (e.g., diameter, threadPitch)

//   // raw payload + provenance
//   source: { type: String }, // e.g., parts-catalogs/v1
//   sourceId: { type: String }, // provider part id
//   sourcePayloadHash: { type: String },
//   rawPayload: { type: Schema.Types.Mixed },

// }, { _id: false }); // parts are embedded; no separate _id by default (you can enable if needed)

// /**
//  * SubCategory Schema (extended)
//  */
// const SubCategorySchema = new Schema({
//   categoryTab: String,
//   categoryTabImageUrl: [String],
//   subCategoryTab: String,
//   subCategoryTabImageUrl: [String],
//   parts: [PartSchema]
// }, { _id: false });

// /**
//  * Compatibility / fitment record
//  */
// const FitmentSchema = new Schema({
//   catalogId: String,
//   modelId: String,
//   carId: String,
//   yearFrom: Number,
//   yearTo: Number,
//   engineCode: String,
//   transmission: String,
//   fuelType: String,
//   notes: String
// }, { _id: false });

// /**
//  * Product (parent) Schema (extended)
//  */
// const ProductSchema = new Schema({
//   brand: { type: String, required: true, index: true },
//   year: { type: Number, required: true, index: true },
//   model: { type: String, required: true, index: true },
//   frameCode: String,
//   region: String,
//   engineCode: String,
//   transmission: String,

//   commonProductId: { type: String, required: true, index: true }, // deterministic key

//   shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },

//   subCategories: [SubCategorySchema], // embedded parts per subcategory

//   // compatibility/fitment records (search where this part applies)
//   compatibility: [FitmentSchema],

//   // aggregator fields for queries
//   totalPartsCount: { type: Number, default: 0, index: true },

//   // ratings & metadata
//   ratings: {
//     average: { type: Number, default: 0 },
//     totalReviews: { type: Number, default: 0 }
//   },

//   // vin metadata
//   vinMetadata: {
//     wmi: String,
//     vds: String,
//     vis: String
//   },

//   // provenance / sync tracking
//   source: { type: String, default: 'parts-catalogs/v1' },
//   sourceUpdatedAt: Date,
//   lastSyncedAt: { type: Date, default: Date.now, index: true },
//   syncedBy: String,

//   // caching raw data
//   rawPayload: { type: Schema.Types.Mixed },

//   // indexing/keywords for quick search
//   searchKeywords: [String],

// }, { timestamps: true });

// /**
//  * Pre-save hooks
//  * - populate canonicalPartNumber for each part
//  * - update totalPartsCount
//  * - compute payload hash if rawPayload present
//  */
// ProductSchema.pre('save', function (next) {
//   try {
//     const doc = this;

//     let total = 0;
//     if (Array.isArray(doc.subCategories)) {
//       doc.subCategories.forEach((sc) => {
//         const parts = sc.parts || [];
//         total += parts.length;
//         parts.forEach((p) => {
//           if (!p.canonicalPartNumber && p.partNumber) {
//             p.canonicalPartNumber = canonicalizePartNumber(p.partNumber);
//           }
//           // ensure thumbnailUrl if images exist
//           if (!p.thumbnailUrl && Array.isArray(p.images) && p.images.length) {
//             const primary = p.images.find(i => i.isPrimary) || p.images[0];
//             p.thumbnailUrl = primary.url;
//           }
//           // compute source payload hash if not set
//           if (p.rawPayload && !p.sourcePayloadHash) {
//             try {
//               const s = JSON.stringify(p.rawPayload);
//               p.sourcePayloadHash = crypto.createHash('sha256').update(s).digest('hex');
//             } catch (e) { /* ignore */ }
//           }
//         });
//       });
//     }
//     doc.totalPartsCount = total;

//     // product-level payload hash
//     if (doc.rawPayload && !doc.sourcePayloadHash) {
//       try {
//         const s = JSON.stringify(doc.rawPayload);
//         doc.sourcePayloadHash = crypto.createHash('sha256').update(s).digest('hex');
//       } catch (e) { /* ignore */ }
//     }

//     // normalize searchKeywords from brand/model/parts
//     const kw = new Set((doc.searchKeywords || []).map(k => k.toLowerCase()));
//     if (doc.brand) kw.add(doc.brand.toLowerCase());
//     if (doc.model) kw.add(doc.model.toLowerCase());
//     if (Array.isArray(doc.subCategories)) {
//       doc.subCategories.forEach(sc => {
//         if (sc.subCategoryTab) kw.add(sc.subCategoryTab.toLowerCase());
//         (sc.parts || []).forEach(p=>{ if (p.partName) kw.add(p.partName.toLowerCase()); if (p.partNumber) kw.add(p.partNumber.toLowerCase()); });
//       });
//     }
//     doc.searchKeywords = Array.from(kw);

//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// /**
//  * Indexes
//  */
// ProductSchema.index({ commonProductId: 1, shopId: 1 }, { unique: false });
// ProductSchema.index({ brand: 1, model: 1, year: 1 });
// ProductSchema.index({ 'subCategories.parts.canonicalPartNumber': 1 });
// ProductSchema.index({ 'subCategories.parts.partName': 'text', 'subCategories.parts.description': 'text', model: 'text', brand: 'text' }, { name: 'parts_text_index' });

// /**
//  * Exports
//  */
// module.exports = mongoose.model('ProductExtended', ProductSchema);

// models/ProductExtended.js
// Extended Product + Part schema - single file, CommonJS
// Requires: mongoose, mongoose-paginate-v2 (optional but recommended)
const mongoose = require('mongoose');
const crypto = require('crypto');
// optional pagination plugin — guard require so model loads without the package
let mongoosePaginate = null;
try { mongoosePaginate = require('mongoose-paginate-v2'); } catch (e) { mongoosePaginate = null; }

const { Schema } = mongoose;

/* ------------------------
   Helpers
   ------------------------ */
function canonicalizePartNumber(pn = '') {
  if (!pn) return '';
  return pn.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function computeHash(obj) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
  } catch (e) {
    return null;
  }
}

/* ------------------------
   Reservation subdocument
   - used to reserve stock for carts/orders
   ------------------------ */
const ReservationSchema = new Schema({
  reservationId: { type: String, required: true, index: true }, // e.g. orderId or cartId
  qty: { type: Number, required: true, min: 1 },
  reason: String,
  expiresAt: Date, // optional TTL logic can be added
  createdAt: { type: Date, default: Date.now },
  reservedBy: String // userId or system id
}, { _id: false });

/* ------------------------
   Part Schema (embedded)
   - keep _id disabled for compactness; enable if you need independent updates
   ------------------------ */
const PartSchema = new Schema({
  partNumber: { type: String, required: true, index: true },
  canonicalPartNumber: { type: String },
  alternatePartNumbers: [{ type: String }],
  oemNumbers: [{ type: String }],
  partName: { type: String, required: true, text: true },
  description: { type: String, text: true },
  quantity: { type: Number, default: 0 }, // total across warehouses
  stockStatus: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
    default: 'in_stock',
    index: true
  },
  price: Number,
  currency: { type: String, default: 'USD' },
  discountedPrice: Number,
  priceHistory: [{
    price: Number,
    currency: String,
    source: String,
    date: { type: Date, default: Date.now }
  }],

  supplier: {
    id: String,
    name: String,
    contact: String
  },

  stockLevels: [{
    locationId: String,
    locationName: String,
    qty: Number,
    reserved: { type: Number, default: 0 }
  }],

  reservations: [ReservationSchema], // per-part holds

  leadTimeDays: Number,
  minOrderQty: { type: Number, default: 1 },

  images: [{
    url: String,
    width: Number,
    height: Number,
    type: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],
  thumbnailUrl: String,

  madeIn: String,
  manufacturer: String,
  skuNumber: String,

  notes: String,
  tags: [{ type: String, index: true }],
  attributes: { type: Schema.Types.Mixed },

  source: { type: String },
  sourceId: { type: String },
  sourcePayloadHash: { type: String },
  rawPayload: { type: Schema.Types.Mixed }
}, { _id: false });

/* ------------------------
   SubCategory
   ------------------------ */
const SubCategorySchema = new Schema({
  categoryTab: String,
  categoryTabImageUrl: [String],
  subCategoryTab: String,
  subCategoryTabImageUrl: [String],
  parts: [PartSchema]
}, { _id: false });

/* ------------------------
   Fitment / compatibility
   ------------------------ */
const FitmentSchema = new Schema({
  catalogId: String,
  modelId: String,
  carId: String,
  yearFrom: Number,
  yearTo: Number,
  engineCode: String,
  transmission: String,
  fuelType: String,
  notes: String
}, { _id: false });

/* ------------------------
   Product Schema
   ------------------------ */
const ProductSchema = new Schema({
  brand: { type: String, required: true, index: true },
  year: { type: Number, required: true, index: true },
  model: { type: String, required: true, index: true },
  frameCode: String,
  region: String,
  engineCode: String,
  transmission: String,

  commonProductId: { type: String, required: true, index: true },

  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },

  subCategories: [SubCategorySchema],

  compatibility: [FitmentSchema],

  totalPartsCount: { type: Number, default: 0, index: true },

  ratings: {
    average: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },

  vinMetadata: {
    wmi: String,
    vds: String,
    vis: String
  },

  source: { type: String, default: 'parts-catalogs/v1' },
  sourceUpdatedAt: Date,
  lastSyncedAt: { type: Date, default: Date.now, index: true },
  syncedBy: String,

  rawPayload: { type: Schema.Types.Mixed },
  sourcePayloadHash: String,

  // soft-delete + audit
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: String,

  createdBy: String,
  updatedBy: String,

  // denormalized aggregated stock & pricing (easy queries)
  aggregated: {
    totalAvailable: { type: Number, default: 0 },
    minPrice: Number,
    maxPrice: Number,
    currency: { type: String }
  },

  // quick search keywords
  searchKeywords: [String]
}, { timestamps: true });

/* ------------------------
   Virtuals
   ------------------------ */
ProductSchema.virtual('partsCount').get(function () {
  return this.totalPartsCount || (Array.isArray(this.subCategories) ? this.subCategories.reduce((s, sc) => s + (sc.parts ? sc.parts.length : 0), 0) : 0);
});

/* compute total available stock quickly */
ProductSchema.virtual('totalAvailableStock').get(function () {
  let total = 0;
  if (!Array.isArray(this.subCategories)) return 0;
  this.subCategories.forEach(sc => {
    (sc.parts || []).forEach(p => {
      // prefer aggregated stockLevels sums when present
      if (Array.isArray(p.stockLevels) && p.stockLevels.length) {
        p.stockLevels.forEach(s => { total += (s.qty || 0) - (s.reserved || 0); });
      } else if (typeof p.quantity === 'number') {
        // fallback to part-level quantity
        total += p.quantity;
      }
    });
  });
  return total;
});

/* ------------------------
   Instance Methods
   ------------------------ */

/**
 * Reserve stock for a specific part in this product.
 * Returns { ok: true, reservedQty } or throws Error.
 *
 * logic:
 * - find first stockLevel with enough free qty, decrement reserved
 * - push a reservation record
 */
ProductSchema.methods.reservePart = async function (partNumber, reservationId, qty = 1, opts = {}) {
  // operates on this doc in-memory; caller should save()
  const part = this.subCategories?.flatMap(sc => sc.parts || []).find(p => p.partNumber === partNumber || p.canonicalPartNumber === canonicalizePartNumber(partNumber));
  if (!part) throw new Error('Part not found: ' + partNumber);

  qty = Number(qty);
  if (qty <= 0) throw new Error('Invalid qty');

  // try to reserve from stockLevels
  if (!Array.isArray(part.stockLevels) || part.stockLevels.length === 0) {
    // if no stockLevels, check top-level quantity
    if ((part.quantity || 0) < qty) throw new Error('Insufficient stock');
    // reduce quantity (local) and add reservation
    part.quantity -= qty;
    part.reservations = part.reservations || [];
    part.reservations.push({ reservationId, qty, reason: opts.reason, expiresAt: opts.expiresAt, reservedBy: opts.reservedBy });
    return { ok: true, reservedQty: qty };
  }

  // find a level with available
  for (let sl of part.stockLevels) {
    const available = (sl.qty || 0) - (sl.reserved || 0);
    if (available >= qty) {
      sl.reserved = (sl.reserved || 0) + qty;
      part.reservations = part.reservations || [];
      part.reservations.push({ reservationId, qty, reason: opts.reason, expiresAt: opts.expiresAt, reservedBy: opts.reservedBy });
      return { ok: true, reservedQty: qty, from: sl.locationId || sl.locationName };
    }
  }

  throw new Error('Insufficient stock');
};

/**
 * Release reservation
 */
ProductSchema.methods.releaseReservation = async function (partNumber, reservationId) {
  const partPath = this.subCategories?.flatMap(sc => sc.parts || []).find(p => p.partNumber === partNumber || p.canonicalPartNumber === canonicalizePartNumber(partNumber));
  if (!partPath) throw new Error('Part not found');

  if (!Array.isArray(partPath.reservations)) return { ok: false, message: 'No reservations' };

  const idx = partPath.reservations.findIndex(r => r.reservationId === reservationId);
  if (idx === -1) return { ok: false, message: 'Reservation not found' };

  const r = partPath.reservations[idx];
  // decrement reserved on stockLevels if present
  if (Array.isArray(partPath.stockLevels) && partPath.stockLevels.length) {
    // naive: remove from first matching reserved slot (more advanced: store locationId in reservation)
    for (let sl of partPath.stockLevels) {
      if ((sl.reserved || 0) >= r.qty) {
        sl.reserved = (sl.reserved || 0) - r.qty;
        break;
      }
    }
  } else {
    // if no stockLevels, return qty to part.quantity
    partPath.quantity = (partPath.quantity || 0) + r.qty;
  }
  partPath.reservations.splice(idx, 1);
  return { ok: true, releasedQty: r.qty };
};

/* ------------------------
   Static Methods
   ------------------------ */
ProductSchema.statics.findBySKU = function (sku) {
  // SKU = commonProductId or specific canonical key - adapt to your mapping
  return this.findOne({ commonProductId: sku, isDeleted: { $ne: true } });
};

/**
 * Upsert product from catalog payload
 * - merges parts intelligently using canonicalPartNumber
 */
ProductSchema.statics.upsertFromCatalog = async function (payload, opts = {}) {
  const Product = this;
  // payload must contain commonProductId, brand, model, year
  if (!payload || !payload.commonProductId) throw new Error('payload.commonProductId required');

  const existing = await Product.findOne({ commonProductId: payload.commonProductId, shopId: payload.shopId || null });

  if (!existing) {
    // create new
    const doc = new Product(payload);
    return doc.save();
  }

  // merge logic: we'll naive-merge subCategories by subCategoryTab and parts by canonicalPartNumber
  const merged = existing.toObject();
  // keep existing ids/metadata
  merged.lastSyncedAt = new Date();
  merged.sourceUpdatedAt = payload.sourceUpdatedAt || merged.sourceUpdatedAt;
  merged.rawPayload = payload.rawPayload || merged.rawPayload;

  // naive merge --- you can implement more advanced merge rules
  const incomingSC = payload.subCategories || [];
  incomingSC.forEach(incSc => {
    const scIdx = (merged.subCategories || []).findIndex(s => s.subCategoryTab === incSc.subCategoryTab);
    if (scIdx === -1) {
      merged.subCategories = merged.subCategories || [];
      merged.subCategories.push(incSc);
    } else {
      // merge parts
      merged.subCategories[scIdx].parts = merged.subCategories[scIdx].parts || [];
      incSc.parts.forEach(incP => {
        incP.canonicalPartNumber = canonicalizePartNumber(incP.partNumber || incP.canonicalPartNumber);
        const pIdx = merged.subCategories[scIdx].parts.findIndex(ep => (ep.canonicalPartNumber || canonicalizePartNumber(ep.partNumber)) === incP.canonicalPartNumber);
        if (pIdx === -1) merged.subCategories[scIdx].parts.push(incP);
        else {
          // replace or merge fields - prefer incoming if updated
          merged.subCategories[scIdx].parts[pIdx] = Object.assign({}, merged.subCategories[scIdx].parts[pIdx], incP);
        }
      });
    }
  });

  // compute hash + save
  merged.sourcePayloadHash = computeHash(payload.rawPayload || payload);
  // Using findOneAndUpdate for upsert behavior
  const updated = await Product.findOneAndUpdate(
    { _id: existing._id },
    { $set: merged },
    { new: true }
  );
  return updated;
};

/* ------------------------
   Hooks
   ------------------------ */
ProductSchema.pre('save', function (next) {
  try {
    const doc = this;
    // populate canonical part numbers + thumbnail + price aggregates
    let total = 0;
    let minPrice = null;
    let maxPrice = null;
    let currency = null;
    if (Array.isArray(doc.subCategories)) {
      doc.subCategories.forEach(sc => {
        (sc.parts || []).forEach(p => {
          total += 1;
          if (!p.canonicalPartNumber && p.partNumber) p.canonicalPartNumber = canonicalizePartNumber(p.partNumber);
          if (!p.thumbnailUrl && Array.isArray(p.images) && p.images.length) {
            const primary = p.images.find(i => i.isPrimary) || p.images[0];
            p.thumbnailUrl = primary?.url;
          }
          if (typeof p.price === 'number') {
            if (minPrice === null || p.price < minPrice) minPrice = p.price;
            if (maxPrice === null || p.price > maxPrice) maxPrice = p.price;
            currency = p.currency || currency;
          }
          if (p.rawPayload && !p.sourcePayloadHash) p.sourcePayloadHash = computeHash(p.rawPayload);
        });
      });
    }
    doc.totalPartsCount = total;
    doc.aggregated = doc.aggregated || {};
    doc.aggregated.totalAvailable = doc.totalAvailableStock || doc.aggregated.totalAvailable || 0;
    doc.aggregated.minPrice = minPrice;
    doc.aggregated.maxPrice = maxPrice;
    doc.aggregated.currency = doc.aggregated.currency || currency;

    if (doc.rawPayload && !doc.sourcePayloadHash) doc.sourcePayloadHash = computeHash(doc.rawPayload);

    // normalize searchKeywords
    const kw = new Set((doc.searchKeywords || []).map(k => (k || '').toString().toLowerCase()));
    if (doc.brand) kw.add(doc.brand.toLowerCase());
    if (doc.model) kw.add(doc.model.toLowerCase());
    (doc.subCategories || []).forEach(sc => {
      if (sc.subCategoryTab) kw.add(sc.subCategoryTab.toLowerCase());
      (sc.parts || []).forEach(p => {
        if (p.partName) kw.add(p.partName.toLowerCase());
        if (p.partNumber) kw.add(p.partNumber.toLowerCase());
        if (p.canonicalPartNumber) kw.add(p.canonicalPartNumber.toLowerCase());
      });
    });
    doc.searchKeywords = Array.from(kw);

    next();
  } catch (err) { next(err); }
});

/* post-save hook: example to sync to external search (pseudo)
ProductSchema.post('save', function (doc) {
  // push to Elastic / Typesense / Meili index
  // You should implement a queue / worker to avoid slow saves.
});
*/

/* ------------------------
   Indexes
   ------------------------ */
ProductSchema.index({ commonProductId: 1, shopId: 1 }, { unique: false });
ProductSchema.index({ brand: 1, model: 1, year: 1 });
ProductSchema.index({ 'subCategories.parts.canonicalPartNumber': 1 });
ProductSchema.index({ 'subCategories.parts.partName': 'text', 'subCategories.parts.description': 'text', model: 'text', brand: 'text' }, { name: 'parts_text_index' });
// Compound index enabling fast lookup by brand+model+part:
ProductSchema.index({ brand: 1, model: 1, 'subCategories.parts.canonicalPartNumber': 1 });

/* ------------------------
   Plugins
   ------------------------ */
if (mongoosePaginate) ProductSchema.plugin(mongoosePaginate);

/* ------------------------
   Optional: TTL collection for sync-cache
   - keep separate collection if you need short-lived snapshot caching
   ------------------------ */
/*
const SyncCacheSchema = new Schema({
  key: { type: String, index: true },
  payload: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true },
}, { expireAfterSeconds: 60 * 60 * 2 }); // auto-delete after 2 hours
mongoose.model('ProductSyncCache', SyncCacheSchema);
*/

/* ------------------------
   Export model
   ------------------------ */
module.exports = mongoose.model('ProductExtended', ProductSchema);

/* ------------------------
   Notes / Next steps
   - Consider moving Part into its own collection if:
     * catalog is HUGE (> millions of parts)
     * parts need independent lifecycle (stock updates, images, supplier changes)
   - If you split out Part into its own collection:
     * add Part._id, store references in Product.subCategories.partsRef = [{ partId, partNumber, position }]
     * keep a denormalized snapshot (price, thumbnail) in product for UX speed
   - Add concurrency-safe stock operations (use transactions or $inc on a dedicated 'inventory' collection)
   - For high throughput: implement a queue (BullMQ / RabbitMQ) for external-search sync; do not sync in post-save synchronously.
   ------------------------ */
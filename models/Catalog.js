// models/Catalog.js
import mongoose from "mongoose";

const CatalogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  modelsCount: Number,
  actuality: String,
}, { timestamps: true });

export default mongoose.model("Catalog", CatalogSchema);


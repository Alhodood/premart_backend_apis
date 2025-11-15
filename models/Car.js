// models/Car.js
import mongoose from "mongoose";

const CarSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  catalogId: String,
  name: String,
  modelId: String,
  modelName: String,
  vin: String,
  frame: String,
  brand: String,
  description: String,
  parameters: Object,
}, { timestamps: true });

export default mongoose.model("Car", CarSchema);
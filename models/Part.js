// models/Part.js
import mongoose from "mongoose";

const PartSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  catalogId: String,
  carId: String,
  groupId: String,
  name: String,
  number: String,
  brand: String,
  description: String,
  positionNumber: String,
  url: String,
  img: String,
}, { timestamps: true });

export default mongoose.model("Part", PartSchema);
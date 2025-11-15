// models/Group.js
import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  catalogId: String,
  carId: String,
  parentId: String,
  name: String,
  hasParts: Boolean,
  hasSubgroups: Boolean,
  img: String,
  description: String,
}, { timestamps: true });

export default mongoose.model("Group", GroupSchema);
const mongoose= require('mongoose');
const cartSchema= new mongoose.Schema({
    categoryName: String,
    categoryImage: String
},{timestamps: true })
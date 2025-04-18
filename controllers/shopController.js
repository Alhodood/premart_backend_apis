// const Shop = require('../models/shop.model'); // Adjust path as needed

// // Create new Shop
// exports.createShop = async (req, res) => {
//   try {
//     const newShop = new Shop({
//       shopeDetails: [req.body] // expects one shopDetails object
//     });
//     const savedShop = await newShop.save();
//     res.status(201).json({data:savedShop,success:true,message: "New company has created successfuly"});
//   } catch (err) {
//     res.status(400).json({ data: [],success:false,message: err.message });
//   }
// };

// // Get all shops
// exports.getAllShops = async (req, res) => {
//   try {
//     const shops = await Shop.find();
//     res.status(200).json({data:shops, success:true,message: "company feathced successfuly"});
//   } catch (err) {
//     res.status(500).json({ data:[],  success:false,message: err.message});
//   }
// };

// // Get shop by ID
// exports.getShopById = async (req, res) => {
//   try {
//     const shop = await Shop.findById(req.params.id);
//     if (!shop) return res.status(404).json({ message: 'Shop not found',success:false, data:[] });
//     res.status(200).json({data:shop, message: 'Shop featched',success:true,});
//   } catch (err) {
//     res.status(500).json({ data:[] ,  message: err.message,success:false,});
//   }
// };

// // Update shop by ID
// exports.updateShop = async (req, res) => {
//   try {
//     const updatedShop = await Shop.findByIdAndUpdate(
//       req.params.id,
//       { $set: req.body },
//       { new: true }
//     );
//     res.status(200).json(updatedShop);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // Delete shop by ID
// exports.deleteShop = async (req, res) => {
//   try {
//     await Shop.findByIdAndDelete(req.params.id);
//     res.status(200).json({ message: 'Shop deleted successfully', success:true });
//   } catch (err) {
//     res.status(500).json({ message: err.message, data:[], success:false });
//   }
// };

const mongoose = require('mongoose');
const WishList = require('../models/WishList');
const Product = require('../models/Product');

exports.addToWishList = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { productID, productIDs } = req.body;

    if (!userId || (!productID && !productIDs)) {
      return res.status(400).json({
        message: 'UserId and at least one productID or productIDs array is required',
        success: false,
        data: []
      });
    }

    // Normalize to array
    if (productID) productIDs = [productID];

    let wishList = await WishList.findOne({ userId });

    // Load product documents for the given IDs
    const productDetails = await Product.find({
      _id: { $in: productIDs.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    if (!wishList) {
      const newCart = new WishList({
        userId,
        wishListProduct: productIDs.map(id => id.toString())
      });
      await newCart.save();

      return res.status(201).json({
        message: 'New wishlist created with products',
        success: true,
        action: 'added',
        data: productDetails
      });
    }

    // Toggle logic
    const added = [];
    const removed = [];

    for (let element of productIDs) {
      const strId = element.toString();
      const index = wishList.wishListProduct.indexOf(strId);

      if (index === -1) {
        wishList.wishListProduct.push(strId);
        added.push(strId);
      } else {
        wishList.wishListProduct.splice(index, 1);
        removed.push(strId);
      }
    }

    await wishList.save();

    const fullList = await Product.find({
      _id: { $in: wishList.wishListProduct.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();
    const addedProducts = await Product.find({
      _id: { $in: added.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();
    const removedProducts = await Product.find({
      _id: { $in: removed.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Dynamic message
    let message = 'Wishlist updated successfully';
    if (added.length && !removed.length) {
      message = 'Products added to wishlist';
    } else if (!added.length && removed.length) {
      message = 'Products removed from wishlist';
    } else if (added.length && removed.length) {
      message = 'Products added and removed from wishlist';
    }

    return res.status(200).json({
      message,
      success: true,
      added: addedProducts,
      removed: removedProducts,
      data: fullList
    });

  } catch (error) {
    console.error('Wishlist Error:', error);
    res.status(500).json({
      message: 'Wishlist operation failed',
      success: false,
      data: error.message
    });
  }
};



exports.getWishList = async (req, res) => {
  try {
    const userId = req.params.userId;
    const wishList = await WishList.findOne({ userId });

    if (!wishList) {
      return res.status(200).json({
        message: 'User not found',
        success: true,
        data: []
      });
    }

    // Load products directly by IDs in the wishlist
    const productIds = wishList.wishListProduct.map(id => new mongoose.Types.ObjectId(id));
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    return res.status(200).json({
      message: 'Wishlist found with products',
      success: true,
      data: products
    });

  } catch (e) {
    console.error('Error fetching cart:', e);
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};

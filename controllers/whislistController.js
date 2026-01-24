const mongoose = require('mongoose');
const WishList = require('../models/WishList');
const Product = require('../models/_deprecated/Product');
const ShopProduct = require('../models/ShopProduct');

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
        data: [],
        // productIds: [] // Return empty array for product IDs
      });
    }

    // Load products directly by IDs in the wishlist
    const productIds = wishList.wishListProduct.map(id => new mongoose.Types.ObjectId(id));
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    return res.status(200).json({
      message: 'Wishlist found with products',
      success: true,
      // data: products,
      // productIds: wishList.wishListProduct // Return product IDs array for easy checking
      data: wishList.wishListProduct,
    });

  } catch (e) {
    console.error('Error fetching wishlist:', e);
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};

// CHECK IF PRODUCT IS IN WISHLIST
exports.checkWishlistStatus = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productID } = req.query;

    if (!productID) {
      return res.status(400).json({
        success: false,
        message: 'productID is required in query parameters'
      });
    }

    const wishList = await WishList.findOne({ userId });

    if (!wishList) {
      return res.status(200).json({
        success: true,
        isInWishlist: false,
        message: 'Wishlist not found'
      });
    }

    // Check if product ID is in wishlist (normalize to string for comparison)
    const productIdStr = productID.toString();
    const isInWishlist = wishList.wishListProduct.includes(productIdStr);

    return res.status(200).json({
      success: true,
      isInWishlist: isInWishlist,
      // productID: productID,
      data: productID,
      message: isInWishlist ? 'Product is in wishlist' : 'Product is not in wishlist'
    });

  } catch (e) {
    console.error('Error checking wishlist status:', e);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: e.message
    });
  }
};

/**
 * GET /api/wishlist/products/:userId
 * Returns wishlist with all products populated (ShopProduct + part + shop).
 * Wishlist stores ShopProduct IDs; fetches from ShopProduct, cart-like format.
 */
function formatWishlistProduct(sp) {
  if (!sp) return null;
  const shop = sp.shopId;
  const sd = shop?.shopeDetails;
  const shopInfo = shop && sd ? {
    _id: shop._id,
    shopName: sd.shopName || null,
    shopAddress: sd.shopAddress || null,
    shopContact: sd.shopContact || null,
    shopMail: sd.shopMail || null,
    shopLocation: sd.shopLocation || null
  } : null;
  return {
    shopProductId: sp._id,
    price: sp.price,
    discountedPrice: sp.discountedPrice,
    stock: sp.stock,
    part: sp.part,
    shop: shopInfo
  };
}

exports.getWishListWithProducts = async (req, res) => {
  try {
    const userId = req.params.userId;
    const wishList = await WishList.findOne({ userId });

    if (!wishList || !wishList.wishListProduct.length) {
      return res.status(200).json({
        message: 'Wishlist not found or empty',
        success: true,
        data: [],
        productIds: []
      });
    }

    const productIds = wishList.wishListProduct.map((id) => new mongoose.Types.ObjectId(id));
    const shopProducts = await ShopProduct.find({ _id: { $in: productIds } })
      .populate({ path: 'part', populate: ['category', 'subCategory'] })
      .populate({ path: 'shopId', select: 'shopeDetails' })
      .lean();

    const data = shopProducts.map(formatWishlistProduct).filter(Boolean);

    return res.status(200).json({
      message: 'Wishlist found with products',
      success: true,
      data,
      productIds: wishList.wishListProduct
    });
  } catch (e) {
    console.error('Error fetching wishlist with products:', e);
    res.status(500).json({
      message: 'Internal server error',
      success: false,
      error: e.message
    });
  }
};

// GET WISHLIST PRODUCT IDS ONLY (Lightweight endpoint for status checking)
exports.getWishlistProductIds = async (req, res) => {
  try {
    const userId = req.params.userId;
    const wishList = await WishList.findOne({ userId });

    if (!wishList) {
      return res.status(200).json({
        success: true,
        // productIds: [],
        data: [],
        count: 0,
        message: 'Wishlist not found'
      });
    }

    return res.status(200).json({
      success: true,
      // productIds: wishList.wishListProduct,
      data: wishList.wishListProduct,
      count: wishList.wishListProduct.length,
      message: 'Wishlist product IDs retrieved'
    });

  } catch (e) {
    console.error('Error fetching wishlist product IDs:', e);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: e.message
    });
  }
};

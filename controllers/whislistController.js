const mongoose = require('mongoose');
const WishList = require('../models/WishList');
const Product = require('../models/_deprecated/Product');
const ShopProduct = require('../models/ShopProduct');
const logger = require('../config/logger'); // ← only addition at top

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

    if (productID) productIDs = [productID];

    let wishList = await WishList.findOne({ userId });

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
    logger.error('addToWishList failed', { userId: req.params.userId, error: error.message, stack: error.stack }); // ← replaced console.error
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
      });
    }

    const productIds = wishList.wishListProduct.map(id => new mongoose.Types.ObjectId(id));
    const shopProducts = await ShopProduct.find({ _id: { $in: productIds } })
      .populate({ path: 'part', select: 'isActive' })
      .lean();

    const activeProductIds = shopProducts
      .filter(sp => sp.part && sp.part.isActive === true)
      .map(sp => sp._id.toString());

    return res.status(200).json({
      message: 'Wishlist found with products',
      success: true,
      data: activeProductIds,
    });

  } catch (e) {
    logger.error('getWishList failed', { userId: req.params.userId, error: e.message, stack: e.stack }); // ← replaced console.error
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};

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

    const productIdStr = productID.toString();
    const isInWishlist = wishList.wishListProduct.includes(productIdStr);

    return res.status(200).json({
      success: true,
      isInWishlist: isInWishlist,
      data: productID,
      message: isInWishlist ? 'Product is in wishlist' : 'Product is not in wishlist'
    });

  } catch (e) {
    logger.error('checkWishlistStatus failed', { userId: req.params.userId, productID: req.query.productID, error: e.message, stack: e.stack }); // ← replaced console.error
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: e.message
    });
  }
};

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

    const activeShopProducts = shopProducts.filter(sp => sp.part && sp.part.isActive === true);
    const data = activeShopProducts.map(formatWishlistProduct).filter(Boolean);

    return res.status(200).json({
      message: 'Wishlist found with products',
      success: true,
      data,
      productIds: wishList.wishListProduct
    });
  } catch (e) {
    logger.error('getWishListWithProducts failed', { userId: req.params.userId, error: e.message, stack: e.stack }); // ← replaced console.error
    res.status(500).json({
      message: 'Internal server error',
      success: false,
      error: e.message
    });
  }
};

exports.getWishlistProductIds = async (req, res) => {
  try {
    const userId = req.params.userId;
    const wishList = await WishList.findOne({ userId });

    if (!wishList) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        message: 'Wishlist not found'
      });
    }

    const productIds = wishList.wishListProduct.map(id => new mongoose.Types.ObjectId(id));
    const shopProducts = await ShopProduct.find({ _id: { $in: productIds } })
      .populate({ path: 'part', select: 'isActive' })
      .lean();

    const activeProductIds = shopProducts
      .filter(sp => sp.part && sp.part.isActive === true)
      .map(sp => sp._id.toString());

    return res.status(200).json({
      success: true,
      data: activeProductIds,
      count: activeProductIds.length,
      message: 'Wishlist product IDs retrieved'
    });

  } catch (e) {
    logger.error('getWishlistProductIds failed', { userId: req.params.userId, error: e.message, stack: e.stack }); // ← replaced console.error
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: e.message
    });
  }
};
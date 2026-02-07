// controllers/productRatingController.js
const ProductRating = require('../models/ProductRating');
const Order = require('../models/Order');
const ShopProduct = require('../models/ShopProduct');

/**
 * Check if user is eligible to rate a product
 * User must have purchased the product AND order must be delivered
 */
const checkEligibility = async (userId, shopProductId, orderId) => {
  const order = await Order.findOne({
    _id: orderId,
    userId: userId,
    'items.shopProductId': shopProductId
  });

  if (!order) {
    return { eligible: false, message: 'Order not found or product not in order' };
  }

  // Check if order status is 'Delivered'
  const isDelivered = order.status === 'Delivered' ||
    order.statusHistory?.some(h => h.status === 'Delivered');

  if (!isDelivered) {
    return { eligible: false, message: 'You can only rate products after delivery' };
  }

  return { eligible: true, order };
};

/**
 * Add a rating/review for a product
 * POST /api/rating
 */
exports.addRating = async (req, res) => {
  try {
    const { userId, shopProductId, orderId, rating, comment, images } = req.body;

    // Validate required fields
    if (!userId || !shopProductId || !orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'userId, shopProductId, orderId, and rating are required'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check eligibility (purchased + delivered)
    const eligibility = await checkEligibility(userId, shopProductId, orderId);
    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: eligibility.message
      });
    }

    // Get shop ID from shopProduct
    const shopProduct = await ShopProduct.findById(shopProductId);
    if (!shopProduct) {
      return res.status(404).json({
        success: false,
        message: 'Shop product not found'
      });
    }

    // Check if user already rated this product from this order
    const existingRating = await ProductRating.findOne({
      userId,
      shopProductId,
      orderId
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this product for this order'
      });
    }

    // Create the rating
    const newRating = new ProductRating({
      userId,
      shopId: shopProduct.shopId,
      shopProductId,
      orderId,
      rating,
      comment: comment || '',
      images: images || []
    });

    await newRating.save();

    res.status(201).json({
      success: true,
      message: 'Rating added successfully',
      data: newRating
    });

  } catch (err) {
    console.error('Add rating error:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this product for this order'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to add rating'
    });
  }
};

/**
 * Update a rating/review
 * PUT /api/rating/:ratingId
 */
exports.updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { userId, rating, comment, images } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const existingRating = await ProductRating.findById(ratingId);

    if (!existingRating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Ensure user owns this rating
    if (existingRating.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own ratings'
      });
    }

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      existingRating.rating = rating;
    }

    if (comment !== undefined) {
      existingRating.comment = comment;
    }

    if (images !== undefined) {
      existingRating.images = images;
    }

    await existingRating.save();

    res.json({
      success: true,
      message: 'Rating updated successfully',
      data: existingRating
    });

  } catch (err) {
    console.error('Update rating error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update rating'
    });
  }
};

/**
 * Delete a rating
 * DELETE /api/rating/:ratingId
 */
exports.deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const rating = await ProductRating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Ensure user owns this rating
    if (rating.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own ratings'
      });
    }

    await ProductRating.findByIdAndDelete(ratingId);

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });

  } catch (err) {
    console.error('Delete rating error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rating'
    });
  }
};

/**
 * Get all ratings for a shop product (same product, specific shop)
 * GET /api/rating/product/:shopProductId
 */
exports.getRatingsByShopProduct = async (req, res) => {
  try {
    const { shopProductId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await ProductRating.find({
      shopProductId,
      isVisible: true
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ProductRating.countDocuments({
      shopProductId,
      isVisible: true
    });

    // Calculate average rating
    const avgResult = await ProductRating.aggregate([
      { $match: { shopProductId: require('mongoose').Types.ObjectId.createFromHexString(shopProductId), isVisible: true } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const avgRating = avgResult.length > 0 ? avgResult[0].avgRating : 0;
    const totalReviews = avgResult.length > 0 ? avgResult[0].count : 0;

    res.json({
      success: true,
      data: {
        ratings,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings'
    });
  }
};

/**
 * Get all ratings for a part across all shops
 * GET /api/rating/part/:partId
 */
exports.getRatingsByPart = async (req, res) => {
  try {
    const { partId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Find all shop products for this part
    const shopProducts = await ShopProduct.find({ part: partId });
    const shopProductIds = shopProducts.map(sp => sp._id);

    const ratings = await ProductRating.find({
      shopProductId: { $in: shopProductIds },
      isVisible: true
    })
      .populate('userId', 'name')
      .populate({
        path: 'shopId',
        select: 'shopeDetails'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ProductRating.countDocuments({
      shopProductId: { $in: shopProductIds },
      isVisible: true
    });

    // Calculate average rating across all shops
    const avgResult = await ProductRating.aggregate([
      { $match: { shopProductId: { $in: shopProductIds }, isVisible: true } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const avgRating = avgResult.length > 0 ? avgResult[0].avgRating : 0;
    const totalReviews = avgResult.length > 0 ? avgResult[0].count : 0;

    res.json({
      success: true,
      data: {
        ratings,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get ratings by part error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings'
    });
  }
};

/**
 * Get all ratings for a shop
 * GET /api/rating/shop/:shopId
 */
exports.getRatingsByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await ProductRating.find({
      shopId,
      isVisible: true
    })
      .populate('userId', 'name')
      .populate({
        path: 'shopProductId',
        populate: { path: 'part', select: 'partName partNumber' }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ProductRating.countDocuments({
      shopId,
      isVisible: true
    });

    // Calculate average rating for the shop
    const avgResult = await ProductRating.aggregate([
      { $match: { shopId: require('mongoose').Types.ObjectId.createFromHexString(shopId), isVisible: true } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const avgRating = avgResult.length > 0 ? avgResult[0].avgRating : 0;
    const totalReviews = avgResult.length > 0 ? avgResult[0].count : 0;

    res.json({
      success: true,
      data: {
        ratings,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get shop ratings error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shop ratings'
    });
  }
};

/**
 * Get user's own ratings
 * GET /api/rating/user/:userId
 */
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await ProductRating.find({ userId })
      .populate({
        path: 'shopProductId',
        populate: { path: 'part', select: 'partName partNumber images' }
      })
      .populate({
        path: 'shopId',
        select: 'shopeDetails'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ProductRating.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get user ratings error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user ratings'
    });
  }
};

/**
 * Check if user can rate a product (for UI to show/hide rating option)
 * GET /api/rating/can-rate
 */
exports.canRate = async (req, res) => {
  try {
    const { userId, shopProductId, orderId } = req.query;

    if (!userId || !shopProductId || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'userId, shopProductId, and orderId are required'
      });
    }

    // Check eligibility
    const eligibility = await checkEligibility(userId, shopProductId, orderId);

    if (!eligibility.eligible) {
      return res.json({
        success: true,
        canRate: false,
        reason: eligibility.message
      });
    }

    // Check if already rated
    const existingRating = await ProductRating.findOne({
      userId,
      shopProductId,
      orderId
    });

    if (existingRating) {
      return res.json({
        success: true,
        canRate: false,
        reason: 'Already rated',
        existingRating
      });
    }

    res.json({
      success: true,
      canRate: true
    });

  } catch (err) {
    console.error('Can rate check error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to check rating eligibility'
    });
  }
};

/**
 * Get rating summary for a shop product
 * GET /api/rating/summary/:shopProductId
 */
exports.getRatingSummary = async (req, res) => {
  try {
    const { shopProductId } = req.params;

    const summary = await ProductRating.aggregate([
      {
        $match: {
          shopProductId: require('mongoose').Types.ObjectId.createFromHexString(shopProductId),
          isVisible: true
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate overall stats
    const statsResult = await ProductRating.aggregate([
      {
        $match: {
          shopProductId: require('mongoose').Types.ObjectId.createFromHexString(shopProductId),
          isVisible: true
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    // Format distribution (1-5 stars)
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    summary.forEach(item => {
      distribution[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        averageRating: statsResult.length > 0 ? Math.round(statsResult[0].avgRating * 10) / 10 : 0,
        totalReviews: statsResult.length > 0 ? statsResult[0].totalReviews : 0,
        distribution
      }
    });

  } catch (err) {
    console.error('Get rating summary error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rating summary'
    });
  }
};

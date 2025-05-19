const Stock = require('../models/Stock');
const { Product } = require('../models/Product'); 
const mongoose = require('mongoose');

// 1. View all stock for a shop

exports.getStockByShop = async (req, res) => {
  try {
    const stocks = await Stock.find({ shopId: req.params.shopId });

    const enrichedStocks = await Promise.all(stocks.map(async (stock) => {
      console.log('🔍 Matching ProductId:', stock.productId);
      const productDoc = await Product.aggregate([
        { $match: { shopId: stock.shopId.toString() } },
        { $unwind: '$products' },
        {
          $match: {
            $expr: {
              $eq: ['$products._id', new mongoose.Types.ObjectId(stock.productId)]
            }
          }
        },
        { $project: { productDetails: '$products' } },
        { $limit: 1 }
      ]);
      const productDetails = productDoc.length > 0 ? productDoc[0].productDetails : null;

      return {
        ...stock.toObject(),
        productDetails
      };
    }));

    let {
      category,
      status,
      from,
      to,
      minThreshold,
      maxThreshold
    } = req.query;

    if (status === 'Low Stock') status = 'low';
    else if (status === 'Out of Stock') status = 'out';
    else if (status === 'In Stock') status = 'in';

    let filteredStocks = enrichedStocks;

    if (category) {
      filteredStocks = filteredStocks.filter(s => s.productDetails?.category === category);
    }

    if (status === 'low') {
      filteredStocks = filteredStocks.filter(s => s.quantity < s.threshold);
    } else if (status === 'out') {
      filteredStocks = filteredStocks.filter(s => s.quantity === 0);
    } else if (status === 'in') {
      filteredStocks = filteredStocks.filter(s => s.quantity > s.threshold);
    }

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      filteredStocks = filteredStocks.filter(s =>
        new Date(s.updatedAt) >= fromDate && new Date(s.updatedAt) <= toDate
      );
    }

    if (minThreshold) {
      filteredStocks = filteredStocks.filter(s => s.threshold >= parseInt(minThreshold));
    }

    if (maxThreshold) {
      filteredStocks = filteredStocks.filter(s => s.threshold <= parseInt(maxThreshold));
    }

    res.json({
      message: 'Stock fetched with filters',
      success: true,
      data: filteredStocks
    });

  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch stock',
      success: false,
      data: err.message
    });
  }
};

  

// 2. View stock for a specific product
exports.getStockByProduct = async (req, res) => {
  try {
    const stock = await Stock.findOne({
      shopId: req.params.shopId,
      productId: req.params.productId
    }).populate('productId');

    if (!stock) return res.status(404).json({ message: 'No stock found', success: false });
    res.json({ message: 'Stock fetched', success: true, data: stock });
  } catch (err) {
    res.status(500).json({ message: 'Error', success: false, data: err.message });
  }
};

// 3. Add or update stock
exports.addOrUpdateStock = async (req, res) => {
    try {
      const { shopId, productId, quantity, threshold } = req.body;
  
      // ✅ Validate that this product belongs to this shop
      const productRecord = await Product.findOne({
        shopId: shopId,
        'products._id': productId
      });
  
      if (!productRecord) {
        return res.status(400).json({
          message: 'Product not linked to the given shop',
          success: false
        });
      }
  
      // ⬇ continue with add/update
      let stock = await Stock.findOne({ shopId, productId });
  
      if (stock) {
        stock.quantity += quantity;
        stock.threshold = threshold ?? stock.threshold;
        stock.lastRestockedAt = new Date();
        await stock.save();
      } else {
        stock = await Stock.create({
          shopId,
          productId,
          quantity,
          threshold,
          lastRestockedAt: new Date()
        });
      }
  
      res.json({ message: 'Stock updated', success: true, data: stock });
  
    } catch (err) {
      res.status(500).json({ message: 'Failed to update stock', success: false, data: err.message });
    }
  };

// 4. Adjust stock (e.g. -1 on sale, +1 on return)
exports.adjustStock = async (req, res) => {
    try {
      const { shopId, productId, adjustment } = req.body;
  
      // 🔒 Validate input presence
      if (!shopId || !productId || typeof adjustment !== 'number') {
        return res.status(400).json({
          message: 'shopId, productId, and numeric adjustment are required',
          success: false
        });
      }
  
      // 🔒 Validate ObjectId format
      if (
        !mongoose.Types.ObjectId.isValid(shopId) ||
        !mongoose.Types.ObjectId.isValid(productId)
      ) {
        return res.status(400).json({
          message: 'Invalid shopId or productId',
          success: false
        });
      }
  
      // 🔒 Check if product belongs to the shop
      const productExists = await Product.findOne({
        shopId,
        'products._id': productId
      });
  
      if (!productExists) {
        return res.status(400).json({
          message: 'Product is not assigned to the given shop',
          success: false
        });
      }
  
      // 🔄 Adjust stock if entry exists
      const stock = await Stock.findOne({ shopId, productId });
  
      if (!stock) {
        return res.status(404).json({
          message: 'Stock record not found for this product and shop',
          success: false
        });
      }
  
      const newQuantity = stock.quantity + adjustment;
  
      if (newQuantity < 0) {
        return res.status(400).json({
          message: `Stock can't go below zero. Current: ${stock.quantity}`,
          success: false
        });
      }
  
      stock.quantity = newQuantity;
      await stock.save();
  
      return res.status(200).json({
        message: 'Stock adjusted successfully',
        success: true,
        data: stock
      });
  
    } catch (err) {
      console.error('Adjust Stock Error:', err);
      return res.status(500).json({
        message: 'Failed to adjust stock',
        success: false,
        data: err.message
      });
    }
  };

// 5. View low stock items
exports.getLowStockItems = async (req, res) => {
    try {
      const shopId = req.params.shopId;
  
      const stocks = await Stock.find({
        shopId,
        $expr: { $lt: ['$quantity', '$threshold'] }
      });
  
      const enrichedStocks = await Promise.all(stocks.map(async (stock) => {
        const productDoc = await Product.aggregate([
          { $match: { shopId: stock.shopId } },
          { $unwind: '$products' },
          {
            $match: {
              $expr: {
                $eq: ['$products._id', new mongoose.Types.ObjectId(stock.productId)]
              }
            }
          },
          { $project: { productDetails: '$products' } },
          { $limit: 1 }
        ]);
        const productDetails = productDoc.length > 0 ? productDoc[0].productDetails : null;

        return {
          ...stock.toObject(),
          productDetails
        };
      }));
  
      return res.status(200).json({
        message: 'Low stock fetched successfully',
        success: true,
        data: enrichedStocks
      });
  
    } catch (err) {
      console.error('Low stock error:', err);
      return res.status(500).json({
        message: 'Failed to fetch low stock',
        success: false,
        data: err.message
      });
    }
  };

// 6. Delete stock
exports.deleteStockItem = async (req, res) => {
  try {
    const deleted = await Stock.findByIdAndDelete(req.params.stockId);
    if (!deleted) return res.status(404).json({ message: 'Not found', success: false });

    res.json({ message: 'Stock deleted', success: true });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', success: false, data: err.message });
  }
};


exports.searchAndFilterStock = async (req, res) => {
    try {
      const {
        search,
        stockStatus, // 'low', 'out', 'in'
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sort = 'desc'
      } = req.query;
  
      const { shopId } = req.params;
      const skip = (page - 1) * limit;
  
      // Get all stock entries for the shop
      let baseStockQuery = { shopId };
  
      const allStocks = await Stock.find(baseStockQuery)
        .sort({ [sortBy]: sort === 'asc' ? 1 : -1 });
  
      // Filter and enrich
      const enriched = await Promise.all(
        allStocks.map(async (stock) => {
          const productDoc = await Product.aggregate([
            { $match: { shopId: stock.shopId } },
            { $unwind: '$products' },
            {
              $match: {
                $expr: {
                  $eq: ['$products._id', new mongoose.Types.ObjectId(stock.productId)]
                }
              }
            },
            { $project: { productDetails: '$products' } },
            { $limit: 1 }
          ]);
          const product = productDoc.length > 0 ? productDoc[0].productDetails : null;
  
          return {
            ...stock.toObject(),
            productDetails: product
          };
        })
      );
  
      // Apply search + stockStatus filters
      let filtered = enriched;
  
      if (search) {
        filtered = filtered.filter(s =>
          s.productDetails?.name?.toLowerCase().includes(search.toLowerCase())
        );
      }
  
      if (stockStatus === 'low') {
        filtered = filtered.filter(s => s.quantity < s.threshold);
      } else if (stockStatus === 'out') {
        filtered = filtered.filter(s => s.quantity === 0);
      } else if (stockStatus === 'in') {
        filtered = filtered.filter(s => s.quantity > s.threshold);
      }
  
      const paginated = filtered.slice(skip, skip + parseInt(limit));
  
      res.status(200).json({
        message: 'Stock search and filter success',
        success: true,
        total: filtered.length,
        page: parseInt(page),
        limit: parseInt(limit),
        data: paginated
      });
  
    } catch (err) {
      console.error('Stock search error:', err.message);
      res.status(500).json({
        message: 'Failed to search/filter stock',
        success: false,
        data: err.message
      });
    }
  };
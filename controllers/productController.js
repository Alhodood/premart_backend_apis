const Product = require('../models/Product');

const { Shop } = require('../models/Shop');

const Brand=  require('../models/Brand');

const Year=  require('../models/Year');
const Category=  require('../models/Categories');


const Fuel = require('../models/Fuel');
const Model = require('../models/Model');



// upload files  common function

 exports.fileUpload = async (req, res) => {

  console.log("file upload funtion is calling");
    if (!req?.file) {
        res.status(403).json({ status: false, error: "please upload a file" })
        return;
    }
    let data = {}
    if (!!req?.file) {
        data = {
            url: req.file.location,
            type: req.file.mimetype
        }
    }
    try {
        res.send({
            data: data,
            status: true
        })
    } catch (error) {
        res.status(403).json({ status: false, error: error })
    }

};

// Get similar products by brand, model, and category
exports.getSimilarProducts = async (req, res) => {
  try {
    const { brand, model, categoryTab } = req.query;

    if (!brand || !model || !categoryTab) {
      return res.status(400).json({
        message: 'brand, model, and categoryTab query parameters are required',
        success: false
      });
    }

    const products = await Product.find({
      brand: brand,
      model: model,
      subCategories: {
        $elemMatch: { categoryTab: categoryTab }
      }
    }).lean();

    return res.status(200).json({
      message: 'Similar products retrieved',
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get Similar Products Error:', error);
    return res.status(500).json({ message: 'Failed to retrieve similar products', success: false, error: error.message });
  }
};

// Get products by part number
exports.getProductsByPartNumber = async (req, res) => {
  try {
    const partNumber = req.params.partNumber?.trim();
    if (!partNumber) {
      return res.status(400).json({ message: 'Part number is required', success: false });
    }

    const products = await Product.find({
      'subCategories.parts.partNumber': partNumber
    }).lean();

    return res.status(200).json({
      message: 'Products by part number',
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get Products by Part Number Error:', error);
    return res.status(500).json({ message: 'Error fetching products by part number', success: false, data: error.message });
  }
};

// Get parts by part number
exports.getPartsByPartNumber = async (req, res) => {
  try {
    const partNumber = req.params.partNumber?.trim();
    if (!partNumber) {
      return res.status(400).json({ message: 'Part number is required', success: false });
    }

    const products = await Product.find({
      'subCategories.parts.partNumber': partNumber
    }).lean();

    const matchedParts = [];

    for (const product of products) {
      for (const subCategory of product.subCategories || []) {
        for (const part of subCategory.parts || []) {
          if (part.partNumber === partNumber) {
            matchedParts.push({
              productId: product._id,
              productModel: product.model,
              categoryTab: subCategory.categoryTab,
              ...part
            });
          }
        }
      }
    }

    return res.status(200).json({
      message: 'Parts by part number',
      success: true,
      data: matchedParts
    });
  } catch (error) {
    console.error('Get Parts by Part Number Error:', error);
    return res.status(500).json({ message: 'Error fetching parts by part number', success: false, data: error.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().lean();
    res.status(200).json({
      message: 'All products retrieved successfully',
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({
      message: 'Failed to retrieve products',
      success: false,
      error: error.message
    });
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    // Commented out: any filter/search logic
    // const { search, filter } = req.query;
    // let query = {};
    // if (search) { ... }
    // if (filter) { ... }
    const products = await Product.find().lean();
    // Flatten and map products to only required fields
    const simplified = products.map(product => {
      // Extract from root
      const {
        _id, brand, year, model, frameCode, region, engineCode, transmission,
        productionStart, productionEnd, shopId, createdAt, ratings = {}
      } = product;
      // Extract from first subCategory
      const firstSubCategory = (product.subCategories && product.subCategories.length > 0)
        ? product.subCategories[0]
        : {};
      const category = firstSubCategory.categoryTab;
      // Extract from first part in first subCategory
      const firstPart = (firstSubCategory.parts && firstSubCategory.parts.length > 0)
        ? firstSubCategory.parts[0]
        : {};
      const {
        partNumber, partName, quantity, price, discountedPrice, description
      } = firstPart;
      // Extract ratings fields
      const average = ratings.average;
      const totalReviews = ratings.totalReviews;
      return {
        _id,
        brand,
        year,
        model,
        frameCode,
        region,
        engineCode,
        transmission,
        productionStart,
        productionEnd,
        shopId,
        createdAt,
        'ratings': average,
        'totalReviews': totalReviews,
        category,
        partNumber,
        partName,
        quantity,
        price,
        discountedPrice,
        description
      };
    });
    res.status(200).json({
      message: 'All products retrieved successfully',
      success: true,
      data: simplified
    });
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({
      message: 'Failed to retrieve products',
      success: false,
      error: error.message
    });
  }
};


// Get all product part in single API - (Brand, category, year, )



exports.getProductElement = async (req, res) => {
  try {
    const brands = await Brand.find({ visibility: true }).lean();
    const fuels = await Fuel.find({ visibility: true }).lean();
    const models = await Model.find({ visibility: true }).lean();
    const years = await Year.find({ visibility: true }).lean();
    const categories = await Category.find({ visibility: true }).lean();

    // 🔄 Flatten products and attach shopId to each product
    const productDocs = await Product.find().lean();
    const productDetails = productDocs.flatMap(doc => {
      return (doc.products || []).map(product => ({
        ...product,
        shopId: doc.shopId
      }));
    });

    return res.status(200).json({
      message: 'Master data fetched successfully',
      success: true,
      data: {
        brands,
        fuels,
        models,
        years,
        categories,
        productDetails
      }
    });
  } catch (error) {
    console.error('Master Data Fetch Error:', error);
    res.status(500).json({
      message: 'Failed to fetch master data',
      success: false,
      error: error.message
    });
  }
};


// Create or add a product to shop's products array (no variants handling)
exports.addProduct = async (req, res) => {
  try {
    const shopId = req.query.shopId;
    const productData = req.body;

    if (!shopId || !productData) {
      return res.status(400).json({ success: false, message: 'Missing shopId or productData' });
    }

    // Create a new product
    const newProduct = new Product({ ...productData, shopId });
    await newProduct.save();

    const productIdObject = newProduct._id;

    // Push the productId into the Shop's products array
    await Shop.findOneAndUpdate(
  { _id: shopId }, // ✅ match by Mongo ObjectId
  { $push: { products: productIdObject } },
  { new: true }
);

    return res.status(201).json({
      message: 'Product created and linked successfully',
      success: true,
      data: newProduct
    });

  } catch (err) {
    console.error('Create Product Error:', err);
    res.status(500).json({
      message: 'Failed to create product',
      success: false,
      data: err.message
    });
  }
};


// Get all products for a shop
exports.getProductsByShop = async (req, res) => {
  try {
    const shopId = req.params.shopId || req.query.shopId;
    console.log('Looking for shopId:', shopId);
    const productEntry = await Product.find({ shopId });


    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [],success:false });
    }

    return res.status(200).json({ message: 'Products retrieved', data: productEntry, success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', data: error.message,success:false });
  }
};

const mongoose = require('mongoose');

exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }

    // Fetch the product using findOne to be extra safe
    const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(productId) }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: product
    });
  } catch (error) {
    console.error('Get Product By ID Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update a product
// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const productId = req.params.productId;
    const updates = req.body;

    // Find the shop by shopId
    const productEntry = await Product.findOne({ shopId });
    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [], success: false });
    }

    // Find the product by productId within the products array
    const product = productEntry.products.id(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found', data: [], success: false });
    }

    // Update the product with new data
    Object.assign(product, updates);

    // Save the updated shop
    await productEntry.save();

    return res.status(200).json({ message: 'Product updated', data: product, success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product', error: error.message, data: [], success: false });
  }
};


// Delete a product
// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const productId = req.params.productId;

    // Find the shop by shopId
    const productEntry = await Product.findOne({ shopId });
    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [], success: false });
    }

    // Find the product within the products array by productId
    const product = productEntry.products.id(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found', data: [], success: false });
    }

    // Remove the product from the products array
    product.deleteOne();
    await productEntry.save();

    return res.status(200).json({ message: 'Product deleted', data: productEntry, success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete product', error: error.message, success: false });
  }
};

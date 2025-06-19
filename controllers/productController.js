const Banner = require('../models/Banners');
const { v4: uuidv4 } = require('uuid');
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
      const {
        _id, brand, year, model, frameCode, region, engineCode, transmission,
        productionStart, productionEnd, shopId, createdAt, ratings = {}, commonProductId
      } = product;

      const firstSubCategory = (product.subCategories && product.subCategories.length > 0)
        ? product.subCategories[0]
        : {};

      const {
        categoryTab,
        categoryTabImageUrl = [],
        subCategoryTab,
        subCategoryTabImageUrl = [],
        parts = []
      } = firstSubCategory;

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
        ratings: average,
        totalReviews: totalReviews,
        categoryTab,
        categoryTabImageUrl,
        subCategoryTab,
        subCategoryTabImageUrl,
        parts,
        commonProductId,
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

    // Fetch banners and include them in the response
    const banners = await Banner.find({ isActive: true }).lean();

    return res.status(200).json({
      message: 'Master data fetched successfully',
      success: true,
      data: {
        brands,
        fuels,
        models,
        years,
        categories,
        productDetails,
        banners
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


// Create or add a product to all shops' products arrays
exports.addProduct = async (req, res) => {
  try {
    const productData = req.body;

    if (!productData) {
      return res.status(400).json({ success: false, message: 'Missing productData' });
    }

    const shops = await Shop.find().lean();
    if (!shops || shops.length === 0) {
      return res.status(404).json({ success: false, message: 'No shops found' });
    }

    const createdProducts = [];

    const commonProductId = uuidv4();

    for (const shop of shops) {
      const shopId = shop._id;
      const newProduct = new Product({ ...productData, shopId, commonProductId });
      await newProduct.save();
      createdProducts.push(newProduct);

      await Shop.findByIdAndUpdate(shopId, { $push: { products: newProduct._id } });
    }

    return res.status(201).json({
      message: 'Product created and linked to all shops successfully',
      success: true,
      data: createdProducts
    });

  } catch (err) {
    console.error('Create Product Error:', err);
    res.status(500).json({
      message: 'Failed to create product for all shops',
      success: false,
      data: err.message
    });
  }
};


// Bulk product upload using Excel
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

exports.bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', success: false });
    }

    const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const shops = await Shop.find().lean();
    if (!shops || shops.length === 0) {
      return res.status(404).json({ message: 'No shops found', success: false });
    }

    const createdProducts = [];

    // Use dynamic commonProductId based on product details
    let lastKey = '';
    let currentCommonId = uuidv4();

    for (const row of worksheet) {
      // Generate a key based on product details
      const rowKey = `${row.brand}_${row.model}_${row.year}_${row.frameCode}_${row.engineCode}_${row.transmission}_${row.categoryTab}_${row.subCategoryTab}`;
      if (rowKey !== lastKey) {
        currentCommonId = uuidv4();
        lastKey = rowKey;
      }

      const {
        brand,
        year,
        model,
        frameCode,
        region,
        engineCode,
        transmission,
        categoryTab,
        categoryTabImageUrl,
        subCategoryTab,
        subCategoryTabImageUrl,
        partNumber,
        partName,
        quantity,
        price,
        discountedPrice,
        description,
        imageUrl,
        notes,
        madeIn,
        skuNumber,
        stockStatus
      } = row;

      const part = {
        partNumber,
        partName,
        quantity,
        price,
        discountedPrice,
        description,
        imageUrl: imageUrl ? imageUrl.split(',') : [],
        notes,
        stockStatus: stockStatus || 'in_stock',
        madeIn,
        skuNumber
      };

      const subCategory = {
        categoryTab,
        categoryTabImageUrl: categoryTabImageUrl ? categoryTabImageUrl.split(',') : [],
        subCategoryTab,
        subCategoryTabImageUrl: subCategoryTabImageUrl ? subCategoryTabImageUrl.split(',') : [],
        parts: [part]
      };

      for (const shop of shops) {
        const product = new Product({
          brand,
          year,
          model,
          frameCode,
          region,
          engineCode,
          transmission,
          shopId: shop._id,
          subCategories: [subCategory],
          ratings: {
            average: 0,
            totalReviews: 0
          },
          commonProductId: currentCommonId // use the generated commonProductId per group
        });

        await product.save();
        createdProducts.push(product);

        await Shop.findByIdAndUpdate(shop._id, { $push: { products: product._id } });
      }
    }

    fs.unlinkSync(filePath); // Delete file after processing

    return res.status(201).json({
      message: 'Bulk products uploaded successfully',
      success: true,
      data: createdProducts
    });

  } catch (error) {
    console.error('Bulk Upload Error:', error);
    return res.status(500).json({ message: 'Failed to upload bulk products', success: false, error: error.message });
  }
};

// Bulk upload products for a specific shop
exports.bulkUploadProductsForShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', success: false });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const createdProducts = [];

    // Use dynamic commonProductId based on product details
    let lastKey = '';
    let currentCommonId = uuidv4();

    for (const row of worksheet) {
      // Generate a key based on product details
      const rowKey = `${row.brand}_${row.model}_${row.year}_${row.frameCode}_${row.engineCode}_${row.transmission}_${row.categoryTab}_${row.subCategoryTab}`;
      if (rowKey !== lastKey) {
        currentCommonId = uuidv4();
        lastKey = rowKey;
      }

      const {
        brand,
        year,
        model,
        frameCode,
        region,
        engineCode,
        transmission,
        categoryTab,
        categoryTabImageUrl,
        subCategoryTab,
        subCategoryTabImageUrl,
        partNumber,
        partName,
        quantity,
        price,
        discountedPrice,
        description,
        imageUrl,
        notes,
        madeIn,
        skuNumber,
        stockStatus
      } = row;

      const part = {
        partNumber,
        partName,
        quantity,
        price,
        discountedPrice,
        description,
        imageUrl: imageUrl ? imageUrl.split(',') : [],
        notes,
        stockStatus: stockStatus || 'in_stock',
        madeIn,
        skuNumber
      };

      const subCategory = {
        categoryTab,
        categoryTabImageUrl: categoryTabImageUrl ? categoryTabImageUrl.split(',') : [],
        subCategoryTab,
        subCategoryTabImageUrl: subCategoryTabImageUrl ? subCategoryTabImageUrl.split(',') : [],
        parts: [part]
      };

      const product = new Product({
        brand,
        year,
        model,
        frameCode,
        region,
        engineCode,
        transmission,
        shopId,
        subCategories: [subCategory],
        ratings: {
          average: 0,
          totalReviews: 0
        },
        commonProductId: currentCommonId // use the generated commonProductId per group
      });

      await product.save();
      createdProducts.push(product);

      await Shop.findByIdAndUpdate(shopId, { $push: { products: product._id } });
    }

    fs.unlinkSync(filePath); // Delete file after processing

    return res.status(201).json({
      message: 'Bulk products uploaded successfully for the shop',
      success: true,
      data: createdProducts
    });

  } catch (error) {
    console.error('Bulk Upload for Shop Error:', error);
    return res.status(500).json({
      message: 'Failed to upload bulk products for shop',
      success: false,
      error: error.message
    });
  }
};




// Get all products for a shop with simplified fields
exports.getProductsByShop = async (req, res) => {
  try {
    const shopId = req.params.shopId || req.query.shopId;
    console.log('Looking for shopId:', shopId);
    const products = await Product.find({ shopId }).lean();

    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'No products found for this shop', data: [], success: false });
    }

    const simplified = products.map(product => {
      const {
        _id, brand, year, model, frameCode, region, engineCode, transmission,
        productionStart, productionEnd, shopId, createdAt, ratings = {}, commonProductId
      } = product;

      const firstSubCategory = (product.subCategories && product.subCategories.length > 0)
        ? product.subCategories[0]
        : {};

      const {
        categoryTab,
        categoryTabImageUrl = [],
        subCategoryTab,
        subCategoryTabImageUrl = [],
        parts = []
      } = firstSubCategory;

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
        ratings: ratings.average,
        totalReviews: ratings.totalReviews,
        categoryTab,
        categoryTabImageUrl,
        subCategoryTab,
        subCategoryTabImageUrl,
        parts,
        commonProductId
      };
    });

    return res.status(200).json({ message: 'Products retrieved', data: simplified, success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', data: error.message, success: false });
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


exports.updateProduct = async (req, res) => {
  try {
    const { commonProductId, shopId } = req.params;
    const updates = req.body;

    if (!commonProductId || !shopId) {
      return res.status(400).json({
        message: 'Missing commonProductId or shopId',
        success: false
      });
    }

    const products = await Product.find({ commonProductId, shopId });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: 'No products found with given commonProductId and shopId',
        success: false
      });
    }

    const topLevelFields = ['brand', 'year', 'model', 'frameCode', 'region', 'engineCode', 'transmission'];
    const isTopLevelUpdate = Object.keys(updates).some(key => topLevelFields.includes(key));
    const updatedProducts = [];

    for (const product of products) {
      if (isTopLevelUpdate) {
        Object.assign(product, updates);
      } else {
        const { partId, subCategoryTab, fieldsToUpdate = {} } = updates;
        if (!partId || !subCategoryTab) {
          return res.status(400).json({
            message: 'Missing partId or subCategoryTab for nested update',
            success: false
          });
        }

        for (const subCategory of product.subCategories) {
          if (subCategory.subCategoryTab === subCategoryTab) {
            const part = subCategory.parts.id(partId);
            if (part) {
              Object.entries(fieldsToUpdate).forEach(([key, value]) => {
                part[key] = value;
              });
            }
          }
        }
      }
      await product.save();
      updatedProducts.push(product);
    }

    return res.status(200).json({
      message: 'Product(s) updated successfully',
      success: true,
      data: updatedProducts
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update product',
      success: false,
      error: error.message
    });
  }
};


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

// Delete a product directly by its ID
exports.deleteProductByCommonProductId = async (req, res) => {
  try {
    const { commonProductId } = req.params;

    if (!commonProductId) {
      return res.status(400).json({ success: false, message: 'commonProductId is required' });
    }

    const deletedProducts = await Product.deleteMany({ commonProductId });

    if (deletedProducts.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No products found with given commonProductId' });
    }

    return res.status(200).json({
      success: true,
      message: 'Products deleted successfully across all shops',
      data: deletedProducts
    });
  } catch (error) {
    console.error('Delete Products by CommonProductId Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete products', error: error.message });
  }
};

// Set product rating
exports.setProductRating = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating } = req.body; // rating is the new star rating between 1 to 5

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5' });
    }

    // Fetch product by ID directly
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Calculate new rating
    const currentTotal = product.ratings.totalReviews || 0;
    const currentAverage = product.ratings.average || 0;
    const newTotal = currentTotal + 1;
    const newAverage = ((currentAverage * currentTotal) + rating) / newTotal;

    product.ratings.totalReviews = newTotal;
    product.ratings.average = parseFloat(newAverage.toFixed(1));
    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product rating updated successfully',
      data: product.ratings
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update product rating', error: error.message });
  }
};

// Get all product ratings with part details
exports.getAllProductRatings = async (req, res) => {
  try {
    const products = await Product.find().lean();

    const result = [];

    for (const product of products) {
      const { brand, model, subCategories = [], ratings } = product;

      for (const subCat of subCategories) {
        const { categoryTab, parts = [] } = subCat;

        for (const part of parts) {
          result.push({
            _id: part._id,
            brand,
            model,
            category: categoryTab,
            partNumber: part.partNumber,
            partName: part.partName,
            price: part.price,
            average: ratings?.average || 0,
            totalReviews: ratings?.totalReviews || 0
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'All product ratings with parts fetched',
      data: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch ratings', error: error.message });
  }
};
// Update price and discountedPrice of one or multiple parts inside a product document
exports.updatePartPrices = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        message: 'Updates must be a non-empty array',
        success: false
      });
    }

    let updatedParts = [];

    for (const update of updates) {
      const { partId, price, discountedPrice } = update;
      const product = await Product.findOne({
        'subCategories.parts._id': partId
      });

      if (!product) {
        continue;
      }

      let updated = false;

      for (const subCategory of product.subCategories) {
        const part = subCategory.parts.id(partId);
        if (part) {
          if (typeof price === 'number') part.price = price;
          if (typeof discountedPrice === 'number') part.discountedPrice = discountedPrice;
          updatedParts.push({ partId, price: part.price, discountedPrice: part.discountedPrice });
          updated = true;
        }
      }

      if (updated) await product.save();
    }

    return res.status(200).json({
      message: 'Parts price(s) updated successfully',
      success: true,
      data: updatedParts
    });

  } catch (error) {
    console.error('Update Part Prices Error:', error);
    return res.status(500).json({
      message: 'Failed to update part prices',
      success: false,
      error: error.message
    });
  }
};
// Create a product for a specific shop by shopId
exports.createProductForShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const productData = req.body;

    if (!shopId || !productData) {
      return res.status(400).json({ message: 'Missing shopId or productData', success: false });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    const newProduct = new Product({ ...productData, shopId });
    await newProduct.save();

    await Shop.findByIdAndUpdate(shopId, { $push: { products: newProduct._id } });

    return res.status(201).json({
      message: 'Product created successfully for the specified shop',
      success: true,
      data: newProduct
    });
  } catch (error) {
    console.error('Create Product for Shop Error:', error);
    return res.status(500).json({
      message: 'Failed to create product for the shop',
      success: false,
      error: error.message
    });
  }
};
// Update product fields across all shops for a matching commonProductId (admin only)
exports.updateProductForAllShops = async (req, res) => {
  try {
    const { commonProductId } = req.params;
    const updates = req.body;

    if (!commonProductId) {
      return res.status(400).json({ success: false, message: 'commonProductId is required' });
    }

    const products = await Product.find({ commonProductId });

    if (!products || products.length === 0) {
      return res.status(404).json({ success: false, message: 'No products found with given commonProductId across shops' });
    }

    const updatedProducts = [];

    for (const product of products) {
      Object.assign(product, updates);
      await product.save();
      updatedProducts.push(product);
    }

    return res.status(200).json({
      message: 'Product updated successfully across all shops',
      success: true,
      data: updatedProducts
    });
  } catch (error) {
    console.error('Update Product Across All Shops Error:', error);
    return res.status(500).json({
      message: 'Failed to update product across all shops',
      success: false,
      error: error.message
    });
  }
};
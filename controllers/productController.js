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

// Get products by part number with shop details using aggregation
exports.getProductsByPartNumber = async (req, res) => {
  try {
    const partNumber = req.params.partNumber?.trim();
    if (!partNumber) {
      return res.status(400).json({ message: 'Part number is required', success: false });
    }

    const products = await Product.aggregate([
      {
        $match: {
          "subCategories.parts.partNumber": partNumber
        }
      },
      {
        $lookup: {
          from: "shops",
          localField: "shopId",
          foreignField: "_id",
          as: "shopDetails"
        }
      },
      {
        $unwind: "$shopDetails"
      },
      {
        $project: {
          _id: 1,
          brand: 1,
          year: 1,
          model: 1,
          frameCode: 1,
          region: 1,
          engineCode: 1,
          transmission: 1,
          commonProductId: 1,
          shopId: 1,
          subCategories: 1,
          ratings: 1,
          createdAt: 1,
          updatedAt: 1,
          __v: 1,
          shopDetails: {
            _id: "$shopDetails._id",
            shopeDetails: "$shopDetails.shopeDetails",
            createdAt: "$shopDetails.createdAt",
            updatedAt: "$shopDetails.updatedAt",
            __v: "$shopDetails.__v"
          }
        }
      }
    ]);

    return res.status(200).json({
      message: "Products retrieved by part number",
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get Products by Part Number Error:', error);
    return res.status(500).json({ message: 'Error fetching products by part number', success: false, data: error.message });
  }
};

// Get parts by part number using aggregation and shop details
exports.getPartsByPartNumber = async (req, res) => {
  try {
    const partNumber = req.params.partNumber?.trim();
    if (!partNumber) {
      return res.status(400).json({ message: 'Part number is required', success: false });
    }

    // Find all products containing the partNumber in subCategories.parts
    const products = await Product.find({ 'subCategories.parts.partNumber': partNumber }).lean();
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Part not found" });
    }

    // Flatten all matching parts and include shop details
    const partsWithShopDetails = [];
    for (const product of products) {
      // Get shop details for this product
      const shop = product.shopId
        ? await Shop.findById(product.shopId).lean()
        : null;
      for (const subCategory of product.subCategories || []) {
        for (const part of subCategory.parts || []) {
          if (part.partNumber === partNumber) {
            partsWithShopDetails.push({
              ...part,
              productId: product._id,
              brand: product.brand,
              model: product.model,
              year: product.year,
              region: product.region,
              engineCode: product.engineCode,
              transmission: product.transmission,
              categoryTab: subCategory.categoryTab,
              subCategoryTab: subCategory.subCategoryTab,
              shopId: product.shopId,
              shopDetails: shop || {}
            });
          }
        }
      }
    }

    if (partsWithShopDetails.length === 0) {
      return res.status(404).json({ message: "Part not found" });
    }

    res.status(200).json({
      message: "Part(s) retrieved successfully",
      data: partsWithShopDetails,
    });
  } catch (error) {
    console.error('Get Parts by Part Number Error:', error);
    return res.status(500).json({ message: 'Error fetching parts by part number', success: false, data: error.message });
  }
};

// Get parts by brand, model, categoryTab, and subCategoryTab
exports.getPartsByFilters = async (req, res) => {
  try {
    const { brand, model, categoryTab, subCategoryTab } = req.query;
    // Validate required query parameters
    if (!brand || !model || !categoryTab || !subCategoryTab) {
      return res.status(400).json({
        message: 'brand, model, categoryTab, and subCategoryTab query parameters are required',
        success: false
      });
    }
    // Find products matching brand and model, and having a matching subcategory
    const products = await Product.find({
      brand: brand,
      model: model,
      subCategories: {
        $elemMatch: {
          categoryTab: categoryTab,
          subCategoryTab: subCategoryTab
        }
      }
    }).lean();
    // Collect matching parts
    const matchedParts = [];
    for (const product of products) {
      const { _id: productId, year, region, engineCode, transmission } = product;
      for (const subCat of product.subCategories || []) {
        if (
          subCat.categoryTab === categoryTab &&
          subCat.subCategoryTab === subCategoryTab
        ) {
          for (const part of subCat.parts || []) {
            matchedParts.push({
              productId,
              brand: product.brand,
              model: product.model,
              year,
              region,
              engineCode,
              transmission,
              categoryTab: subCat.categoryTab,
              subCategoryTab: subCat.subCategoryTab,
              partNumber: part.partNumber,
              partName: part.partName,
              quantity: part.quantity,
              price: part.price,
              discountedPrice: part.discountedPrice,
              description: part.description,
              imageUrl: part.imageUrl,
              notes: part.notes,
              madeIn: part.madeIn,
              skuNumber: part.skuNumber,
              stockStatus: part.stockStatus
            });
          }
        }
      }
    }
    // Deduplicate parts by partNumber so we return a single entry per part
    const uniquePartsMap = new Map();
    for (const part of matchedParts) {
      if (!uniquePartsMap.has(part.partNumber)) {
        uniquePartsMap.set(part.partNumber, part);
      }
    }
    const uniqueParts = Array.from(uniquePartsMap.values());
    return res.status(200).json({
      message: 'Filtered parts retrieved successfully',
      success: true,
      data: uniqueParts
    });
  } catch (error) {
    console.error('Get Parts By Filters Error:', error);
    return res.status(500).json({
      message: 'Failed to retrieve parts by filters',
      success: false,
      error: error.message
    });
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
    // Deduplicate by commonProductId
    const uniqueProductsMap = new Map();
    for (const product of products) {
      if (!uniqueProductsMap.has(product.commonProductId)) {
        uniqueProductsMap.set(product.commonProductId, product);
      }
    }
    const uniqueProducts = Array.from(uniqueProductsMap.values());
    // Flatten and map products to only required fields
    const simplified = uniqueProducts.map(product => {
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


const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// instantiate S3 client directly
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});




exports.bulkUploadProducts = async (req, res) => {
  console.log("bulkUploadProducts API hit");
  try {
    console.log("Received file/payload:", req.file || req.body);
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', success: false });
    }
    // Ensure local upload directory exists and move file there
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products_excel_file');
    fs.mkdirSync(uploadDir, { recursive: true });
    const newFilePath = path.join(uploadDir, req.file.originalname);
    fs.renameSync(req.file.path, newFilePath);

    // Upload Excel file to S3 using lib-storage Upload
    // Use bucket name from either AWS_BUCKET_NAME or fallback to AWS_BUCKET
    const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET;
    // upload Excel file stream to S3 using lib-storage Upload
    const fileStream = fs.createReadStream(newFilePath);
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: `products_excel_file/${req.file.originalname}`,
        Body: fileStream
      }
    });
    await upload.done();
    // read Excel directly from disk buffer
    const fileData = fs.readFileSync(newFilePath);
    const workbook = XLSX.read(fileData, { type: 'buffer' });
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const shops = await Shop.find().lean();
    if (!shops.length) {
      return res.status(404).json({ message: 'No shops found', success: false });
    }

    const operations = [];
    for (const row of worksheet) {
      const {
        brand, year, model, frameCode, region,
        engineCode, transmission,
        categoryTab, categoryTabImageUrl = '',
        subCategoryTab, subCategoryTabImageUrl = '',
        partNumber, partName, quantity, price,
        discountedPrice, description, imageUrl = '',
        notes, madeIn, skuNumber, stockStatus
      } = row;

      const commonProductId = `${brand}_${model}_${year}_${frameCode}_${engineCode}_${transmission}_${categoryTab}_${subCategoryTab}`;
      const part = {
        partNumber, partName, quantity, price, discountedPrice,
        description,
        imageUrl: imageUrl ? imageUrl.split(',') : [],
        notes, madeIn, skuNumber,
        stockStatus: stockStatus || 'in_stock'
      };

      for (const shop of shops) {
        // Phase 1: ensure product + subcategory exist
        operations.push({
          updateOne: {
            filter: { shopId: shop._id, commonProductId },
            update: {
              $setOnInsert: {
                brand, year, model, frameCode, region,
                engineCode, transmission,
                shopId: shop._id,
                commonProductId,
                ratings: { average: 0, totalReviews: 0 },
                subCategories: [{
                  categoryTab,
                  categoryTabImageUrl: categoryTabImageUrl ? categoryTabImageUrl.split(',') : [],
                  subCategoryTab,
                  subCategoryTabImageUrl: subCategoryTabImageUrl ? subCategoryTabImageUrl.split(',') : [],
                  parts: [part]
                }]
              }
            },
            upsert: true
          }
        });
        // Phase 2: update existing part if found
        operations.push({
          updateOne: {
            filter: {
              shopId: shop._id,
              commonProductId,
              'subCategories.categoryTab': categoryTab,
              'subCategories.subCategoryTab': subCategoryTab,
              'subCategories.parts.partNumber': partNumber
            },
            update: {
              $set: {
                'subCategories.$[sc].parts.$[p].quantity': quantity,
                'subCategories.$[sc].parts.$[p].price': price,
                'subCategories.$[sc].parts.$[p].discountedPrice': discountedPrice,
                'subCategories.$[sc].parts.$[p].description': description,
                'subCategories.$[sc].parts.$[p].imageUrl': part.imageUrl,
                'subCategories.$[sc].parts.$[p].notes': notes,
                'subCategories.$[sc].parts.$[p].madeIn': madeIn,
                'subCategories.$[sc].parts.$[p].skuNumber': skuNumber,
                'subCategories.$[sc].parts.$[p].stockStatus': stockStatus || 'in_stock'
              }
            },
            arrayFilters: [
              { 'sc.categoryTab': categoryTab, 'sc.subCategoryTab': subCategoryTab },
              { 'p.partNumber': partNumber }
            ],
            upsert: false
          }
        });
        // Phase 3: push new part if missing
        operations.push({
          updateOne: {
            filter: {
              shopId: shop._id,
              commonProductId,
              'subCategories.categoryTab': categoryTab,
              'subCategories.subCategoryTab': subCategoryTab,
              'subCategories.parts.partNumber': { $ne: partNumber }
            },
            update: {
              $push: { 'subCategories.$[sc].parts': part }
            },
            arrayFilters: [
              { 'sc.categoryTab': categoryTab, 'sc.subCategoryTab': subCategoryTab }
            ],
            upsert: false
          }
        });
      }
    }

    const result = await Product.bulkWrite(operations, { ordered: false });
    // Optionally delete the local file after processing
    fs.unlinkSync(newFilePath);
    return res.status(200).json({
      message: 'Bulk upload processed (upsert completed)',
      success: true,
      result: {
        inserted: result.upsertedCount,
        modified: result.modifiedCount
      }
    });
  } catch (err) {
    console.error("Error in bulkUploadProducts:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload products",
      error: err.message
    });
  }
};

// Bulk upload products for a specific shop (bulkWrite upsert logic)
exports.bulkUploadProductsForShop = async (req, res) => {
  try {
    // 1. Validate req.file and shopId
    const { shopId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', success: false });
    }
    if (!shopId) {
      return res.status(400).json({ message: 'Missing shopId', success: false });
    }

    // 2. Create local upload directory and move file
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products_excel_file');
    fs.mkdirSync(uploadDir, { recursive: true });
    const newFilePath = path.join(uploadDir, req.file.originalname);
    fs.renameSync(req.file.path, newFilePath);

    // 3. Upload Excel file to S3 using @aws-sdk/lib-storage's Upload
    const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET;
    const fileStream = fs.createReadStream(newFilePath);
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: `products_excel_file/${req.file.originalname}`,
        Body: fileStream
      }
    });
    await upload.done();

    // 4. Read file from disk, parse with XLSX, convert to JSON
    const fileData = fs.readFileSync(newFilePath);
    const workbook = XLSX.read(fileData, { type: 'buffer' });
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // 5. Build operations array as in bulkUploadProducts, but only for the single shop
    const shop = await Shop.findById(shopId).lean();
    if (!shop) {
      fs.unlinkSync(newFilePath);
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    const operations = [];
    for (const row of worksheet) {
      const {
        brand, year, model, frameCode, region,
        engineCode, transmission,
        categoryTab, categoryTabImageUrl = '',
        subCategoryTab, subCategoryTabImageUrl = '',
        partNumber, partName, quantity, price,
        discountedPrice, description, imageUrl = '',
        notes, madeIn, skuNumber, stockStatus
      } = row;

      const commonProductId = `${brand}_${model}_${year}_${frameCode}_${engineCode}_${transmission}_${categoryTab}_${subCategoryTab}`;
      const part = {
        partNumber, partName, quantity, price, discountedPrice,
        description,
        imageUrl: imageUrl ? imageUrl.split(',') : [],
        notes, madeIn, skuNumber,
        stockStatus: stockStatus || 'in_stock'
      };

      // Phase 1: ensure product + subcategory exists
      operations.push({
        updateOne: {
          filter: { shopId: shop._id, commonProductId },
          update: {
            $setOnInsert: {
              brand, year, model, frameCode, region,
              engineCode, transmission,
              shopId: shop._id,
              commonProductId,
              ratings: { average: 0, totalReviews: 0 },
              subCategories: [{
                categoryTab,
                categoryTabImageUrl: categoryTabImageUrl ? categoryTabImageUrl.split(',') : [],
                subCategoryTab,
                subCategoryTabImageUrl: subCategoryTabImageUrl ? subCategoryTabImageUrl.split(',') : [],
                parts: [part]
              }]
            }
          },
          upsert: true
        }
      });
      // Phase 2: update existing part if found
      operations.push({
        updateOne: {
          filter: {
            shopId: shop._id,
            commonProductId,
            'subCategories.categoryTab': categoryTab,
            'subCategories.subCategoryTab': subCategoryTab,
            'subCategories.parts.partNumber': partNumber
          },
          update: {
            $set: {
              'subCategories.$[sc].parts.$[p].quantity': quantity,
              'subCategories.$[sc].parts.$[p].price': price,
              'subCategories.$[sc].parts.$[p].discountedPrice': discountedPrice,
              'subCategories.$[sc].parts.$[p].description': description,
              'subCategories.$[sc].parts.$[p].imageUrl': part.imageUrl,
              'subCategories.$[sc].parts.$[p].notes': notes,
              'subCategories.$[sc].parts.$[p].madeIn': madeIn,
              'subCategories.$[sc].parts.$[p].skuNumber': skuNumber,
              'subCategories.$[sc].parts.$[p].stockStatus': stockStatus || 'in_stock'
            }
          },
          arrayFilters: [
            { 'sc.categoryTab': categoryTab, 'sc.subCategoryTab': subCategoryTab },
            { 'p.partNumber': partNumber }
          ],
          upsert: false
        }
      });
      // Phase 3: push new part if missing
      operations.push({
        updateOne: {
          filter: {
            shopId: shop._id,
            commonProductId,
            'subCategories.categoryTab': categoryTab,
            'subCategories.subCategoryTab': subCategoryTab,
            'subCategories.parts.partNumber': { $ne: partNumber }
          },
          update: {
            $push: { 'subCategories.$[sc].parts': part }
          },
          arrayFilters: [
            { 'sc.categoryTab': categoryTab, 'sc.subCategoryTab': subCategoryTab }
          ],
          upsert: false
        }
      });
    }

    // 6. Execute bulkWrite, delete local file, return response
    const result = await Product.bulkWrite(operations, { ordered: false });
    fs.unlinkSync(newFilePath);
    return res.status(200).json({
      message: 'Bulk upload processed for shop (upsert completed)',
      success: true,
      result: {
        inserted: result.upsertedCount,
        modified: result.modifiedCount
      }
    });
  } catch (err) {
    console.error('Bulk Upload for Shop Error:', err);
    // Remove file if it exists
    if (req.file && req.file.originalname) {
      const filePath = path.join(__dirname, '..', 'uploads', 'products_excel_file', req.file.originalname);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }
    return res.status(500).json({
      message: 'Failed to upload bulk products for shop',
      success: false,
      error: err.message
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

    // ensure a commonProductId is set (generate new if not provided)
    const commonProductId = productData.commonProductId || uuidv4();

    if (!shopId || !productData) {
      return res.status(400).json({ message: 'Missing shopId or productData', success: false });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    const newProduct = new Product({ ...productData, shopId, commonProductId });
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

// Get list of shops selling products matching brand, model, categoryTab, subCategoryTab, and partNumber
exports.getShopsSellingSimilarProduct = async (req, res) => {
  try {
    const { brand, model, categoryTab, subCategoryTab, partNumber } = req.query;
    if (!brand || !model || !categoryTab || !subCategoryTab) {
      return res.status(400).json({
        message: 'brand, model, categoryTab, and subCategoryTab query parameters are required',
        success: false
      });
    }
    if (!partNumber) {
      return res.status(400).json({
        message: 'partNumber query parameter is required',
        success: false
      });
    }
    // Find matching products across all shops
    const products = await Product.find({
      brand: brand,
      model: model,
      subCategories: {
        $elemMatch: {
          categoryTab: categoryTab,
          subCategoryTab: subCategoryTab,
          parts: { $elemMatch: { partNumber: partNumber } }
        }
      }
    }).lean();

    // Group products by shopId
    const productsByShop = {};
    for (const product of products) {
      const shopIdStr = product.shopId?.toString();
      if (!shopIdStr) continue;
      if (!productsByShop[shopIdStr]) {
        productsByShop[shopIdStr] = [];
      }
      // Extract matching parts from this product
      for (const subCat of product.subCategories || []) {
        if (
          subCat.categoryTab === categoryTab &&
          subCat.subCategoryTab === subCategoryTab
        ) {
          for (const part of subCat.parts || []) {
            if (part.partNumber === partNumber) {
              productsByShop[shopIdStr].push({
                productId: product._id,
                year: product.year,
                region: product.region,
                engineCode: product.engineCode,
                transmission: product.transmission,
                partNumber: part.partNumber,
                partName: part.partName,
                quantity: part.quantity,
                price: part.price,
                discountedPrice: part.discountedPrice,
                description: part.description,
                imageUrl: part.imageUrl,
                notes: part.notes,
                madeIn: part.madeIn,
                skuNumber: part.skuNumber,
                stockStatus: part.stockStatus
              });
            }
          }
        }
      }
    }

    // If no matching products, return empty data
    const shopIds = Object.keys(productsByShop);
    if (shopIds.length === 0) {
      return res.status(200).json({
        message: 'No shops found selling matching products',
        success: true,
        data: []
      });
    }

    // Fetch shop details for those shopIds
    const shops = await Shop.find({ _id: { $in: shopIds } }).lean();

    // Build response array
    const responseData = shops.map(shop => {
      const shopDetails = shop.shopeDetails || {};
      return {
        _id: shop._id,
        shopName: shopDetails.shopName,
        shopAddress: shopDetails.shopAddress,
        shopLicenseNumber: shopDetails.shopLicenseNumber,
        EmiratesId: shopDetails.EmiratesId,
        createdAt: shop.createdAt,
        parts: productsByShop[shop._id.toString()] || []
      };
    });

    return res.status(200).json({
      message: 'Shops selling similar products retrieved successfully',
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get Shops Selling Similar Product Error:', error);
    return res.status(500).json({
      message: 'Failed to retrieve shops selling similar products',
      success: false,
      error: error.message
    });
  }
};

// Get product details along with its shop details

exports.getProductWithShopDetails = async (req, res) => {
  try {
    const { productId, shopId } = req.params;
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ success: false, message: 'Invalid productId or shopId' });
    }
    // Fetch the product for the given shop
    const product = await Product.findOne({ _id: productId, shopId }).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found for this shop' });
    }
    // Fetch shop details
    const shop = await Shop.findById(shopId).lean();
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    // Respond with both product and shop data
    return res.status(200).json({
      success: true,
      message: 'Product and shop details retrieved successfully',
      data: { product, shop }
    });
  } catch (error) {
    console.error('Get Product With Shop Details Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product and shop details',
      error: error.message
    });
  }
};
const { Product, ProductDetails } = require('../models/Product');

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


// Create or add a product to shop's cartProduct array
exports.addProduct = async (req,res) => {
 

  try {
    const  shopId  = req.params.id;
    const productData = ProductDetails(req.body);
 
    let productEntry = await Product.findOne({ shopId });

    if (productEntry) {
      // Add new product to existing shop
      productEntry.products.push(productData);
      await productEntry.save();
      return res.status(200).json({ message: "Product added to shop's inventory", data: productEntry,success:true });
    } else {
      // Create new shop with first product
      const newProduct = new Product({
        shopId,
        products: [productData],
      });
      await newProduct.save();
      return res.status(201).json({ message: 'New shop inventory created', data: newProduct,success:true });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add product', data: error.message, success:false});
  }
};

// Get all products for a shop
exports.getProductsByShop = async (req, res) => {
  try {
    const  shopId  = req.params.shopId;
    console.log(shopId);
    const productEntry = await Product.findOne({ shopId });


    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [],success:false });
    }

    return res.status(200).json({ message: 'Products retrieved', data: productEntry, success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', data: error.message,success:false });
  }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const shopId  = req.params.shopId;

    const  productId  = req.params.productId;

    const productEntry = await Product.findOne({ shopId });
    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [],success:false });
    }
    const product = productEntry.products.find(p => p._id.toString() === productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found',data: [],success:false  });
    }

    return res.status(200).json({ message: 'Product retrieved', data: product ,success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to retrieve product', error: error.message ,success:false });
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


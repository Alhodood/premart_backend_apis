const { Product, ProductDetails } = require('../models/Product');

// Create or add a product to shop's cartProduct array
exports.addProduct = async (req, res) => {
  try {
    const { shopId } = req.params.shopId;
    const productData = req.body;

    let productEntry = await Product.findOne({ shopId });

    if (productEntry) {
      // Add new product to existing shop
      productEntry.cartProduct.push(productData);
      await productEntry.save();
      return res.status(200).json({ message: "Product added to shop's inventory", data: productEntry,success:true });
    } else {
      // Create new shop with first product
      const newProduct = new Product({
        shopId,
        cartProduct: [productData],
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
    const { shopId } = req.req.params.shopId;
    
    const productEntry = await Product.findOne({ shopId });

    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found', data: [],success:false });
    }

    return res.status(200).json({ message: 'Products retrieved', data: productEntry.cartProduct, success:true });
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

    const product = productEntry.cartProduct.id(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found',data: [],success:false  });
    }

    return res.status(200).json({ message: 'Product retrieved', data: product ,success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to retrieve product', error: error.message ,success:false });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {   const shopId  = req.params.shopId;

    const  productId  = req.params.productId;
    const updates = req.body;

    const productEntry = await Product.findOne({ shopId });
    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found',data: [],success:false  });
    }

    const product = productEntry.cartProduct.id(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found',data:[],success:false  });
    }

    Object.assign(product, updates);
    await productEntry.save();

    return res.status(200).json({ message: 'Product updated', data: product,success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product', error: error.message,data: [],success:false  });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {   const shopId  = req.params.shopId;

    const  productId  = req.params.productId;

    const productEntry = await Product.findOne({ shopId });
    if (!productEntry) {
      return res.status(404).json({ message: 'Shop not found',data: [],success:false  });
    }

    const product = productEntry.cartProduct.id(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found',data: [],success:false  });
    }

    product.remove();
    await productEntry.save();

    return res.status(200).json({ message: 'Product deleted', data: productEntry,success:true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete product', error: error.message,success:false  });
  }
};

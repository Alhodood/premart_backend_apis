const Product = require('../models/Product');

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    // For security, you can use middleware to ensure only Shop Admin can call this endpoint.
    const product = new Product(req.body);
    console.log(product);
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// Retrieve all products with filtering and pagination
exports.getProducts = async (req, res) => {
  try {
    // Optional filtering and pagination. By default, page 1 and limit 10.
    const { page = 1, limit = 10, category, brand } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (brand) filter.brand = brand;

    // Using lean() for improved read performance.
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// Retrieve a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

// Update a product by ID
exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

// Delete a product by ID
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};




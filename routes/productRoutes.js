const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

const upload = require('../middleware/s3Upload');
// Import all controllers
const fuelController = require('../controllers/fuelController');
const modelController = require('../controllers/modelController');
const yearController = require('../controllers/yearController');
const brandController = require('../controllers/brandController');
const categoryController = require('../controllers/categoryController');

// Create a new product (restricted to Shop Admin)
router.post('product', productController.createProduct);

// Retrieve all products (public)
router.get('product', productController.getProducts);

// Retrieve a specific product by ID (public)
router.get('product/:id', productController.getProductById);

// Update product (restricted to Shop Admin)
router.put('product/:id', productController.updateProduct);

// Delete product (restricted to Shop Admin)
router.delete('product/:id', productController.deleteProduct);


// brand Routes
router.post('/brand', brandController.createBrand);

router.post('/brand', upload.single('brandImage'), brandController.createBrand);
router.get('/brand', brandController.getAllBrands);
router.get('/brand/:id', brandController.getBrandById);
router.put('/brand/:id', brandController.updateBrand);
router.delete('/brand/:id', brandController.deleteBrand);


// CATEGORY ROUTES
router.post('/category', categoryController.createCategory);
router.get('/category', categoryController.getAllCategories);
router.get('/category/:id', categoryController.getCategoryById);
router.put('/category/:id', categoryController.updateCategory);
router.delete('/category/:id', categoryController.deleteCategory);


// FUEL ROUTES
router.post('/fuel', fuelController.createFuel);
router.get('/fuel', fuelController.getAllFuels);
router.get('/fuel/:id', fuelController.getFuelById);
router.put('/fuel/:id', fuelController.updateFuel);
router.delete('/fuel/:id', fuelController.deleteFuel);


// MODEL ROUTES
router.post('/model', modelController.createModel);
router.get('/model', modelController.getAllModels);
router.get('/model/:id', modelController.getModelById);
router.put('/model/:id', modelController.updateModel);
router.delete('/model/:id', modelController.deleteModel);


// YEAR ROUTES
router.post('/year', yearController.createYear);
router.get('/year', yearController.getAllYears);
router.get('/year/:id', yearController.getYearById);
router.put('/year/:id', yearController.updateYear);
router.delete('/year/:id', yearController.deleteYear);


module.exports = router;
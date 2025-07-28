const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Import all controllers
const fuelController = require('../controllers/fuelController');
const modelController = require('../controllers/modelController');
const yearController = require('../controllers/yearController');
const brandController = require('../controllers/brandController');
const categoryController = require('../controllers/categoryController');
const uploadMiddleWare = require('../middleware/s3Upload');

const subCategoriesController = require('../controllers/subCategoryController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });



/// ==== this is for upload image in s3 bucket
router.post('/upload',uploadMiddleWare.single('file'),productController.fileUpload);

// PRODUCT RATINGS ROUTES
// Public route for setting product rating (does NOT require shopId)
router.put('/product/rating/:productId', productController.setProductRating);
router.get('/product/ratings', productController.getAllProductRatings);

router.post('/upload-bulk', upload.single('file'), productController.bulkUploadProducts);
router.post('/products/bulk-upload/:shopId', upload.single('file'), productController.bulkUploadProductsForShop);

router.get('/product/element',productController.getProductElement);
router.post('/product', productController.addProduct);
router.post('/product/create/:shopId', productController.createProductForShop);
router.get('/getAllProducts', productController.getAllProducts);
router.get('/product/:shopId', productController.getProductsByShop);
router.get('/getProductById/:productId', productController.getProductById);
// Get product details with shop details
router.get(
  '/getProductWithShop/:productId/:shopId',
  productController.getProductWithShopDetails
);
router.put('/product/update/:commonProductId/:shopId', productController.updateProduct);
router.get('/getAllProductsAdmin', productController.getAllProductsAdmin);
router.put('/update-product-all-shops/:commonProductId', productController.updateProductForAllShops);


router.delete('/product/delete-by-common/:commonProductId', productController.deleteProductByCommonProductId);
router.get('/products-by-part-number/:partNumber', productController.getProductsByPartNumber);
router.get('/parts-by-part-number/:partNumber', productController.getPartsByPartNumber);
router.get('/products/parts', productController.getPartsByFilters);
router.get('/similar-products', productController.getSimilarProducts);//similar-products?brand=Nissan&model=Patrol&categoryTab=Fuel Injection
router.get('/products/shops/similar', productController.getShopsSellingSimilarProduct);

router.post('/update-part-prices', productController.updatePartPrices);

// Brand Routes
router.post('/brand', brandController.createBrand);
router.get('/brand', brandController.getAllBrands);
router.get('/brand/:id', brandController.getBrandById);
router.put('/brand/:id', brandController.updateBrand);
router.delete('/brand/delete/:id', brandController.deleteBrand);
router.get('/brand-products/:brandName', brandController.getProductsByBrand);
router.get('/brand/models/:brandId', brandController.getModelsByBrand);

// CATEGORY ROUTES
router.post('/category', categoryController.createCategory);
router.get('/category', categoryController.getAllCategories);
router.get('/category/:id', categoryController.getCategoryById);
router.put('/category/:id', categoryController.updateCategory);
router.delete('/category/delete/:id', categoryController.deleteCategory);
router.get('/products-by-category/:categoryTab', categoryController.getProductsByCategory);
router.get('/parts-by-category/:categoryTab', categoryController.getPartsByCategory);


// SUBCATEGORY ROUTES  
router.post('/subCategory', subCategoriesController.addSubCategory);
router.get('/subCategory', subCategoriesController.getAllSubCategories);
router.get(
  '/subCategory/category/:categoryId',
  subCategoriesController.getSubCategoriesByCategory
);
router.put('/subCategory/:id', subCategoriesController.updateSubCategory);
router.delete('/subCategory/:id', subCategoriesController.deleteSubCategory);



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
router.delete('/model/delete/:id', modelController.deleteModel);
router.get('/products-by-model/:modelName', modelController.getProductsByModel);



// YEAR ROUTES
router.post('/year', yearController.createYear);
router.get('/year', yearController.getAllYears);
router.get('/year/:id', yearController.getYearById);
router.put('/year/:id', yearController.updateYear);
router.delete('/year/delete/:id', yearController.deleteYear);
router.get('/products-by-year/:year', yearController.getProductsByYear);






module.exports = router;
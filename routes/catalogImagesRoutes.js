const express = require('express');
const router = express.Router();
const catalogImageController = require('../controllers/catalogImagesController');

// Upload catalog image
router.post('/upload', catalogImageController.uploadCatalogImage);

// Get catalog images by filters (brand, model, category, subCategory)
router.get('/', catalogImageController.getCatalogImages);
router.get('/filter', catalogImageController.getCatalogImagesByNames);

// View catalog image by ID
router.get('/:id', catalogImageController.viewCatalogImage);


// Delete catalog image by ID
router.delete('/:id', catalogImageController.deleteCatalogImage);

// Update catalog image by ID
router.put('/:id', catalogImageController.updateCatalogImage);

module.exports = router;

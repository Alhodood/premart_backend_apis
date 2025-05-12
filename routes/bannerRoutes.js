const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// All banners (admin/global access)
router.get('/', bannerController.getAllBanners);

// Shop-specific banner routes
router.post('/:shopId', bannerController.addBanner);
router.get('/shop/:shopId', bannerController.getAllBanners);  // Uses same method for shop context
router.get('/:shopId', bannerController.getBannerByShopId);
router.put('/:shopId/:id', bannerController.updateBanner);
router.delete('/:shopId/:id', bannerController.deleteBanner);

module.exports = router;

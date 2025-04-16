const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

router.post('/', bannerController.addBanner);
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;

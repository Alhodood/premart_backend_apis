
const express = require('express');
const router = express.Router();
const {
  createCoupon, getAllCoupons, deleteCoupon,
  createOffer, getAllOffers, deleteOffer
} = require('../controllers/offerCouponController');

router.post('/coupon', createCoupon);
router.get('/coupon', getAllCoupons);
router.delete('/coupon/:id', deleteCoupon);

router.post('/offer', createOffer);
router.get('/offer', getAllOffers);
router.delete('/offer/:id', deleteOffer);

module.exports = router;
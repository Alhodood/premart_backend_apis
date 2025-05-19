
const express = require('express');
const router = express.Router();
const {
  createCoupon, getAllCoupons, deleteCoupon,
  createOffer, getAllOffers, deleteOffer,updateCoupon,updateOffer
} = require('../controllers/offerCouponController');

router.post('/coupon/:creatorId', createCoupon);
router.get('/coupon/:creatorId', getAllCoupons);
router.delete('/coupon/:creatorId/:id', deleteCoupon);
router.put('/coupon/:id', updateCoupon);

router.post('/offer/:creatorId', createOffer);
router.get('/offer/:creatorId', getAllOffers);
router.delete('/offer/:creatorId/:id', deleteOffer);
router.put('/offer/:id', updateOffer);

module.exports = router;
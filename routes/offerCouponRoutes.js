
const express = require('express');
const router = express.Router();
const {
  createCoupon, getAllCoupons, deleteCoupon,
  createOffer, getAllOffers, deleteOffer,updateCoupon,updateOffer,applyCoupon,checkOfferValidity
} = require('../controllers/offerCouponController');
router.post('/coupon/check', applyCoupon);
router.post('/coupon/:creatorId', createCoupon);
router.get('/coupon/:creatorId', getAllCoupons);
router.delete('/coupon/:creatorId/:id', deleteCoupon);
router.put('/coupon/:id', updateCoupon);
// router.post('/coupon/check', applyCoupon);

//------------------------------
router.post('/offer/check', checkOfferValidity);
router.post('/offer/:creatorId', createOffer);
router.get('/offer/:creatorId', getAllOffers);
router.delete('/offer/:creatorId/:id', deleteOffer);
router.put('/offer/:id', updateOffer);

module.exports = router;
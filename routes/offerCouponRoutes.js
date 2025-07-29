const express = require('express');
const router = express.Router();
const {
  createCoupon, getAllCoupons, deleteCoupon,
  createOffer, getAllOffers, deleteOffer,updateCoupon,updateOffer,applyCoupon,checkOfferValidity
} = require('../controllers/offerCouponController');
router.post('/coupon/check', applyCoupon);
router.post('/coupon/create', createCoupon);
router.get('/coupon', getAllCoupons);
router.delete('/coupon/delete/:id', deleteCoupon);
router.put('/coupon/update/:id', updateCoupon);


//------------------------------

router.post('/offer/check', checkOfferValidity);
router.post('/offer/:creatorId', createOffer);
router.get('/offer/:creatorId', getAllOffers);
router.delete('/offer/:creatorId/:id', deleteOffer);
router.put('/offer/:id', updateOffer);

module.exports = router;
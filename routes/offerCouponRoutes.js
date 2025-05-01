const express = require('express');
const router = express.Router();
const {
  createCoupon, getAllCoupons, deleteCoupon,
  createOffer, getAllOffers, deleteOffer
} = require('../controllers/offerCouponController');

const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

// 🧾 Coupons
router.post('/coupon', protect, allowRoles('superAdmin', 'shopAdmin'), createCoupon);
router.get('/coupon', protect, allowRoles('superAdmin', 'shopAdmin'), getAllCoupons);
router.delete('/coupon/:id', protect, allowRoles('superAdmin', 'shopAdmin'), deleteCoupon);

// 🎁 Offers
router.post('/offer', protect, allowRoles('superAdmin', 'shopAdmin'), createOffer);
router.get('/offer', protect, allowRoles('superAdmin', 'shopAdmin'), getAllOffers);
router.delete('/offer/:id', protect, allowRoles('superAdmin', 'shopAdmin'), deleteOffer);

module.exports = router;
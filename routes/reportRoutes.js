const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { 
  getWeeklySales,
  getOrderStatusDistribution 
} = require('../controllers/dashboardController');

//router.get('/agency/download', generateReport.generateAgencyReportCsv);

router.get('/orders/cancelled', reportController.getCancelledOrders);
router.get('/orders/returned', reportController.getReturnedOrders);

router.get('/sales/daily', reportController.getDailySales);
// Weekly sales graph
router.get('/sales/weekly', getWeeklySales);

// Order status pie chart
router.get('/order-status-distribution', getOrderStatusDistribution);
router.get('/sales/monthly', reportController.getMonthlySales);
router.get('/shop-sales', reportController.getShopWiseSales);

router.get('/products/top-selling', reportController.getTopSellingProducts);
router.get('/products/low-selling', reportController.getLowSellingProducts);
router.get('/stock/low', reportController.getLowStockParts);
router.get('/stock/out-of-stock', reportController.getOutOfStockParts);

router.get('/buyers/top', reportController.getTopBuyers);

router.get('/coupons/most-used', reportController.getMostUsedCoupons);

// Shop-specific reporting routes
router.get('/shop-sales/by-id', reportController.getShopSalesById);
router.get('/orders/cancelled/by-shop', reportController.getShopCancelledOrders);
router.get('/orders/returned/by-shop', reportController.getShopReturnedOrders);

router.get('/sales/daily/by-shop', reportController.getShopDailySales);
router.get('/sales/weekly/by-shop', reportController.getShopWeeklySales);
router.get('/sales/monthly/by-shop', reportController.getShopMonthlySales);

router.get('/products/top-selling/by-shop', reportController.getShopTopSellingProducts);
router.get('/products/low-selling/by-shop', reportController.getShopLowSellingProducts);
router.get('/stock/low/by-shop', reportController.getShopLowStockParts);
router.get('/stock/out-of-stock/by-shop', reportController.getShopOutOfStockParts);
router.get('/orders/pending/by-shop', reportController.getShopPendingOrders);

router.get(
  '/orders/pending/by-shop',
 
  reportController.getShopPendingOrders
);

// Shop Cancelled Orders
router.get(
  '/orders/cancelled/by-shop',
 
  reportController.getShopCancelledOrders
);

// Shop Returned Orders
router.get(
  '/orders/returned/by-shop',
 
  reportController.getShopReturnedOrders
);

// ========================================
// SHOP SALES REPORTS
// ========================================

// Shop Daily Sales
router.get(
  '/sales/daily/by-shop',
  
  reportController.getShopDailySales
);

// Shop Weekly Sales
router.get(
  '/sales/weekly/by-shop',
 
  reportController.getShopWeeklySales
);

// Shop Monthly Sales
router.get(
  '/sales/monthly/by-shop',
 
  reportController.getShopMonthlySales
);

// Shop Sales Overview (by shop ID)
router.get(
  '/shop-sales/by-id',

  reportController.getShopSalesById
);

// ========================================
// SHOP PRODUCT PERFORMANCE REPORTS
// ========================================

// Shop Top Selling Products
router.get(
  '/products/top-selling/by-shop',
 
  reportController.getShopTopSellingProducts
);

// Shop Low Selling Products
router.get(
  '/products/low-selling/by-shop',
 
  reportController.getShopLowSellingProducts
);

// ========================================
// SHOP INVENTORY REPORTS
// ========================================

// Shop Low Stock Products
router.get(
  '/stock/low/by-shop',

  reportController.getShopLowStockProducts
);

// Shop Out of Stock Products
router.get(
  '/stock/out-of-stock/by-shop',

  reportController.getShopOutOfStockProducts
);

module.exports = router;




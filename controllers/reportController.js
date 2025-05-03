const AgencyPayout = require('../models/AgencyPayout');
const { Parser } = require('json2csv');
const moment = require('moment');
const Banner = require('../models/Banners');
const Brand = require('../models/Brand');
const Category = require('../models/Categories');
const Coupon = require('../models/Coupon');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const DeliveryBoy = require('../models/DeliveryBoy');
const Fuel = require('../models/Fuel');
const Model = require('../models/Model');
const Offer = require('../models/Offers');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { Product } = require('../models/Product');
const { Shop } = require('../models/Shop');
const Stock = require('../models/Stock');
const SuperNotification = require('../models/superNotification');
const User = require('../models/User');
const Year = require('../models/Year');


exports.generateAgencyReportCsv = async (req, res) => {
  try {
    const { from, to, status } = req.query;

    const filter = {};
    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }
    if (status) filter.status = status;

    const payouts = await AgencyPayout.find(filter)
      .populate('agencyId', 'name email phone') // optional: get agency info
      .sort({ createdAt: -1 });

    if (!payouts.length) {
      return res.status(200).json({ message: 'No payouts found', success: true });
    }

    const data = payouts.map(p => ({
      agencyName: p.agencyId?.name || 'Unknown',
      email: p.agencyId?.email || '-',
      phone: p.agencyId?.phone || '-',
      totalDeliveries: p.totalDeliveries,
      totalAmount: p.totalAmount,
      commission: p.commission,
      netPayable: p.netPayable,
      status: p.status,
      from: p.from,
      to: p.to,
      createdAt: moment(p.createdAt).format('DD-MM-YYYY')
    }));

    const fields = [
      'agencyName',
      'email',
      'phone',
      'totalDeliveries',
      'totalAmount',
      'commission',
      'netPayable',
      'status',
      'from',
      'to',
      'createdAt'
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`agency-payouts-${Date.now()}.csv`);
    return res.send(csv);

  } catch (err) {
    console.error('Agency Report CSV Error:', err);
    return res.status(500).json({
      message: 'Failed to generate agency report',
      success: false,
      error: err.message
    });
  }
};


exports.generateBannerReportCsv = async (req, res) => {
    try {
      const { visibility } = req.query;
  
      const filter = {};
      if (visibility !== undefined) {
        filter.visibility = visibility === 'true';
      }
  
      const banners = await Banner.find(filter).sort({ createdAt: -1 });
  
      if (!banners.length) {
        return res.status(200).json({ message: 'No banners found', success: true });
      }
  
      const data = banners.map(b => ({
        title: b.title,
        image: b.pic,
        visibility: b.visibility ? 'Visible' : 'Hidden',
        createdAt: moment(b.createdAt).format('DD-MM-YYYY')
      }));
  
      const fields = ['title', 'image', 'visibility', 'createdAt'];
      const parser = new Parser({ fields });
      const csv = parser.parse(data);
  
      res.header('Content-Type', 'text/csv');
      res.attachment(`banner-report-${Date.now()}.csv`);
      return res.send(csv);
  
    } catch (err) {
      console.error('Banner Report CSV Error:', err);
      return res.status(500).json({
        message: 'Failed to generate banner report',
        success: false,
        error: err.message
      });
    }
  };

  exports.getBrandReport = async (req, res) => {
    try {
      const brands = await Brand.find().sort({ createdAt: -1 });
  
      // 📝 If CSV download is requested
      if (req.query.download === 'csv') {
        const fields = ['_id', 'brandName', 'brandImage', 'visibility', 'createdAt'];
        const opts = { fields, defaultValue: '' };
        const parser = new Parser(opts);
        const csv = parser.parse(brands);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('brand_report.csv');
        return res.send(csv);
      }
  
      // 📦 JSON response
      return res.status(200).json({
        message: 'Brand Report fetched successfully',
        success: true,
        data: brands
      });
  
    } catch (error) {
      console.error('Brand Report Error:', error);
      return res.status(500).json({
        message: 'Failed to fetch brand report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getCategoryReport = async (req, res) => {
    try {
      const categories = await Category.find().sort({ createdAt: -1 });
  
      if (req.query.download === 'csv') {
        const fields = ['_id', 'categoryName', 'categoryImage', 'visibility', 'createdAt'];
        const parser = new Parser({ fields, defaultValue: '' });
        const csv = parser.parse(categories);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('category_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Category Report fetched successfully',
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Category Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch category report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getCouponReport = async (req, res) => {
    try {
      const coupons = await Coupon.find().populate('shopId', 'shopName').sort({ createdAt: -1 });
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Coupon Code', value: 'code' },
          { label: 'Discount Type', value: 'discountType' },
          { label: 'Discount Value', value: 'discountValue' },
          { label: 'Minimum Order Amount', value: 'minOrderAmount' },
          { label: 'Usage Limit', value: 'usageLimit' },
          { label: 'Used Count', value: 'usedCount' },
          { label: 'Expiry Date', value: row => row.expiryDate?.toISOString()?.split('T')[0] },
          { label: 'Is Active', value: 'isActive' },
          { label: 'Shop Name', value: row => row.shopId?.shopName || 'All Shops' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '' });
        const csv = parser.parse(coupons);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('coupon_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Coupon Report fetched successfully',
        success: true,
        data: coupons
      });
    } catch (error) {
      console.error('Coupon Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch coupon report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getDeliveryAgencyReport = async (req, res) => {
    try {
      const agencies = await DeliveryAgency.find();
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Agency Name', value: 'agencyDetails.agencyName' },
          { label: 'Address', value: 'agencyDetails.agencyAddress' },
          { label: 'Email', value: 'agencyDetails.agencyMail' },
          { label: 'Contact', value: 'agencyDetails.agencyContact' },
          { label: 'License Number', value: 'agencyDetails.agencyLicenseNumber' },
          { label: 'License Expiry', value: 'agencyDetails.agencyLicenseExpiry' },
          { label: 'Emirates ID', value: 'agencyDetails.emiratesId' },
          { label: 'Location', value: 'agencyDetails.agencyLocation' },
          { label: 'Payout Type', value: 'agencyDetails.payoutType' },
          { label: 'Support Email', value: 'agencyDetails.supportMail' },
          { label: 'Support Contact', value: 'agencyDetails.supportNumber' },
          { label: 'Bank Name', value: 'agencyDetails.agencyBankDetails.bankName' },
          { label: 'Account Number', value: 'agencyDetails.agencyBankDetails.accountNumber' },
          { label: 'IBAN', value: 'agencyDetails.agencyBankDetails.ibanNumber' },
          { label: 'Branch', value: 'agencyDetails.agencyBankDetails.branch' },
          { label: 'SWIFT Code', value: 'agencyDetails.agencyBankDetails.swiftCode' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '-' });
        const csv = parser.parse(agencies);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('delivery_agency_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Delivery agency report fetched successfully',
        success: true,
        data: agencies
      });
    } catch (error) {
      console.error('Delivery Agency Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch delivery agency report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getDeliveryBoyReport = async (req, res) => {
    try {
      const deliveryBoys = await DeliveryBoy.find().populate('agencyId');
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Name', value: 'name' },
          { label: 'Email', value: 'email' },
          { label: 'Phone', value: 'phone' },
          { label: 'Country Code', value: 'countryCode' },
          { label: 'Date of Birth', value: 'dob' },
          { label: 'Emirates ID', value: 'emiratesId' },
          { label: 'Operating Hours', value: 'operatingHours' },
          { label: 'Agency Address', value: 'agencyAddress' },
          { label: 'City', value: 'city' },
          { label: 'Latitude', value: 'latitude' },
          { label: 'Longitude', value: 'longitude' },
          { label: 'Availability', value: row => row.availability ? 'Yes' : 'No' },
          { label: 'Is Online', value: row => row.isOnline ? 'Online' : 'Offline' },
          { label: 'Verified Account', value: row => row.accountVerify ? 'Yes' : 'No' },
          { label: 'Agency Name', value: row => row.agencyId?.agencyDetails?.agencyName || '-' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '-' });
        const csv = parser.parse(deliveryBoys);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('delivery_boys_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Delivery boy report fetched successfully',
        success: true,
        data: deliveryBoys
      });
    } catch (error) {
      console.error('Delivery Boy Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch delivery boy report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getFuelReport = async (req, res) => {
    try {
      const fuels = await Fuel.find();
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Fuel Type', value: 'type' },
          { label: 'Visible', value: row => row.visibility ? 'Yes' : 'No' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] },
          { label: 'Updated At', value: row => row.updatedAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '-' });
        const csv = parser.parse(fuels);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('fuel_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Fuel report fetched successfully',
        success: true,
        data: fuels
      });
    } catch (error) {
      console.error('Fuel Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch fuel report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getModelReport = async (req, res) => {
    try {
      const models = await Model.find();
  
      // If CSV download is requested
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Model Name', value: 'modelName' },
          { label: 'Visible', value: row => row.visibility ? 'Yes' : 'No' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] },
          { label: 'Updated At', value: row => row.updatedAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '-' });
        const csv = parser.parse(models);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('model_report.csv');
        return res.send(csv);
      }
  
      // JSON Response
      res.status(200).json({
        message: 'Model report fetched successfully',
        success: true,
        data: models
      });
  
    } catch (error) {
      console.error('Model Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch model report',
        success: false,
        error: error.message
      });
    }
  };

  exports.getOfferReport = async (req, res) => {
    try {
      const offers = await Offer.find().populate('shopId', 'shopName');
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Title', value: 'title' },
          { label: 'Description', value: row => row.description || '-' },
          { label: 'Discount Type', value: 'discountType' },
          { label: 'Discount Value', value: 'discountValue' },
          { label: 'Shop', value: row => row.shopId?.shopName || 'Super Admin' },
          { label: 'Start Date', value: row => row.startDate?.toISOString().split('T')[0] || '-' },
          { label: 'End Date', value: row => row.endDate?.toISOString().split('T')[0] || '-' },
          { label: 'Active', value: row => row.isActive ? 'Yes' : 'No' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] },
          { label: 'Updated At', value: row => row.updatedAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields, defaultValue: '-' });
        const csv = parser.parse(offers);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('offer_report.csv');
        return res.send(csv);
      }
  
      // JSON response
      res.status(200).json({
        message: 'Offer report fetched successfully',
        success: true,
        data: offers
      });
  
    } catch (error) {
      console.error('Offer Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch offer report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getOrderReport = async (req, res) => {
    try {
      const orders = await Order.find().populate('assignedDeliveryBoy', 'name');
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Order ID', value: '_id' },
          { label: 'User ID', value: 'userId' },
          { label: 'Shop ID', value: 'shopId' },
          { label: 'Products Count', value: row => row.productId.length },
          { label: 'Total Amount (AED)', value: 'totalAmount' },
          { label: 'Discount (AED)', value: 'discount' },
          { label: 'Delivery Charge', value: row => row.deliverycharge ? 'Yes' : 'No' },
          { label: 'Delivery Distance (KM)', value: 'deliveryDistance' },
          { label: 'Delivery Earning (AED)', value: 'deliveryEarning' },
          { label: 'Order Status', value: 'orderStatus' },
          { label: 'Assigned Delivery Boy', value: row => row.assignedDeliveryBoy?.name || 'Unassigned' },
          { label: 'Delivered Latitude', value: 'deliveryAddress.latitude' },
          { label: 'Delivered Longitude', value: 'deliveryAddress.longitude' },
          { label: 'Delivery Area', value: 'deliveryAddress.area' },
          { label: 'Delivery Place', value: 'deliveryAddress.place' },
          { label: 'Created At', value: row => row.createdAt.toISOString().split('T')[0] },
          { label: 'Updated At', value: row => row.updatedAt.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(orders);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('order_report.csv');
        return res.send(csv);
      }
  
      // Default JSON response
      res.status(200).json({
        message: 'Order report fetched successfully',
        success: true,
        data: orders
      });
  
    } catch (error) {
      console.error('Order Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch order report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getPaymentReport = async (req, res) => {
    try {
      const payments = await Payment.find()
        .populate('userId', 'name email')
        .populate('shopId', 'shopeDetails.shopName');
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Payment ID', value: '_id' },
          { label: 'Order ID', value: row => row.orderId?.toString() || 'N/A' },
          { label: 'User Name', value: row => row.userId?.name || 'N/A' },
          { label: 'User Email', value: row => row.userId?.email || 'N/A' },
          { label: 'Shop Name', value: row => row.shopId?.shopeDetails?.shopName || 'N/A' },
          { label: 'Amount (AED)', value: 'amount' },
          { label: 'Payment Method', value: 'paymentMethod' },
          { label: 'Payment Status', value: 'paymentStatus' },
          { label: 'Transaction ID', value: 'transactionId' },
          { label: 'Payment Date', value: row => row.paymentDate?.toISOString().split('T')[0] },
          { label: 'Created At', value: row => row.createdAt?.toISOString().split('T')[0] },
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(payments);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('payment_report.csv');
        return res.send(csv);
      }
  
      // Default JSON response
      res.status(200).json({
        message: 'Payment report fetched successfully',
        success: true,
        data: payments
      });
  
    } catch (error) {
      console.error('Payment Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch payment report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getProductReport = async (req, res) => {
    try {
      const products = await Product.find();
  
      // Flatten all product arrays into a single list
      const flatList = products.flatMap(product => {
        return product.products.map(p => ({
          shopId: product.shopId,
          name: p.name,
          brand: p.brand,
          category: p.category,
          model: p.model,
          year: p.year,
          color: p.color,
          price: p.price,
          tax: p.tax,
          sku: p.sku,
          condition: p.condition,
          fitmentType: p.fitmentType,
          manufacturer: p.manufacturer,
          createdAt: p.createdAt,
        }));
      });
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Shop ID', value: 'shopId' },
          { label: 'Name', value: 'name' },
          { label: 'Brand', value: 'brand' },
          { label: 'Category', value: 'category' },
          { label: 'Model', value: 'model' },
          { label: 'Year', value: 'year' },
          { label: 'Color', value: 'color' },
          { label: 'Price (AED)', value: 'price' },
          { label: 'Tax', value: 'tax' },
          { label: 'SKU', value: 'sku' },
          { label: 'Condition', value: 'condition' },
          { label: 'Fitment Type', value: 'fitmentType' },
          { label: 'Manufacturer', value: 'manufacturer' },
          { label: 'Created At', value: row => row.createdAt?.toISOString().split('T')[0] },
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(flatList);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('product_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Product report fetched successfully',
        success: true,
        data: flatList
      });
    } catch (error) {
      console.error('Product Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch product report',
        success: false,
        error: error.message
      });
    }
  };

  exports.getShopReport = async (req, res) => {
    try {
      const shops = await Shop.find();
  
      const flatShops = shops.map(shop => {
        const s = shop.shopeDetails || {};
        const b = s.shopBankDetails || {};
        return {
          shopName: s.shopName,
          shopAddress: s.shopAddress,
          shopMail: s.shopMail,
          shopContact: s.shopContact,
          shopLicenseNumber: s.shopLicenseNumber,
          shopLicenseExpiry: s.shopLicenseExpiry,
          emiratesId: s.EmiratesId,
          shopLocation: s.shopLocation,
          supportMail: s.supportMail,
          supportNumber: s.supportNumber,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          ibanNumber: b.ibanNuber,
          branch: b.branch,
          swiftCode: b.swiftCode,
          createdAt: shop.createdAt
        };
      });
  
      // 🧾 CSV Download
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Shop Name', value: 'shopName' },
          { label: 'Shop Address', value: 'shopAddress' },
          { label: 'Shop Email', value: 'shopMail' },
          { label: 'Shop Contact', value: 'shopContact' },
          { label: 'License No.', value: 'shopLicenseNumber' },
          { label: 'License Expiry', value: 'shopLicenseExpiry' },
          { label: 'Emirates ID', value: 'emiratesId' },
          { label: 'Shop Location', value: 'shopLocation' },
          { label: 'Support Email', value: 'supportMail' },
          { label: 'Support Number', value: 'supportNumber' },
          { label: 'Bank Name', value: 'bankName' },
          { label: 'Account Number', value: 'accountNumber' },
          { label: 'IBAN Number', value: 'ibanNumber' },
          { label: 'Branch', value: 'branch' },
          { label: 'SWIFT Code', value: 'swiftCode' },
          { label: 'Created At', value: row => row.createdAt?.toISOString().split('T')[0] }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(flatShops);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('shop_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Shop report fetched successfully',
        success: true,
        data: flatShops
      });
    } catch (error) {
      console.error('Shop Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch shop report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getStockReport = async (req, res) => {
    try {
      const stockEntries = await Stock.find()
        .populate('productId')
        .populate('shopId');
  
      const formatted = stockEntries.map(entry => ({
        shopName: entry.shopId?.shopeDetails?.shopName || 'N/A',
        productName: entry.productId?.name || 'N/A',
        quantity: entry.quantity,
        threshold: entry.threshold,
        lastRestockedAt: entry.lastRestockedAt
          ? entry.lastRestockedAt.toISOString().split('T')[0]
          : 'Never',
        createdAt: entry.createdAt.toISOString().split('T')[0]
      }));
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Shop Name', value: 'shopName' },
          { label: 'Product Name', value: 'productName' },
          { label: 'Quantity', value: 'quantity' },
          { label: 'Threshold', value: 'threshold' },
          { label: 'Last Restocked', value: 'lastRestockedAt' },
          { label: 'Created At', value: 'createdAt' }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(formatted);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('stock_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Stock report fetched successfully',
        success: true,
        data: formatted
      });
    } catch (error) {
      console.error('Stock Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch stock report',
        success: false,
        error: error.message
      });
    }
  };


  exports.getSuperNotificationReport = async (req, res) => {
    try {
      const notifications = await SuperNotification.find().populate('createdBy', 'email');
  
      const formatted = notifications.map(n => ({
        title: n.title,
        message: n.message,
        role: n.role,
        type: n.type,
        createdBy: n.createdBy?.email || 'System',
        sentAt: n.sentAt ? n.sentAt.toISOString().split('T')[0] : 'Not Sent',
        createdAt: n.createdAt.toISOString().split('T')[0]
      }));
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Title', value: 'title' },
          { label: 'Message', value: 'message' },
          { label: 'Role', value: 'role' },
          { label: 'Type', value: 'type' },
          { label: 'Created By', value: 'createdBy' },
          { label: 'Sent At', value: 'sentAt' },
          { label: 'Created At', value: 'createdAt' }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(formatted);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('super_notifications_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Super Notifications report fetched successfully',
        success: true,
        data: formatted
      });
  
    } catch (error) {
      console.error('SuperNotification Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch report',
        success: false,
        error: error.message
      });
    }
  };



  exports.getUserReport = async (req, res) => {
    try {
      const users = await User.find();
  
      const formatted = users.map(user => ({
        name: user.name,
        email: user.email || '-',
        phone: user.phone || '-',
        countryCode: user.countryCode,
        dob: user.dob || '-',
        accountVerify: user.accountVerify ? 'Verified' : 'Not Verified',
        role: user.role,
        createdAt: user.createdAt.toISOString().split('T')[0]
      }));
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Name', value: 'name' },
          { label: 'Email', value: 'email' },
          { label: 'Phone', value: 'phone' },
          { label: 'Country Code', value: 'countryCode' },
          { label: 'DOB', value: 'dob' },
          { label: 'Account Status', value: 'accountVerify' },
          { label: 'Role', value: 'role' },
          { label: 'Created At', value: 'createdAt' }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(formatted);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('user_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'User report fetched successfully',
        success: true,
        data: formatted
      });
    } catch (error) {
      console.error('User Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch user report',
        success: false,
        error: error.message
      });
    }
  };



  exports.getYearReport = async (req, res) => {
    try {
      const years = await Year.find();
  
      const formatted = years.map(y => ({
        year: y.year,
        visibility: y.visibility ? 'Visible' : 'Hidden',
        createdAt: y.createdAt.toISOString().split('T')[0]
      }));
  
      if (req.query.download === 'csv') {
        const fields = [
          { label: 'Year', value: 'year' },
          { label: 'Visibility', value: 'visibility' },
          { label: 'Created At', value: 'createdAt' }
        ];
  
        const parser = new Parser({ fields });
        const csv = parser.parse(formatted);
  
        res.header('Content-Type', 'text/csv');
        res.attachment('year_report.csv');
        return res.send(csv);
      }
  
      res.status(200).json({
        message: 'Year report fetched successfully',
        success: true,
        data: formatted
      });
  
    } catch (error) {
      console.error('Year Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch year report',
        success: false,
        error: error.message
      });
    }
  };
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const express = require('express');
const axios = require("axios");

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes.js');
const shopRoutes = require('./routes/shopRoutes.js');
const customerAddress = require("./routes/customerAddressRoutes.js");
const vinData = require("./routes/vinDataRoutes.js");
const banner = require("./routes/bannerRoutes.js");
const placesRoutes = require('./routes/places');
const notification = require('./routes/notificationRoutes.js');
const cart = require('./routes/cartRouter.js');
const wishlist = require('./routes/wishlistRoutes.js');
const order = require('./routes/orderRoutes.js');
const deliveryBoy = require('./routes/deliveryBoyRoutes.js');
const sales = require('./routes/salesRoutes.js');
const payment = require('./routes/paymentRoutes.js');
const refund = require('./routes/refundRoutes.js');
const invoice = require('./routes/invoiceRoutes.js');
const payout = require('./routes/payoutRoutes.js');
const agency = require('./routes/agencyRoutes.js');
const stock = require('./routes/stockRoutes.js');
const superNotification = require('./routes/superNotificationRoute.js');
const offerCoupon = require('./routes/offerCouponRoutes.js');
const dashboard = require('./routes/dashboardRoutes.js');
const reports = require('./routes/reportRoutes.js');
const catalog = require('./routes/catalogImagesRoutes.js');
const productUpload = require('./routes/productUpload');
const catalogRoutes = require("./routes/catalogRoutes.js");
const engineRoutes = require('./routes/engineRoutes');
const transmissionRoutes = require('./routes/transmissionRoutes');
const superAdminSettingsRoutes = require('./routes/superAdminSettingsRoutes');
const productRatingRoutes = require('./routes/productRatingRoutes');
const appConfigRoutes = require('./routes/appConfigRoutes');
const bellNotification = require('./routes/bellNotificationRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const userNotificationRoutes = require('./routes/userNotificationRoutes');

// ── AWS S3 ────────────────────────────────────────────────────────────────────
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { extractKeyAndBucket } = require('./helper/s3');

// ── Config / infra ────────────────────────────────────────────────────────────
const logger = require('./config/logger');
const morganMiddleware = require('./config/morgan');
const connectDB = require("./config/db.js");
const { initFirebase } = require('./helper/fcmPushHelper');
const { initBackupScheduler } = require('./scripts/backupScheduler');
const {
  generalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  searchLimiter,
  webhookLimiter,
} = require('./middleware/rateLimiter');

// ── Misc ──────────────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');
const { MongoClient } = require('mongodb');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Product = require('./models/_deprecated/Product.js');

// ─────────────────────────────────────────────────────────────────────────────
// APP INIT
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Required when behind nginx so req.ip is the real client IP (not proxy IP)
// Without this, rate limiter sees every request as the same IP
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://autopartsnow.uk",
  "https://autopartsnow.uk",
  "http://www.autopartsnow.uk",
  "http://premart2026.s3-website-us-east-1.amazonaws.com",
  "https://n8fd2gwd-3005.inc1.devtunnels.ms/",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// Applied after CORS (so OPTIONS preflight is never blocked)
// Applied before body parsing (so oversized payloads don't bypass limits)
// ─────────────────────────────────────────────────────────────────────────────

// Stripe webhook — exempt first so it's never accidentally caught by generalLimiter
app.use('/api/payment/webhook',              webhookLimiter);

// OTP — tightest limits, applied before the broader authLimiter
app.use('/api/auth/send-otp',               );
app.use('/api/auth/resend-otp',             );
app.use('/api/auth/verify-otp',             );

// Auth — brute-force protection on login/register
app.use('/api/auth',                        authLimiter);

// Upload / S3 presigned URL — cost protection
app.use('/api/upload-url',                  uploadLimiter);
app.use('/generatePresignedUrl',            uploadLimiter);
app.use('/generatePresignedDownloadUrl',    uploadLimiter);
app.use('/generatePresignedDownloadUrlApp', uploadLimiter);

// Search / catalog — relaxed for read-heavy mobile traffic
app.use('/api/catalog',                     searchLimiter);
app.use('/api/places',                      searchLimiter);

// Baseline DDoS guard on everything else
app.use('/api',                             generalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// BODY PARSING
// ─────────────────────────────────────────────────────────────────────────────
app.use(morganMiddleware);
app.use(express.json({ limit: '10mb' }));

// Handle invalid JSON payloads
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('server: invalid JSON received, resetting body', { error: err.message, path: req.path });
    req.body = {};
    return next();
  }
  next(err);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO + SERVICES
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const socket = require('./sockets/socket');
const io = socket.init(server);
global.io = io;
global.connectedUsers = {};

connectDB();
initFirebase();
initBackupScheduler();

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api/device',            deviceRoutes);
app.use('/api/shop',              shopRoutes);
app.use('/api',                   productRoutes);
app.use('/api/customerAddress',   customerAddress);
app.use('/api/banner',            banner);
app.use('/api/notification',      notification);
app.use('/api/cart',              cart);
app.use('/api/wishlist',          wishlist);
app.use('/api/order',             order);
app.use('/api/deliveryBoy',       deliveryBoy);
app.use('/api/sales',             sales);
app.use('/api/payment',           payment);
app.use('/api/refund',            refund);
app.use('/api/invoice',           invoice);
app.use('/api/payout',            payout);
app.use('/api/agency',            agency);
app.use('/api/stock',             stock);
app.use('/api/superNotification', superNotification);
app.use('/api/offer-Coupon',      offerCoupon);
app.use('/api/dashboard',         dashboard);
app.use('/api/report',            reports);
app.use('/api/vinData',           vinData);
app.use('/api/catalog',           catalog);
app.use('/api',                   catalogRoutes);
app.use('/api',                   productUpload);
app.use('/api/engine',            engineRoutes);
app.use('/api/transmission',      transmissionRoutes);
app.use('/api/vehicle-config',    require('./routes/vehicleConfigurationRoutes'));
app.use('/api/super-admin',       superAdminSettingsRoutes);
app.use('/api/rating',            productRatingRoutes);
app.use('/api/app-config',        appConfigRoutes);
app.use('/api/places',            placesRoutes);
app.use('/api/bell-notifications',bellNotification);
app.use('/api/user-notifications',userNotificationRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('PreMart API is Running');
});

// ─────────────────────────────────────────────────────────────────────────────
// S3 PRE-SIGNED URL ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
const s3 = new S3Client({ region: process.env.AWS_REGION });

app.get('/generatePresignedUrl', async (req, res) => {
  try {
    const filename = req.query.filename;
    if (!filename) {
      return res.status(400).send('Filename is required');
    }

    const command = new PutObjectCommand({
      Bucket:      process.env.AWS_BUCKET_NAME,
      Key:         `uploads/${filename}`,
      ContentType: 'image/jpeg',
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    logger.info('generatePresignedUrl: signed URL generated', { filename });
    res.json({ url: signedUrl });
  } catch (error) {
    logger.error('generatePresignedUrl: failed to generate signed URL', { error });
    res.status(500).send('Error generating signed URL');
  }
});

app.get('/generatePresignedDownloadUrl', async (req, res) => {
  try {
    const filename = req.query.filename;
    if (!filename) {
      return res.status(400).send('Filename is required');
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key:    filename,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    logger.info('generatePresignedDownloadUrl: download URL generated', { filename });
    res.json({ url: signedUrl });
  } catch (error) {
    logger.error('generatePresignedDownloadUrl: failed to generate download URL', { error });
    res.status(500).send('Error generating download URL');
  }
});

app.get('/generatePresignedDownloadUrlApp', async (req, res) => {
  try {
    const { keyOrUrl = '', bucket: bucketOverride } = req.query;
    const { key, bucket } = extractKeyAndBucket(keyOrUrl);

    if (!key) {
      return res.status(400).json({ message: 'keyOrUrl is required (full S3 URL or key)' });
    }

    const bucketName = bucketOverride?.trim() || bucket || process.env.AWS_BUCKET_NAME;
    const s3Key      = `uploads/${key}`;

    const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });
    const url     = await getSignedUrl(s3, command, { expiresIn: 3600 });

    logger.info('generatePresignedDownloadUrlApp: presigned URL generated', { bucketName, s3Key });
    res.json({ url, bucket: bucketName, key: s3Key, expiresIn: 3600 });
  } catch (err) {
    logger.error('generatePresignedDownloadUrlApp: failed to create presigned URL', { error: err });
    res.status(500).json({ message: 'Failed to create presigned URL' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/export-products', async (req, res) => {
  try {
    const filters = req.query;
    logger.info('export-products: request received', { filters });

    const query = {};
    if (filters.brand) query.brand = filters.brand;
    if (filters.model) query.model = filters.model;

    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    if (!products.length) {
      logger.warn('export-products: no products found for export', { filters });
      return res.status(400).json({ message: 'No data to export.' });
    }

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    worksheet.columns = Object.keys(products[0]).map(key => ({
      header: key.toUpperCase(),
      key,
      width: 20
    }));

    products.forEach(product => worksheet.addRow(product));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');

    await workbook.xlsx.write(res);

    logger.info('export-products: export completed', { count: products.length });
    res.end();
  } catch (err) {
    logger.error('export-products: failed to export Excel file', { error: err });
    res.status(500).json({ message: 'Failed to export Excel file.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD URL
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/upload-url', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    logger.info('upload-url: request received', { fileName, fileType });

    if (!fileName || !fileType) {
      logger.warn('upload-url: fileName or fileType missing');
      return res.status(400).json({ message: "fileName and fileType are required" });
    }

    const bucket  = process.env.AWS_BUCKET_NAME;
    const region  = process.env.AWS_REGION;
    const key     = `uploads/${fileName}`;

    const command   = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: fileType });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const fileUrl   = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    logger.info('upload-url: presigned upload URL generated', { fileName, fileUrl });
    return res.json({ uploadUrl, fileUrl });
  } catch (error) {
    logger.error('upload-url: failed to generate presigned URL', { error });
    return res.status(500).json({ message: 'Failed to generate URL', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info('server: PreMart API listening', { host: HOST, port: PORT });
});

const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const express = require('express');
const axios = require("axios");
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/_deprecated/productRoutes.js');
const shopRoutes = require('./routes/shopRoutes.js');
const customerAddress= require("./routes/customerAddressRoutes.js")
const vinData= require("./routes/vinDataRoutes.js")
const banner = require("./routes/bannerRoutes.js")
const ExcelJS = require('exceljs');

const notification = require('./routes/notificationRoutes.js')

const cart = require('./routes/cartRouter.js')
const wishlist = require('./routes/wishlistRoutes.js')
const order = require('./routes/orderRoutes.js')
const deliveryBoy = require('./routes/deliveryBoyRoutes.js')
const sales = require('./routes/salesRoutes.js')
const payment = require('./routes/paymentRoutes.js')
const refund = require('./routes/refundRoutes.js')
const invoice = require('./routes/invoiceRoutes.js')
const payout = require('./routes/payoutRoutes.js')
const agency = require('./routes/agencyRoutes.js')
const stock = require('./routes/stockRoutes.js')
const superNotification = require('./routes/superNotificationRoute.js')
const offerCoupon = require('./routes/offerCouponRoutes.js')
const dashboard = require('./routes/dashboardRoutes.js')
const reports = require('./routes/reportRoutes.js')
const catalog = require('./routes/catalogImagesRoutes.js')
const productUpload = require('./routes/productUpload');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const catalogRoutes = require("./routes/catalogRoutes.js");
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const connectDB =require("./config/db.js")

const { MongoClient } = require('mongodb');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Product = require('./models/_deprecated/Product.js');
const { extractKeyAndBucket } = require('./helper/s3');
const engineRoutes = require('./routes/engineRoutes');
const transmissionRoutes = require('./routes/transmissionRoutes');
const superAdminSettingsRoutes = require('./routes/superAdminSettingsRoutes');
const productRatingRoutes = require('./routes/productRatingRoutes');



const app = express();

const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5050",
  "http://autopartsnow.uk",
  "https://autopartsnow.uk",
  "http://www.autopartsnow.uk",
  "https://d19st5rqqkklcw.cloudfront.net",
  "https://d29n203b886yvl.cloudfront.net",
  "http://10.0.2.2:3005",
  "https://n8fd2gwd-3005.inc1.devtunnels.ms",
  "http://premart2026.s3-website-us-east-1.amazonaws.com"
 
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
// Handle invalid JSON payloads by resetting body and continuing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON received, resetting body:', err.message);
    req.body = {};
    return next();
  }
  next(err);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Middleware

const server = http.createServer(app);
const socket = require('./sockets/socket');
const io = socket.init(server);
global.io = io;
global.connectedUsers = {};

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api',productRoutes);

app.use('/api/customerAddress', customerAddress);
// app.use('/api/card', customerCard); 
app.use('/api/banner',banner);
app.use('/api/notification',notification);
app.use('/api/cart',cart);
app.use('/api/wishlist',wishlist);
app.use('/api/order',order);
app.use('/api/deliveryBoy',deliveryBoy);
app.use('/api/sales',sales);
app.use('/api/payment',payment);
app.use('/api/refund',refund);
app.use('/api/invoice',invoice);
app.use('/api/payout',payout);
app.use('/api/agency',agency);
app.use('/api/stock',stock);
app.use('/api/superNotification',superNotification);
app.use('/api/offer-Coupon',offerCoupon);
app.use('/api/dashboard',dashboard);
app.use('/api/report',reports);
app.use('/api/vinData',vinData);
app.use('/api/catalog',catalog);
app.use("/api", catalogRoutes);
app.use('/api', productUpload);
app.use('/api/engine', engineRoutes);
app.use('/api/transmission', transmissionRoutes);
app.use('/api/vehicle-config', require('./routes/vehicleConfigurationRoutes'));
app.use('/api/super-admin', superAdminSettingsRoutes);
app.use('/api/rating', productRatingRoutes);



// Basic route
app.get('/', (req, res) => {
  res.send('PreMart API is Running');
});

// Generate pre-signed S3 URL
app.get('/generatePresignedUrl', async (req, res) => {
  try {
    const filename = req.query.filename;

    if (!filename) {
      return res.status(400).send('Filename is required');
    }

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME, // your bucket name
      Key: `uploads/${filename}`,     // file name you want to upload
      ContentType: 'image/jpeg', // or set dynamic based on file type
    };

    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes expiry

    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).send('Error generating signed URL');
  }
});
// Generate pre-signed S3 GET URL (download)
app.get('/generatePresignedDownloadUrl', async (req, res) => {
  try {
    const filename = req.query.filename;
    if (!filename) {
      return res.status(400).send('Filename is required');
    }
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key:  filename,
    };
    const command = new GetObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Error generating download URL:', error);
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

    // allow caller to override; otherwise use bucket from URL; otherwise default env
    const bucketName = bucketOverride?.trim() || bucket || process.env.AWS_BUCKET_NAME;

    // (Optional) simple guard: only allow reading under 'uploads/'
    const s3Key = `uploads/${key}`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1h
    res.json({ url, bucket: bucketName, key: s3Key, expiresIn: 3600 });
  } catch (err) {
    console.error('generatePresignedDownloadUrlApp error:', err);
    res.status(500).json({ message: 'Failed to create presigned URL' });
  }
});


app.get('/api/export-products', async (req, res) => {
  try {
    const filters = req.query;

    // 1. Fetch filtered data (customize this based on your schema)
    const query = {};
    if (filters.brand) query.brand = filters.brand;
    if (filters.model) query.model = filters.model;
    // Add more filters as needed

    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    // 2. Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    if (!products.length) return res.status(400).json({ message: 'No data to export.' });

    // 3. Add headers
    worksheet.columns = Object.keys(products[0]).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 20
    }));

    // 4. Add rows
    products.forEach(product => {
      worksheet.addRow(product);
    });

    // 5. Set headers and stream the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).json({ message: 'Failed to export Excel file.' });
  }
});




// const s3 = new S3Client({ region: process.env.AWS_REGION });

// app.post('/api/upload-url', async (req, res) => {
//   try {
//     const { fileName, fileType } = req.body;

//     const command = new PutObjectCommand({
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Key: `uploads/${fileName}`,
//       ContentType: fileType,
//     });

//     const url = await getSignedUrl(s3, command, { expiresIn: 800 }); // 1 minute expiry
//     return res.json({ url });
//   } catch (error) {
//     console.error('Presigned URL error:', error);
//     return res.status(500).json({ message: 'Failed to generate URL', error: error.message });
//   }
// });

const s3 = new S3Client({ region: process.env.AWS_REGION });

app.post('/api/upload-url', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ message: "fileName and fileType are required" });
    }

    const bucket = process.env.AWS_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    const key = `uploads/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return res.json({
      uploadUrl,   // used only for PUT
      fileUrl      // stored in MongoDB & used in UI
    });

  } catch (error) {
    console.error('Presigned URL error:', error);
    return res.status(500).json({ message: 'Failed to generate URL', error: error.message });
  }
});



app.post("/create-payment-intent", async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency,
      payment_method_types: ['card'],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

/////////new tradeshoft apis

const MONGO_URI = process.env.MONGO_URI;

let db, partsCol;
async function initDb() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  partsCol = db.collection("parts_catalog");
}
initDb()
  .then(() => console.log('Mongo (parts_catalog) connected'))
  .catch((e) => console.error('initDb error:', e));

app.get("/parts", async (req, res) => {
  const { catalogId, carId, groupId, partId, limit = 50, page = 1 } = req.query;
  const q = {};
  if (catalogId) q.catalogId = catalogId;
  if (carId) q.carId = carId;
  if (groupId) q.groupId = groupId;
  if (partId) q.partId = partId;
  const cursor = partsCol.find(q).skip((page - 1) * limit).limit(Number(limit));
  const rows = await cursor.toArray();
  res.json(rows);
});

app.get("/parts/:partId", async (req, res) => {
  const doc = await partsCol.findOne({ partId: req.params.partId });
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(doc);
});

//////////////////////////npm install node-fetch mongodb p-limit express


const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
// const PORT =process.env.HOST || process.env.PORT || 6000;
server.listen(PORT,HOST,() =>   console.log(`Server listening on http://${HOST}:${PORT}`));
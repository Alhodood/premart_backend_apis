const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const axios = require("axios");
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes.js');
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
const catalog = require('./routes/catalogImageRoutes.js')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const connectDB =require("./config/db.js")
const app = express();

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
// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST']
//   }
// });

// 'https://property-erp.com',

app.use(cors({
  origin: [
    "http://localhost:5000",
    "http://autopartsnow.uk",
    "https://autopartsnow.uk",
    "http://www.autopartsnow.uk",
    'https://d19st5rqqkklcw.cloudfront.net',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true
}));
// Database connection (replace <connection_string> with your MongoDB URI)

// mongoose.connect(process.env.MONGO_URI || '<connection_string>', { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('MongoDB connected'))
//   .catch((err) => console.error('MongoDB connection error:', err));

// Authentication routes

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
      Bucket: 'premart', // your bucket name
      Key: filename,     // file name you want to upload
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

// 1---------
// Decode VIN endpoint
app.get("/api/decode/:vin", async (req, res) => {
  const vin = req.params.vin;

  if (!vin || vin.length !== 17) {
    return res.status(400).json({ success: false, message: "VIN must be 17 characters" });
  }

  try {
    const { data } = await axios.get(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
    const results = data.Results;

    const output = {
      VIN: vin,
      Manufacturer: results.find(r => r.Variable === "Manufacturer")?.Value,
      ModelYear: results.find(r => r.Variable === "Model Year")?.Value,
      VehicleType: results.find(r => r.Variable === "Vehicle Type")?.Value,
      Series: results.find(r => r.Variable === "Series")?.Value,
      PlantCity: results.find(r => r.Variable === "Plant City")?.Value,
      PlantCountry: results.find(r => r.Variable === "Plant Country")?.Value,
    };

    res.json({ success: true, data: output });
  } catch (err) {
    console.error("Axios error:", err.message);
    res.status(500).json({ success: false, message: "Failed to decode VIN" });
  }
});



// 🔹 API #2 - API Ninjas (Needs API Key)
app.get("/api/decode1/:vin", async (req, res) => {
  const vin = req.params.vin;

  if (!vin || vin.length !== 17) {
    return res.status(400).json({ success: false, message: "VIN must be 17 characters long" });
  }

  try {
    const response = await axios.get(`https://api.api-ninjas.com/v1/vinlookup?vin=${vin}`, {
      headers: { "X-Api-Key": "+dSgdeA8BUMEiY1Zpg7NJA==1s967UxEbxE7WL8R" },
    });

    const data = response.data;

    if (!data || !data.vin) {
      return res.status(404).json({ success: false, message: "VIN not found or invalid response" });
    }

    res.json({
      success: true,
      source: "api-ninjas",
      data,
    });

  } catch (error) {
    console.error("API Ninjas error:", error.message);
    res.status(500).json({ success: false, message: "API Ninjas error" });
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

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/${fileName}`,
      ContentType: fileType,
     
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 1 minute expiry
    return res.json({ url });
  } catch (error) {
    console.error('Presigned URL error:', error);
    return res.status(500).json({ message: 'Failed to generate URL', error: error.message });
  }
});



app.post("/create-payment-intent", async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const paymentIntent = await Stripe(process.env.STRIPE_SECRET_KEY).paymentIntents.create({
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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
// const PORT =process.env.HOST || process.env.PORT || 6000;
server.listen(PORT,HOST,() =>   console.log(`Server listening on http://${HOST}:${PORT}`));

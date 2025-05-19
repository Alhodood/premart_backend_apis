const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes.js');
const shopRoutes = require('./routes/shopRoutes.js');
const customerAddress= require("./routes/customerAddressRoutes.js")
// const customerCard= require("./routes/customerCardRoutes.js")
const banner = require("./routes/bannerRoutes.js")

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
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const connectDB =require("./config/db.js")
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Middleware

const server = http.createServer(app);
const socket = require('./sockets/socket');
const io = socket.init(server);

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
    'http://autopartsnow.uk',       // dev
    'https://autopartsnow.uk',      // production
    'http://www.autopartsnow.uk'   // if you support www
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
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
app.use('/api/whislist',wishlist);
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

    const url = await getSignedUrl(s3, command, { expiresIn: 800 }); // 1 minute expiry
    return res.json({ url });
  } catch (error) {
    console.error('Presigned URL error:', error);
    return res.status(500).json({ message: 'Failed to generate URL', error: error.message });
  }
});
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
// const PORT =process.env.HOST || process.env.PORT || 6000;
server.listen(PORT,HOST,() =>   console.log(`Server listening on http://${HOST}:${PORT}`));



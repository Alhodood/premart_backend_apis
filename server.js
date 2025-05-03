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
const customerCard= require("./routes/customerCardRoutes.js")
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

const connectDB =require("./config/db.js")

// Use the product routes



const app = express();
// Middleware
app.use(express.json());
const server = http.createServer(app);

connectDB();
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});



app.use(cors({
  origin: [
    "http://localhost:5000",
    'http://property-erp.com',       // dev
    'https://property-erp.com',      // production
    'http://www.property-erp.com'   // if you support www
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
app.use('/api/card', customerCard);
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
// Socket.io connection handling (for later real-time features)
// ✅ Socket.io connection setup
io.on('connection', (socket) => {
  console.log('New client connected: ', socket.id);

  // Listen for location updates from delivery boys
  socket.on('updateLocation', (data) => {
    console.log('Received location update:', data);

    // Broadcast to all customers/admins listening for this deliveryBoyId
    io.emit(`locationUpdate-${data.deliveryBoyId}`, data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
// const PORT =process.env.HOST || process.env.PORT || 6000;
server.listen(PORT,HOST,() =>   console.log(`Server listening on http://${HOST}:${PORT}`));



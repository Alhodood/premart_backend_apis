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

const connectDB =require("./config/db.js")
// Use the product routes



const app = express();
const server = http.createServer(app);

connectDB();
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());

app.use(cors({
  origin: [
    'http://property-erp.com',       // dev
    'https://property-erp.com',      // production
    'http://www.property-erp.com'   // if you support www
  ],
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
// app.use('/api/shopeAdmin',shopProfile );

// 



// Basic route
app.get('/', (req, res) => {
  res.send('PreMart API is Running');
});

// Socket.io connection handling (for later real-time features)
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
// const PORT =process.env.HOST || process.env.PORT || 6000;
server.listen(PORT,HOST,() =>   console.log(`Server listening on http://${HOST}:${PORT}`));

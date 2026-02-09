const DeliveryBoy = require('../models/DeliveryBoy');
let io;
const connectedUsers = {};

module.exports = {
  init: (server) => {
    const socketIo = require('socket.io');
    io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    });

    io.on('connection', (socket) => {

      socket.on("live_location", async (data) => {
        try {
          const { deliveryBoyId, latitude, longitude } = data;

          if (!deliveryBoyId || latitude == null || longitude == null) return;

          await DeliveryBoy.findByIdAndUpdate(
            deliveryBoyId,
            {
              latitude,
              longitude,
              updatedAt: new Date(),
            },
            { new: true }
          );

          console.log(`📍 Location updated for ${deliveryBoyId}:`, latitude, longitude);

        } catch (err) {
          console.error("Live location socket error:", err.message);
        }
      });
      
       // ✅ ADD THIS: Test connection handler
  socket.on('test_connection', (data) => {
    console.log('🧪 ========== TEST CONNECTION RECEIVED ==========');
    console.log('Data:', data);
    console.log('Socket ID:', socket.id);
    console.log('===============================================');
  });
  
  console.log('🟢 Client connected:', socket.id);

  const deliveryBoyId = socket.handshake.query.userId;

  if (deliveryBoyId) {
    socket.join(deliveryBoyId);
    connectedUsers[deliveryBoyId] = socket.id;
    console.log('✅ Delivery Boy registered:', deliveryBoyId, 'Socket ID:', socket.id);
    console.log('📋 All connected users:', Object.keys(connectedUsers));
  } else {
    console.log('⚠️ WARNING: No userId provided in handshake query!');
    console.log('Handshake query:', socket.handshake.query);
  }

      socket.on('disconnect', () => {
        for (const id in connectedUsers) {
          if (connectedUsers[id] === socket.id) {
            delete connectedUsers[id];
            console.log('❌ Delivery Boy disconnected:', id);
            break;
          }
        }
        console.log('📋 Remaining connected users:', Object.keys(connectedUsers));
      });
    });

    console.log('✅ Socket initialized');
    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket not initialized');
    return io;
  },

  getConnectedUsers: () => connectedUsers,
  
  // ✅ ADD THIS FUNCTION
  isUserConnected: (userId) => {
    return connectedUsers.hasOwnProperty(userId);
  }
};
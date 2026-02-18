// sockets/socket.js - ENHANCED with Notification Rooms
const DeliveryBoy = require('../models/DeliveryBoy');

let io;
const connectedUsers = {}; // Delivery boys
const connectedShops = {}; // Shop admins
const connectedAdmins = {}; // Super admins
const connectedAgencies = {}; // Agencies
const connectedCustomers = {}; // Customers (for in-app + order events)

module.exports = {
  init: (server) => {
    const socketIo = require('socket.io');
    
    io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    console.log('🔌 Initializing Socket.IO server...');

    io.on('connection', (socket) => {
      console.log('🟢 Client connected:', socket.id);
      console.log('🔍 Handshake query:', socket.handshake.query);

      const userType = socket.handshake.query.userType || 'delivery_boy';
      const deliveryBoyId = socket.handshake.query.userId;
      const shopId = socket.handshake.query.shopId;
      const adminId = socket.handshake.query.adminId;
      const agencyId = socket.handshake.query.agencyId;

      // ✅ DELIVERY BOY CONNECTION
      if (userType === 'delivery_boy' && deliveryBoyId) {
        socket.join(deliveryBoyId);
        socket.join('deliveryBoy'); // Role room
        connectedUsers[deliveryBoyId] = socket.id;
        
        console.log('✅ Delivery Boy registered:', deliveryBoyId);
        
        socket.emit('connection_confirmed', {
          userType: 'delivery_boy',
          userId: deliveryBoyId,
          socketId: socket.id
        });
      }

      // ✅ SHOP ADMIN CONNECTION
      else if (userType === 'shop_admin' && shopId) {
        socket.join(`shop_${shopId}`);
        socket.join('shopAdmin'); // ✅ CRITICAL: Join role room for notifications
        connectedShops[shopId] = socket.id;
        
        console.log('🏪 Shop Admin registered:', shopId);
        console.log('📋 Connected shops:', Object.keys(connectedShops).length);

        socket.emit('connection_confirmed', {
          userType: 'shop_admin',
          shopId: shopId,
          socketId: socket.id
        });
      }

      // ✅ SUPER ADMIN CONNECTION
      else if (userType === 'super_admin' && adminId) {
        socket.join('super_admins');
        socket.join('superAdmin'); // ✅ CRITICAL: Join role room for notifications
        connectedAdmins[adminId] = socket.id;
        
        console.log('👑 Super Admin registered:', adminId);
        console.log('📋 Connected admins:', Object.keys(connectedAdmins).length);

        socket.emit('connection_confirmed', {
          userType: 'super_admin',
          adminId: adminId,
          socketId: socket.id
        });
      }

      // ✅ AGENCY CONNECTION
      else if (userType === 'agency' && agencyId) {
        socket.join(`agency_${agencyId}`);
        socket.join('agency'); // ✅ CRITICAL: Join role room for notifications
        connectedAgencies[agencyId] = socket.id;
        
        console.log('🚛 Agency registered:', agencyId);
        console.log('📋 Connected agencies:', Object.keys(connectedAgencies).length);

        socket.emit('connection_confirmed', {
          userType: 'agency',
          agencyId: agencyId,
          socketId: socket.id
        });
      }

      // ✅ CUSTOMER CONNECTION (for in-app notifications + order events)
      else if (userType === 'customer' && deliveryBoyId) {
        const uid = deliveryBoyId.toString();
        socket.join(uid);
        connectedCustomers[uid] = socket.id;
        console.log('👤 Customer registered:', uid);
        socket.emit('connection_confirmed', {
          userType: 'customer',
          userId: uid,
          socketId: socket.id
        });
      }

      // ❌ INVALID CONNECTION
      else {
        console.log('⚠️ Invalid connection parameters:', { userType, deliveryBoyId, shopId, adminId, agencyId });
        socket.emit('connection_error', {
          error: 'Invalid connection parameters'
        });
      }

      // ✅ LIVE LOCATION (Delivery Boy)
      socket.on('live_location', async (data) => {
        try {
          const { deliveryBoyId, latitude, longitude } = data;
          if (!deliveryBoyId || latitude == null || longitude == null) return;

          await DeliveryBoy.findByIdAndUpdate(
            deliveryBoyId,
            { latitude, longitude, updatedAt: new Date() },
            { new: true }
          );

          console.log(`📍 Location updated for ${deliveryBoyId}: ${latitude}, ${longitude}`);

          io.to('super_admins').emit('delivery_boy_location_update', {
            deliveryBoyId,
            latitude,
            longitude,
            timestamp: new Date()
          });
        } catch (err) {
          console.error('Live location error:', err.message);
        }
      });

      // ✅ TEST CONNECTION
      socket.on('test_connection', (data) => {
        console.log('🧪 Test connection received:', data);
        socket.emit('test_connection_response', {
          received: data,
          socketId: socket.id,
          timestamp: new Date()
        });
      });

      // ✅ DISCONNECT
      socket.on('disconnect', (reason) => {
        console.log('🔴 Client disconnected:', socket.id, 'Reason:', reason);

        for (const id in connectedUsers) {
          if (connectedUsers[id] === socket.id) {
            delete connectedUsers[id];
            console.log('❌ Delivery Boy disconnected:', id);
            break;
          }
        }

        for (const id in connectedShops) {
          if (connectedShops[id] === socket.id) {
            delete connectedShops[id];
            console.log('❌ Shop Admin disconnected:', id);
            break;
          }
        }

        for (const id in connectedAdmins) {
          if (connectedAdmins[id] === socket.id) {
            delete connectedAdmins[id];
            console.log('❌ Super Admin disconnected:', id);
            break;
          }
        }

        for (const id in connectedAgencies) {
          if (connectedAgencies[id] === socket.id) {
            delete connectedAgencies[id];
            console.log('❌ Agency disconnected:', id);
            break;
          }
        }

        for (const id in connectedCustomers) {
          if (connectedCustomers[id] === socket.id) {
            delete connectedCustomers[id];
            console.log('❌ Customer disconnected:', id);
            break;
          }
        }
      });
    });

    console.log('✅ Socket.IO server initialized with notification support');
    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  },

  getConnectedUsers: () => connectedUsers,
  getConnectedShops: () => connectedShops,
  getConnectedAdmins: () => connectedAdmins,
  getConnectedAgencies: () => connectedAgencies,
  getConnectedCustomers: () => connectedCustomers,

  isUserConnected: (userId) => connectedUsers.hasOwnProperty(userId),
  isShopConnected: (shopId) => connectedShops.hasOwnProperty(shopId),
  isAgencyConnected: (agencyId) => connectedAgencies.hasOwnProperty(agencyId),

  // Helper functions
  emitToShop: (shopId, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(`shop_${shopId}`).emit(event, data);
    console.log(`📤 Emitted '${event}' to shop ${shopId}`);
  },

  emitToSuperAdmins: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to('super_admins').emit(event, data);
    console.log(`📤 Emitted '${event}' to super admins`);
  },

  emitToAgency: (agencyId, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(`agency_${agencyId}`).emit(event, data);
    console.log(`📤 Emitted '${event}' to agency ${agencyId}`);
  },

  // ✅ Emit to role rooms (for notifications)
  emitToRole: (role, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(role).emit(event, data);
    console.log(`📤 Emitted '${event}' to role '${role}'`);
  },

  broadcast: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.emit(event, data);
    console.log(`📢 Broadcasted '${event}' to all clients`);
  },

  /** Emit to a specific user (customer or delivery boy by userId). For in-app real-time notifications. */
  emitToUser: (userId, event, data) => {
    if (!io) return;
    const uid = userId && userId.toString();
    if (uid) {
      io.to(uid).emit(event, data);
    }
  }
};
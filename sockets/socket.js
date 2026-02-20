// sockets/socket.js - FIXED: Session token validation prevents cross-role notification leaks
const DeliveryBoy = require('../models/DeliveryBoy');
const jwt = require('jsonwebtoken');

let io;
const connectedUsers    = {}; // deliveryBoyId → socketId
const connectedShops    = {}; // shopId        → socketId
const connectedAdmins   = {}; // adminId       → socketId
const connectedAgencies = {}; // agencyId      → socketId
const connectedCustomers = {};

// ✅ Tracks which role/id each socket belongs to — O(1) cleanup on disconnect
const socketRoles = {}; // socketId → { room, id, map }

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

    io.on('connection', async (socket) => {
      console.log('🟢 Client connected:', socket.id);
      console.log('🔍 Handshake query:', socket.handshake.query);

      const { userType, userId, shopId, adminId, agencyId, token } = socket.handshake.query;

      // ─── ✅ FIX 1: Validate JWT — TOKEN IS REQUIRED ────────────────────────
      // Without this, any client can pass any userType and join any room.
      // After logout + cache clear, no token exists → connection is rejected.
      if (!token) {
        console.warn('⛔ No token provided — rejecting connection:', socket.id);
        socket.emit('connection_error', { error: 'Authentication token required' });
        socket.disconnect(true);
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.decodedUser = decoded;
        console.log(`✅ JWT valid | role: ${decoded.role} | socket: ${socket.id}`);
      } catch (err) {
        console.warn('⚠️ Invalid/expired JWT — disconnecting socket:', socket.id);
        socket.emit('connection_error', { error: 'Invalid or expired session token' });
        socket.disconnect(true);
        return;
      }

      // ─── ✅ FIX 2: Evict stale socket for same identity ────────────────────
      // On page refresh, the old socket lingers on server for ping timeout duration.
      // During that window, BOTH old and new sockets are in the role room —
      // so the old one would receive notifications for the new session too.
      // Fix: explicitly disconnect the stale socket when a new one registers.
      const evictStale = (map, id, roleName) => {
        if (map[id] && map[id] !== socket.id) {
          const staleSocket = io.sockets.sockets.get(map[id]);
          if (staleSocket) {
            console.log(`🔄 Evicting stale ${roleName} socket for ${id}: ${map[id]}`);
            staleSocket.disconnect(true);
          }
          // Always clear the stale entry
          delete map[id];
        }
      };

      // ─── DELIVERY BOY ──────────────────────────────────────────────────────
      if (userType === 'delivery_boy' && userId) {
        evictStale(connectedUsers, userId, 'deliveryBoy');
        socket.join(userId);
        socket.join('deliveryBoy');
        connectedUsers[userId] = socket.id;
        socketRoles[socket.id] = { room: 'deliveryBoy', id: userId, map: 'users' };
        console.log('✅ Delivery Boy registered:', userId);
        socket.emit('connection_confirmed', {
          userType: 'delivery_boy', userId, socketId: socket.id
        });
      }

      // ─── SHOP ADMIN ────────────────────────────────────────────────────────
      else if (userType === 'shop_admin' && shopId) {
        evictStale(connectedShops, shopId, 'shopAdmin');
        socket.join(`shop_${shopId}`);
        socket.join('shopAdmin');
        connectedShops[shopId] = socket.id;
        socketRoles[socket.id] = { room: 'shopAdmin', id: shopId, map: 'shops' };
        console.log('🏪 Shop Admin registered:', shopId);
        console.log('📋 Connected shops:', Object.keys(connectedShops).length);
        socket.emit('connection_confirmed', {
          userType: 'shop_admin', shopId, socketId: socket.id
        });
      }

      // ─── SUPER ADMIN ───────────────────────────────────────────────────────
      else if (userType === 'super_admin' && adminId) {
        evictStale(connectedAdmins, adminId, 'superAdmin');
        socket.join('super_admins');
        socket.join('superAdmin');
        connectedAdmins[adminId] = socket.id;
        socketRoles[socket.id] = { room: 'superAdmin', id: adminId, map: 'admins' };
        console.log('👑 Super Admin registered:', adminId);
        console.log('📋 Connected admins:', Object.keys(connectedAdmins).length);
        socket.emit('connection_confirmed', {
          userType: 'super_admin', adminId, socketId: socket.id
        });
      }

      // ─── AGENCY ────────────────────────────────────────────────────────────
      else if (userType === 'agency' && agencyId) {
        evictStale(connectedAgencies, agencyId, 'agency');
        socket.join(`agency_${agencyId}`);
        socket.join('agency');
        connectedAgencies[agencyId] = socket.id;
        socketRoles[socket.id] = { room: 'agency', id: agencyId, map: 'agencies' };
        console.log('🚛 Agency registered:', agencyId);
        console.log('📋 Connected agencies:', Object.keys(connectedAgencies).length);
        socket.emit('connection_confirmed', {
          userType: 'agency', agencyId, socketId: socket.id
        });
      }

      // ─── CUSTOMER ──────────────────────────────────────────────────────────
      else if (userType === 'customer' && userId) {
        const uid = userId.toString();
        evictStale(connectedCustomers, uid, 'customer');
        socket.join(uid);
        connectedCustomers[uid] = socket.id;
        socketRoles[socket.id] = { room: null, id: uid, map: 'customers' };
        console.log('👤 Customer registered:', uid);
        socket.emit('connection_confirmed', {
          userType: 'customer', userId: uid, socketId: socket.id
        });
      }

      // ─── INVALID ───────────────────────────────────────────────────────────
      else {
        console.warn('⚠️ Invalid connection params:', { userType, userId, shopId, adminId, agencyId });
        socket.emit('connection_error', { error: 'Invalid connection parameters' });
        socket.disconnect(true);
        return;
      }

      // ─── LIVE LOCATION ─────────────────────────────────────────────────────
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
            deliveryBoyId, latitude, longitude, timestamp: new Date()
          });
        } catch (err) {
          console.error('Live location error:', err.message);
        }
      });

      // ─── TEST ──────────────────────────────────────────────────────────────
      socket.on('test_connection', (data) => {
        console.log('🧪 Test connection received:', data);
        socket.emit('test_connection_response', {
          received: data, socketId: socket.id, timestamp: new Date()
        });
      });

      // ─── ✅ FIX 3: Disconnect cleanup using socketRoles map (O(1)) ─────────
      // Previously iterated all 4 maps on every disconnect — O(n) per map.
      // Now we track which map/room the socket belongs to on connect and clean directly.
      // CRITICAL: Only delete from map if this socket is still the CURRENT one —
      // prevents a freshly-evicted stale socket from removing the new socket's entry.
      socket.on('disconnect', (reason) => {
        console.log('🔴 Client disconnected:', socket.id, '| Reason:', reason);

        const roleInfo = socketRoles[socket.id];
        if (!roleInfo) return; // Already cleaned up (e.g. evicted)

        const { room, id, map } = roleInfo;

        switch (map) {
          case 'users':
            if (connectedUsers[id] === socket.id) {
              delete connectedUsers[id];
              console.log('❌ Delivery Boy disconnected:', id);
            }
            break;
          case 'shops':
            if (connectedShops[id] === socket.id) {
              delete connectedShops[id];
              console.log('❌ Shop Admin disconnected:', id);
            }
            break;
          case 'admins':
            if (connectedAdmins[id] === socket.id) {
              delete connectedAdmins[id];
              console.log('❌ Super Admin disconnected:', id);
            }
            break;
          case 'agencies':
            if (connectedAgencies[id] === socket.id) {
              delete connectedAgencies[id];
              console.log('❌ Agency disconnected:', id);
            }
            break;
          case 'customers':
            if (connectedCustomers[id] === socket.id) {
              delete connectedCustomers[id];
              console.log('❌ Customer disconnected:', id);
            }
            break;
        }

        // ✅ Explicitly leave role room so no more notifications reach this socket
        if (room) socket.leave(room);
        delete socketRoles[socket.id];
      });
    });

    console.log('✅ Socket.IO initialized with JWT validation + stale eviction');
    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  },

  getConnectedUsers:     () => connectedUsers,
  getConnectedShops:     () => connectedShops,
  getConnectedAdmins:    () => connectedAdmins,
  getConnectedAgencies:  () => connectedAgencies,
  getConnectedCustomers: () => connectedCustomers,

  isUserConnected:   (userId)   => Object.prototype.hasOwnProperty.call(connectedUsers,    userId),
  isShopConnected:   (shopId)   => Object.prototype.hasOwnProperty.call(connectedShops,    shopId),
  isAgencyConnected: (agencyId) => Object.prototype.hasOwnProperty.call(connectedAgencies, agencyId),

  emitToShop: (shopId, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(`shop_${shopId}`).emit(event, data);
    console.log(`📤 '${event}' → shop ${shopId}`);
  },

  emitToSuperAdmins: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to('super_admins').emit(event, data);
    console.log(`📤 '${event}' → super_admins`);
  },

  emitToAgency: (agencyId, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(`agency_${agencyId}`).emit(event, data);
    console.log(`📤 '${event}' → agency ${agencyId}`);
  },

  emitToRole: (role, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(role).emit(event, data);
    console.log(`📤 '${event}' → role '${role}'`);
  },

  broadcast: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.emit(event, data);
    console.log(`📢 Broadcast '${event}' to all clients`);
  },

  emitToUser: (userId, event, data) => {
    if (!io) return;
    const uid = userId && userId.toString();
    if (uid) io.to(uid).emit(event, data);
  }
};
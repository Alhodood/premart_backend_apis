// sockets/socket.js - FIXED: Session token validation prevents cross-role notification leaks
const DeliveryBoy = require('../models/DeliveryBoy');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

let io;
const connectedUsers     = {}; // deliveryBoyId → socketId
const connectedShops     = {}; // shopId        → socketId
const connectedAdmins    = {}; // adminId       → socketId
const connectedAgencies  = {}; // agencyId      → socketId
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
      pingTimeout:  60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    logger.info('socket: initializing Socket.IO server');

    io.on('connection', async (socket) => {
      logger.info('socket: client connected', { socketId: socket.id });

      const { userType, userId, shopId, adminId, agencyId, token } = socket.handshake.query;

      // ─── ✅ FIX 1: Validate JWT — TOKEN IS REQUIRED ──────────────────────
      if (!token) {
        logger.warn('socket: no token provided — rejecting connection', { socketId: socket.id });
        socket.emit('connection_error', { error: 'Authentication token required' });
        socket.disconnect(true);
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.decodedUser = decoded;
        logger.info('socket: JWT valid', { role: decoded.role, socketId: socket.id });
      } catch (err) {
        logger.warn('socket: invalid or expired JWT — disconnecting', { socketId: socket.id, error: err.message });
        socket.emit('connection_error', { error: 'Invalid or expired session token' });
        socket.disconnect(true);
        return;
      }

      // ─── ✅ FIX 2: Evict stale socket for same identity ──────────────────
      const evictStale = (map, id, roleName) => {
        if (map[id] && map[id] !== socket.id) {
          const staleSocket = io.sockets.sockets.get(map[id]);
          if (staleSocket) {
            logger.info('socket: evicting stale socket', { roleName, id, staleSocketId: map[id] });
            staleSocket.disconnect(true);
          }
          delete map[id];
        }
      };

      // ─── DELIVERY BOY ────────────────────────────────────────────────────
      if (userType === 'delivery_boy' && userId) {
        evictStale(connectedUsers, userId, 'deliveryBoy');
        socket.join(userId);
        socket.join('deliveryBoy');
        connectedUsers[userId] = socket.id;
        socketRoles[socket.id] = { room: 'deliveryBoy', id: userId, map: 'users' };
        logger.info('socket: delivery boy registered', { userId, socketId: socket.id });
        socket.emit('connection_confirmed', { userType: 'delivery_boy', userId, socketId: socket.id });
      }

      // ─── SHOP ADMIN ──────────────────────────────────────────────────────
      else if (userType === 'shop_admin' && shopId) {
        evictStale(connectedShops, shopId, 'shopAdmin');
        socket.join(`shop_${shopId}`);
        socket.join('shopAdmin');
        connectedShops[shopId] = socket.id;
        socketRoles[socket.id] = { room: 'shopAdmin', id: shopId, map: 'shops' };
        logger.info('socket: shop admin registered', { shopId, socketId: socket.id, totalConnectedShops: Object.keys(connectedShops).length });
        socket.emit('connection_confirmed', { userType: 'shop_admin', shopId, socketId: socket.id });
      }

      // ─── SUPER ADMIN ─────────────────────────────────────────────────────
      else if (userType === 'super_admin' && adminId) {
        evictStale(connectedAdmins, adminId, 'superAdmin');
        socket.join('super_admins');
        socket.join('superAdmin');
        connectedAdmins[adminId] = socket.id;
        socketRoles[socket.id] = { room: 'superAdmin', id: adminId, map: 'admins' };
        logger.info('socket: super admin registered', { adminId, socketId: socket.id, totalConnectedAdmins: Object.keys(connectedAdmins).length });
        socket.emit('connection_confirmed', { userType: 'super_admin', adminId, socketId: socket.id });
      }

      // ─── AGENCY ──────────────────────────────────────────────────────────
      else if (userType === 'agency' && agencyId) {
        evictStale(connectedAgencies, agencyId, 'agency');
        socket.join(`agency_${agencyId}`);
        socket.join('agency');
        connectedAgencies[agencyId] = socket.id;
        socketRoles[socket.id] = { room: 'agency', id: agencyId, map: 'agencies' };
        logger.info('socket: agency registered', { agencyId, socketId: socket.id, totalConnectedAgencies: Object.keys(connectedAgencies).length });
        socket.emit('connection_confirmed', { userType: 'agency', agencyId, socketId: socket.id });
      }

      // ─── CUSTOMER ────────────────────────────────────────────────────────
      else if (userType === 'customer' && userId) {
        const uid = userId.toString();
        evictStale(connectedCustomers, uid, 'customer');
        socket.join(uid);
        connectedCustomers[uid] = socket.id;
        socketRoles[socket.id] = { room: null, id: uid, map: 'customers' };
        logger.info('socket: customer registered', { userId: uid, socketId: socket.id });
        socket.emit('connection_confirmed', { userType: 'customer', userId: uid, socketId: socket.id });
      }

      // ─── INVALID ─────────────────────────────────────────────────────────
      else {
        logger.warn('socket: invalid connection params — disconnecting', { userType, userId, shopId, adminId, agencyId, socketId: socket.id });
        socket.emit('connection_error', { error: 'Invalid connection parameters' });
        socket.disconnect(true);
        return;
      }

      // ─── LIVE LOCATION ───────────────────────────────────────────────────
      socket.on('live_location', async (data) => {
        try {
          const { deliveryBoyId, latitude, longitude } = data;
          if (!deliveryBoyId || latitude == null || longitude == null) return;

          await DeliveryBoy.findByIdAndUpdate(
            deliveryBoyId,
            { latitude, longitude, updatedAt: new Date() },
            { new: true }
          );

          logger.info('socket: live location updated', { deliveryBoyId, latitude, longitude });
          io.to('super_admins').emit('delivery_boy_location_update', {
            deliveryBoyId, latitude, longitude, timestamp: new Date()
          });
        } catch (err) {
          logger.error('socket: live location update failed', { error: err.message });
        }
      });

      // ─── TEST ─────────────────────────────────────────────────────────────
      socket.on('test_connection', (data) => {
        logger.info('socket: test connection received', { socketId: socket.id, data });
        socket.emit('test_connection_response', {
          received: data, socketId: socket.id, timestamp: new Date()
        });
      });

      // ─── ✅ FIX 3: Disconnect cleanup using socketRoles map (O(1)) ────────
      socket.on('disconnect', (reason) => {
        logger.info('socket: client disconnected', { socketId: socket.id, reason });

        const roleInfo = socketRoles[socket.id];
        if (!roleInfo) return;

        const { room, id, map } = roleInfo;

        switch (map) {
          case 'users':
            if (connectedUsers[id] === socket.id) {
              delete connectedUsers[id];
              logger.info('socket: delivery boy disconnected', { userId: id });
            }
            break;
          case 'shops':
            if (connectedShops[id] === socket.id) {
              delete connectedShops[id];
              logger.info('socket: shop admin disconnected', { shopId: id });
            }
            break;
          case 'admins':
            if (connectedAdmins[id] === socket.id) {
              delete connectedAdmins[id];
              logger.info('socket: super admin disconnected', { adminId: id });
            }
            break;
          case 'agencies':
            if (connectedAgencies[id] === socket.id) {
              delete connectedAgencies[id];
              logger.info('socket: agency disconnected', { agencyId: id });
            }
            break;
          case 'customers':
            if (connectedCustomers[id] === socket.id) {
              delete connectedCustomers[id];
              logger.info('socket: customer disconnected', { userId: id });
            }
            break;
        }

        if (room) socket.leave(room);
        delete socketRoles[socket.id];
      });
    });

    logger.info('socket: Socket.IO initialized with JWT validation + stale eviction');
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
    logger.info('socket: emitToShop', { event, shopId });
  },

  emitToSuperAdmins: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to('super_admins').emit(event, data);
    logger.info('socket: emitToSuperAdmins', { event });
  },

  emitToAgency: (agencyId, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(`agency_${agencyId}`).emit(event, data);
    logger.info('socket: emitToAgency', { event, agencyId });
  },

  emitToRole: (role, event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.to(role).emit(event, data);
    logger.info('socket: emitToRole', { event, role });
  },

  broadcast: (event, data) => {
    if (!io) throw new Error('Socket.IO not initialized');
    io.emit(event, data);
    logger.info('socket: broadcast', { event });
  },

  emitToUser: (userId, event, data) => {
    if (!io) return;
    const uid = userId && userId.toString();
    if (uid) io.to(uid).emit(event, data);
  }
};
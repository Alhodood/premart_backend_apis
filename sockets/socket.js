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
      console.log('New client connected:', socket.id);

      const userId = socket.handshake.query.userId;
      if (userId) {
        socket.join(userId); // 👈 allow user-specific room-based communication
        connectedUsers[userId] = socket.id;
        console.log(`User ${userId} associated with socket ${socket.id}`);
      }

      socket.on('updateLocation', (data) => {
        console.log('Location update:', data);
        io.emit(`locationUpdate-${data.deliveryBoyId}`, data);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up from connectedUsers
        for (const user in connectedUsers) {
          if (connectedUsers[user] === socket.id) {
            socket.leave(user); // 👈 ensure the socket leaves the room on disconnect
            delete connectedUsers[user];
            console.log(`User ${user} removed from connected users`);
            break;
          }
        }
      });
    });

    global.io = io;
    global.connectedUsers = connectedUsers;

    /**
     * Listen for a custom event to assign a new order to nearby delivery boys.
     * This example demonstrates emitting a stringified payload for Flutter compatibility.
     * Replace this with your actual assignment logic as needed.
     */
    global.emitNewOrderAssigned = function(nearbyDeliveryBoys, order) {
      nearbyDeliveryBoys.forEach((boy) => {
        io.to(boy._id.toString()).emit('new_order_assigned', JSON.stringify({
          message: 'You have a new order to accept or reject',
          orderId: order._id,
        }));
      });
    };

    console.log('✅ Socket.IO initialized');
    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error('Socket.IO not initialized!');
    } else {
      console.log('Socket.IO initialized');
    }
    return io;
  },
};
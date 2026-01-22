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
      console.log('🟢 Client connected:', socket.id);

      const userId = socket.handshake.query.userId;

      if (userId) {
        socket.join(userId);
        connectedUsers[userId] = socket.id;
        console.log('✅ User registered:', userId);
      }

      socket.on('disconnect', () => {
        for (const id in connectedUsers) {
          if (connectedUsers[id] === socket.id) {
            delete connectedUsers[id];
            console.log('❌ User removed:', id);
            break;
          }
        }
      });
    });

    console.log('✅ Socket initialized');
    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket not initialized');
    return io;
  },

  getConnectedUsers: () => connectedUsers
};
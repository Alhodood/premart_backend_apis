let io;

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

      socket.on('updateLocation', (data) => {
        console.log('Location update:', data);
        io.emit(`locationUpdate-${data.deliveryBoyId}`, data);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error('Socket.IO not initialized!');
    }else{
        console.log('Socket.IO initialized');
    }
    return io;
  },
};
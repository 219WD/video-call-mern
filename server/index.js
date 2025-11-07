const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const visitRoutes = require('./routes/visits');
const qrRoutes = require('./routes/qr');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/qr', qrRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Almacén mejorado de salas
const rooms = {};

io.on('connection', (socket) => {
  console.log('NUEVA CONEXIÓN:', socket.id, 'User:', socket.userId);

  socket.on('join-room', async ({ roomId, role, userData }) => {
    try {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = role;
      socket.userData = userData;

      if (role === 'host') {
        rooms[roomId] = { 
          hostId: socket.id, 
          status: 'waiting',
          hostData: userData
        };
        console.log(`HOST unido a sala ${roomId} → ${socket.id}`);
      } else if (role === 'guest') {
        if (!rooms[roomId]) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }
        
        rooms[roomId].guestId = socket.id;
        rooms[roomId].guestData = userData;
        rooms[roomId].status = 'ringing';
        
        console.log(`GUEST ${socket.id} llama a HOST ${rooms[roomId].hostId}`);
        
        // Notificación push mejorada al host
        io.to(rooms[roomId].hostId).emit('ring', {
          guest: userData,
          timestamp: new Date(),
          roomId: roomId
        });
      }
    } catch (error) {
      console.error('Error en join-room:', error);
    }
  });

  socket.on('call-offer', ({ offer }) => {
    const room = rooms[socket.roomId];
    if (room && room.hostId) {
      io.to(room.hostId).emit('offer', { 
        offer, 
        from: socket.id,
        guest: room.guestData 
      });
    }
  });

  socket.on('answer', ({ answer, to }) => {
    io.to(to).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', candidate);
  });

  socket.on('accept-call', async () => {
    const room = rooms[socket.roomId];
    if (room && room.guestId) {
      room.status = 'connected';
      
      // Registrar visita exitosa
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: room.guestData,
        type: 'video_call',
        status: 'accepted',
        timestamp: new Date()
      });

      io.to(room.guestId).emit('call-accepted');
    }
  });

  socket.on('reject-call', async () => {
    const room = rooms[socket.roomId];
    if (room && room.guestId) {
      // Registrar visita rechazada
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: room.guestData,
        type: 'video_call',
        status: 'rejected',
        timestamp: new Date()
      });

      io.to(room.guestId).emit('call-rejected');
      delete rooms[socket.roomId];
    }
  });

  socket.on('leave-message', async ({ name, message }) => {
    const room = rooms[socket.roomId];
    if (room) {
      // Registrar mensaje dejado
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: { name, email: socket.userData?.email },
        type: 'message',
        message: message,
        status: 'message_left',
        timestamp: new Date()
      });

      // Notificar al host del mensaje
      if (room.hostId) {
        io.to(room.hostId).emit('new-message', {
          name,
          message,
          timestamp: new Date()
        });
      }
    }
  });

  socket.on('toggle-camera', ({ enabled }) => {
    const room = rooms[socket.roomId];
    if (room) {
      const target = socket.role === 'host' ? room.guestId : room.hostId;
      if (target) {
        io.to(target).emit('camera-toggled', { enabled });
      }
    }
  });

  socket.on('end-call', async () => {
    const room = rooms[socket.roomId];
    if (room) {
      io.to(room.hostId).emit('call-ended');
      if (room.guestId) io.to(room.guestId).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });

  socket.on('disconnect', () => {
    console.log('DESCONECTADO:', socket.id);
    const room = Object.values(rooms).find(r => r.hostId === socket.id || r.guestId === socket.id);
    if (room) {
      io.to(room.hostId).emit('call-ended');
      if (room.guestId) io.to(room.guestId).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor en puerto ${PORT}`);
});
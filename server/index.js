const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');

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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Almacén de salas
const rooms = {};

io.on('connection', (socket) => {
  console.log('NUEVA CONEXIÓN:', socket.id);

  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    if (role === 'host') {
      rooms[roomId] = { hostId: socket.id, status: 'waiting' };
      console.log(`HOST unido a sala ${roomId} → ${socket.id}`);
    } else if (role === 'guest') {
      if (!rooms[roomId]) {
        console.log(`ERROR: Sala ${roomId} no existe`);
        socket.emit('error', { message: 'Sala no encontrada' });
        return;
      }
      rooms[roomId].guestId = socket.id;
      rooms[roomId].status = 'ringing';
      console.log(`GUEST ${socket.id} llama a HOST ${rooms[roomId].hostId}`);
      io.to(rooms[roomId].hostId).emit('ring'); // Timbre
    }
  });

  socket.on('call-offer', ({ offer }) => {
    const room = rooms[socket.roomId];
    if (room && room.hostId) {
      console.log(`OFERTA enviada a HOST ${room.hostId}`);
      io.to(room.hostId).emit('offer', { offer, from: socket.id });
    }
  });

  socket.on('answer', ({ answer, to }) => {
    console.log(`ANSWER enviada a GUEST ${to}`);
    io.to(to).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', candidate);
  });

  socket.on('accept-call', () => {
    const room = rooms[socket.roomId];
    if (room && room.guestId) {
      room.status = 'connected';
      io.to(room.guestId).emit('call-accepted');
      console.log(`Llamada ACEPTADA`);
    }
  });

  socket.on('reject-call', () => {
    const room = rooms[socket.roomId];
    if (room && room.guestId) {
      io.to(room.guestId).emit('call-rejected');
      delete rooms[socket.roomId];
    }
  });

  socket.on('end-call', () => {
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
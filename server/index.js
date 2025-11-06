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
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Almacén de salas: { roomId: { hostId: socket.id } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('CONEXIÓN:', socket.id);

  // Unirse a sala
  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    if (role === 'host') {
      rooms[roomId] = { hostId: socket.id };
      console.log(`HOST unido: ${socket.id} → sala ${roomId}`);
    } else if (role === 'guest') {
      console.log(`GUEST unido: ${socket.id} → sala ${roomId}`);
      // Notificar al host que hay un guest listo
      const hostId = rooms[roomId]?.hostId;
      if (hostId) {
        io.to(hostId).emit('guest-joined');
      }
    }
  });

  // Guest envía oferta
  socket.on('call-offer', ({ offer, roomId }) => {
    const hostId = rooms[roomId]?.hostId;
    if (hostId) {
      console.log(`OFERTA de ${socket.id} → HOST ${hostId}`);
      io.to(hostId).emit('incoming-call', { offer, from: socket.id });
    } else {
      console.log(`ERROR: No hay host en sala ${roomId}`);
      socket.emit('error', { message: 'Host no disponible' });
    }
  });

  // Host acepta
  socket.on('accept-call', ({ answer, to }) => {
    console.log(`ANSWER de host ${socket.id} → guest ${to}`);
    io.to(to).emit('call-accepted', { answer });
  });

  // ICE
  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('new-ice-candidate', candidate);
  });

  // Finalizar
  socket.on('end-call', ({ roomId }) => {
    io.to(roomId).emit('call-ended');
    delete rooms[roomId];
  });

  socket.on('disconnect', () => {
    console.log('DESCONECTADO:', socket.id);
    if (socket.role === 'host' && socket.roomId) {
      delete rooms[socket.roomId];
    }
    if (socket.roomId) {
      io.to(socket.roomId).emit('call-ended');
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor en puerto ${PORT}`);
});
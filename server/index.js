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
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Almacén temporal de rooms (hostId por roomId)
const rooms = {}; // { roomId: { hostId: socket.id } }

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.role = role;
    socket.roomId = roomId;

    if (role === 'host') {
      rooms[roomId] = { hostId: socket.id };
      console.log(`HOST ${socket.id} creó sala ${roomId}`);
    } else if (role === 'guest') {
      console.log(`GUEST ${socket.id} se unió a sala ${roomId} (host: ${rooms[roomId]?.hostId || 'NO HOST'})`);
    }
  });

  // Guest envía oferta → solo al HOST
  socket.on('call-offer', ({ offer, roomId }) => {
    const hostId = rooms[roomId]?.hostId;
    if (hostId) {
      io.to(hostId).emit('incoming-call', { offer, from: socket.id });
      console.log(`Oferta enviada de ${socket.id} a HOST ${hostId} en sala ${roomId}`);
    } else {
      console.log(`ERROR: No hay host en sala ${roomId}`);
      socket.emit('error', { message: 'No hay host disponible en la sala' });
    }
  });

  // Host acepta → envía answer al GUEST específico
  socket.on('accept-call', ({ answer, to }) => {
    io.to(to).emit('call-accepted', { answer });
    console.log(`Host ${socket.id} aceptó, answer enviado a guest ${to}`);
  });

  // ICE candidates: envía al peer específico (NO al room)
  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('new-ice-candidate', candidate);
    console.log(`ICE candidate de ${socket.id} a ${to}`);
  });

  socket.on('end-call', ({ roomId }) => {
    io.to(roomId).emit('call-ended');
    console.log(`Llamada terminada en sala ${roomId}`);
    delete rooms[roomId]; // Limpia room
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    if (socket.role === 'host' && socket.roomId && rooms[socket.roomId]) {
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
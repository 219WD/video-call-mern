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

// Configurar Socket.IO con CORS abierto (producción)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// === SOCKET.IO: FLUJO DE VIDEOLLAMADA ===
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Unirse a la sala con rol: 'host' o 'guest'
  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.role = role;
    socket.roomId = roomId;
    console.log(`${role.toUpperCase()} ${socket.id} se unió a la sala ${roomId}`);
  });

  // Guest envía oferta al room → llega solo al host
  socket.on('call-offer', ({ offer, roomId }) => {
    console.log(`Oferta recibida de guest en sala ${roomId}`);
    socket.to(roomId).emit('incoming-call', { offer, from: socket.id });
  });

  // Host acepta la llamada → envía answer al guest
  socket.on('accept-call', ({ answer, to }) => {
    console.log(`Host aceptó la llamada, enviando answer a ${to}`);
    io.to(to).emit('call-accepted', { answer });
  });

  // Intercambio de ICE candidates (ambos lados)
  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('new-ice-candidate', candidate);
  });

  // Finalizar llamada
  socket.on('end-call', ({ roomId }) => {
    console.log(`Llamada terminada en sala ${roomId}`);
    io.to(roomId).emit('call-ended');
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    if (socket.roomId) {
      io.to(socket.roomId).emit('call-ended');
    }
  });
});

// Puerto dinámico (Render, Vercel, local)
const PORT = process.env.PORT || 5000;
server.listen(PORT, ' lot 0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`→ Accede desde cualquier dispositivo: https://video-call-219labs.onrender.com`);
});
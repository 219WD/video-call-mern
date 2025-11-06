const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth'); // Ver más abajo

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Usuario ${socket.id} joined room ${roomId}`);
  });

  socket.on('call-offer', ({ offer, roomId }) => {
    io.to(roomId).emit('incoming-call', { offer, from: socket.id });
  });

  socket.on('call-answer', ({ answer, to }) => {
    io.to(to).emit('call-accepted', { answer });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('new-ice-candidate', candidate);
  });

  socket.on('end-call', ({ roomId }) => {
    io.to(roomId).emit('call-ended');
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
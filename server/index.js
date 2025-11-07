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

// ==================== CORS DINÁMICO ====================
const allowedOrigins = [
  'https://qrdoor.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.includes('localhost') ||
      origin.includes('vercel.app') ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    console.warn(`CORS bloqueado desde: ${origin}`);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ==================== MIDDLEWARES ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/qr', qrRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ==================== 404 CORREGIDO (ESTE ERA EL ERROR!) ====================
// ANTES: app.use('*', ...) → explotaba en Node 22
// AHORA: middleware función normal
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ==================== SOCKET.IO ====================
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || 
          origin.includes('localhost') || 
          origin.includes('vercel.app') || 
          allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS Socket.io bloqueado'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

// ==================== MONGO DB ====================
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI no definido');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error MongoDB:', err.message);
    process.exit(1);
  });

// ==================== ROOMS & SOCKETS ====================
const rooms = {};

io.on('connection', (socket) => {
  console.log('NUEVA CONEXIÓN:', socket.id);

  socket.on('join-room', async ({ roomId, role, userData = {} }) => {
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
        console.log(`HOST → ${roomId}`);
      } else if (role === 'guest') {
        if (!rooms[roomId]) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }
        rooms[roomId].guestId = socket.id;
        rooms[roomId].guestData = userData;
        rooms[roomId].status = 'ringing';

        io.to(rooms[roomId].hostId).emit('ring', {
          guest: userData,
          timestamp: new Date(),
          roomId
        });
      }
    } catch (err) {
      console.error('Error join-room:', err);
    }
  });

  socket.on('call-offer', ({ offer }) => {
    const room = rooms[socket.roomId];
    if (room?.hostId) {
      io.to(room.hostId).emit('offer', { offer, from: socket.id, guest: room.guestData });
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
    if (room?.guestId) {
      room.status = 'connected';
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: room.guestData,
        type: 'video_call',
        status: 'accepted',
        timestamp: new Date()
      }).catch(console.error);
      io.to(room.guestId).emit('call-accepted');
    }
  });

  socket.on('reject-call', async () => {
    const room = rooms[socket.roomId];
    if (room?.guestId) {
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: room.guestData,
        type: 'video_call',
        status: 'rejected',
        timestamp: new Date()
      }).catch(console.error);
      io.to(room.guestId).emit('call-rejected');
      delete rooms[socket.roomId];
    }
  });

  socket.on('leave-message', async ({ name, message }) => {
    const room = rooms[socket.roomId];
    if (room) {
      const Visit = require('./models/Visit');
      await Visit.create({
        qrCode: socket.roomId,
        guest: { name: name || 'Anónimo', email: socket.userData?.email },
        type: 'message',
        message: message.trim(),
        status: 'message_left',
        timestamp: new Date()
      }).catch(console.error);

      if (room.hostId) {
        io.to(room.hostId).emit('new-message', {
          name: name || 'Anónimo',
          message: message.trim(),
          timestamp: new Date()
        });
      }
    }
  });

  socket.on('toggle-camera', ({ enabled }) => {
    const room = rooms[socket.roomId];
    if (room) {
      const target = socket.role === 'host' ? room.guestId : room.hostId;
      if (target) io.to(target).emit('camera-toggled', { enabled });
    }
  });

  socket.on('end-call', () => {
    const room = rooms[socket.roomId];
    if (room) {
      if (room.hostId) io.to(room.hostId).emit('call-ended');
      if (room.guestId) io.to(room.guestId).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });

  socket.on('disconnect', () => {
    const room = Object.values(rooms).find(r => r.hostId === socket.id || r.guestId === socket.id);
    if (room) {
      const other = socket.id === room.hostId ? room.guestId : room.hostId;
      if (other) io.to(other).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });
});

// Limpieza de salas huérfanas
setInterval(() => {
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    if (!room.hostId || !io.sockets.sockets.get(room.hostId)) {
      delete rooms[roomId];
    }
  });
}, 600000);

// ==================== INICIO ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVIDOR QR DOOR ARRANCADO EN PUERTO ${PORT}`);
  console.log(`URL: ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}`);
});
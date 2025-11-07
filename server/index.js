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

// ==================== CORS DINÁMICO (PRODUCCIÓN + VERCEL) ====================
const allowedOrigins = [
  'https://qrdoor.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

// CORS que permite TODAS las URLs de Vercel (preview y main)
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-ID']
}));

// ==================== MIDDLEWARES ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/qr', qrRoutes);

// Health check → ¡CORREGIDO! Ya no hay "09"
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// 404 global
app.use('*', (req, res) => {
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
  maxHttpBufferSize: 1e8 // 100MB para WebRTC
});

// ==================== MONGO DB ====================
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI no está definido en .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

// ==================== SALAS Y SOCKETS ====================
const rooms = {};

io.on('connection', (socket) => {
  console.log('NUEVA CONEXIÓN:', socket.id);

  socket.on('join-room', async ({ roomId, role, userData }) => {
    try {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = role;
      socket.userData = userData || {};

      if (role === 'host') {
        rooms[roomId] = {
          hostId: socket.id,
          status: 'waiting',
          hostData: userData || { name: 'Anónimo' }
        };
        console.log(`HOST unido a sala ${roomId} → ${socket.id}`);
      } else if (role === 'guest') {
        if (!rooms[roomId]) {
          socket.emit('error', { message: 'Sala no encontrada o expirada' });
          return;
        }

        rooms[roomId].guestId = socket.id;
        rooms[roomId].guestData = userData || { name: 'Visitante' };
        rooms[roomId].status = 'ringing';

        console.log(`GUEST ${socket.id} llama a HOST ${rooms[roomId].hostId}`);

        io.to(rooms[roomId].hostId).emit('ring', {
          guest: rooms[roomId].guestData,
          timestamp: new Date(),
          roomId
        });
      }
    } catch (error) {
      console.error('Error en join-room:', error);
      socket.emit('error', { message: 'Error interno del servidor' });
    }
  });

  socket.on('call-offer', ({ offer }) => {
    const room = rooms[socket.roomId];
    if (room?.hostId) {
      console.log(`OFERTA → HOST ${room.hostId}`);
      io.to(room.hostId).emit('offer', {
        offer,
        from: socket.id,
        guest: room.guestData
      });
    }
  });

  socket.on('answer', ({ answer, to }) => {
    console.log(`ANSWER → GUEST ${to}`);
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
      try {
        await Visit.create({
          qrCode: socket.roomId,
          guest: room.guestData,
          type: 'video_call',
          status: 'accepted',
          timestamp: new Date()
        });
        console.log(`Llamada ACEPTADA en sala ${socket.roomId}`);
        io.to(room.guestId).emit('call-accepted');
      } catch (err) {
        console.error('Error registrando visita aceptada:', err);
      }
    }
  });

  socket.on('reject-call', async () => {
    const room = rooms[socket.roomId];
    if (room?.guestId) {
      const Visit = require('./models/Visit');
      try {
        await Visit.create({
          qrCode: socket.roomId,
          guest: room.guestData,
          type: 'video_call',
          status: 'rejected',
          timestamp: new Date()
        });
        console.log(`Llamada RECHAZADA en sala ${socket.roomId}`);
        io.to(room.guestId).emit('call-rejected');
      } catch (err) {
        console.error('Error registrando rechazo:', err);
      } finally {
        delete rooms[socket.roomId];
      }
    }
  });

  socket.on('leave-message', async ({ name, message }) => {
    const room = rooms[socket.roomId];
    if (room) {
      const Visit = require('./models/Visit');
      try {
        await Visit.create({
          qrCode: socket.roomId,
          guest: { name: name || 'Anónimo', email: socket.userData?.email },
          type: 'message',
          message: message.trim(),
          status: 'message_left',
          timestamp: new Date()
        });
        console.log(`Mensaje dejado en sala ${socket.roomId} por ${name}`);

        if (room.hostId) {
          io.to(room.hostId).emit('new-message', {
            name: name || 'Anónimo',
            message: message.trim(),
            timestamp: new Date()
          });
        }
      } catch (err) {
        console.error('Error guardando mensaje:', err);
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

  socket.on('end-call', () => {
    const room = rooms[socket.roomId];
    if (room) {
      console.log(`Llamada TERMINADA en sala ${socket.roomId}`);
      if (room.hostId) io.to(room.hostId).emit('call-ended');
      if (room.guestId) io.to(room.guestId).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('DESCONECTADO:', socket.id, 'Razón:', reason);
    const room = Object.values(rooms).find(r => 
      r.hostId === socket.id || r.guestId === socket.id
    );

    if (room) {
      const other = socket.id === room.hostId ? room.guestId : room.hostId;
      if (other) io.to(other).emit('call-ended');
      delete rooms[socket.roomId];
      console.log(`Sala ${socket.roomId} eliminada por desconexión`);
    }
  });
});

// ==================== LIMPIEZA PERIÓDICA DE SALAS HUÉRFANAS ====================
setInterval(() => {
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    if (!room.hostId || !io.sockets.sockets.get(room.hostId)) {
      delete rooms[roomId];
      console.log(`Sala huérfana eliminada: ${roomId}`);
    }
  });
}, 600000); // Cada 10 minutos

// ==================== INICIO DEL SERVIDOR ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor QR Door ejecutándose en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS habilitado para Vercel + localhost`);
  console.log(`URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
});
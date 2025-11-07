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

// Configuración CORS mejorada
const allowedOrigins = [
  'https://qrdoor.vercel.app',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS bloqueado para origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Middleware para log de requests (opcional, para debug)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Manejar preflight requests explícitamente
app.options('*', cors(corsOptions));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/qr', qrRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Configuración Socket.io con CORS específico
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
    transports: ['websocket', 'polling']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Almacén mejorado de salas
const rooms = {};

io.on('connection', (socket) => {
  console.log('🟢 NUEVA CONEXIÓN:', socket.id);

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
        console.log(`🏠 HOST unido a sala ${roomId} → ${socket.id}`);
      } else if (role === 'guest') {
        if (!rooms[roomId]) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }
        
        rooms[roomId].guestId = socket.id;
        rooms[roomId].guestData = userData;
        rooms[roomId].status = 'ringing';
        
        console.log(`🔔 GUEST ${socket.id} llama a HOST ${rooms[roomId].hostId}`);
        
        // Notificación push mejorada al host
        io.to(rooms[roomId].hostId).emit('ring', {
          guest: userData,
          timestamp: new Date(),
          roomId: roomId
        });
      }
    } catch (error) {
      console.error('❌ Error en join-room:', error);
    }
  });

  socket.on('call-offer', ({ offer }) => {
    const room = rooms[socket.roomId];
    if (room && room.hostId) {
      console.log(`📞 OFERTA enviada a HOST ${room.hostId}`);
      io.to(room.hostId).emit('offer', { 
        offer, 
        from: socket.id,
        guest: room.guestData 
      });
    }
  });

  socket.on('answer', ({ answer, to }) => {
    console.log(`📨 ANSWER enviada a GUEST ${to}`);
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

      console.log(`✅ Llamada ACEPTADA en sala ${socket.roomId}`);
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

      console.log(`❌ Llamada RECHAZADA en sala ${socket.roomId}`);
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

      console.log(`💬 Mensaje dejado en sala ${socket.roomId} por ${name}`);
      
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
      console.log(`📞 Llamada TERMINADA en sala ${socket.roomId}`);
      io.to(room.hostId).emit('call-ended');
      if (room.guestId) io.to(room.guestId).emit('call-ended');
      delete rooms[socket.roomId];
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔴 DESCONECTADO:', socket.id, 'Razón:', reason);
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
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS habilitado para: ${allowedOrigins.join(', ')}`);
});
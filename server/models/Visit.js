const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema({
  qrCode: { type: String, required: true },
  guest: {
    name: String,
    email: String,
    picture: String
  },
  type: { type: String, enum: ['video_call', 'message'], required: true },
  status: { type: String, enum: ['accepted', 'rejected', 'message_left'], required: true },
  message: String,
  timestamp: { type: Date, default: Date.now },
  duration: Number // duración en segundos para videollamadas
});

module.exports = mongoose.model('Visit', VisitSchema);
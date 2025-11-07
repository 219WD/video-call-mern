const express = require('express');
const Visit = require('../models/Visit');
const QRCode = require('../models/QRCode');
const auth = require('../middleware/auth');
const router = express.Router();

// Obtener historial de visitas
router.get('/history', auth, async (req, res) => {
  try {
    const qr = await QRCode.findOne({ owner: req.userId });
    if (!qr) return res.status(404).json({ error: 'QR no encontrado' });

    const visits = await Visit.find({ qrCode: qr.code }).sort({ timestamp: -1 });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas de visitas
router.get('/stats', auth, async (req, res) => {
  try {
    const qr = await QRCode.findOne({ owner: req.userId });
    if (!qr) return res.status(404).json({ error: 'QR no encontrado' });

    const totalVisits = await Visit.countDocuments({ qrCode: qr.code });
    const todayVisits = await Visit.countDocuments({
      qrCode: qr.code,
      timestamp: { $gte: new Date().setHours(0,0,0,0) }
    });
    const messages = await Visit.countDocuments({ 
      qrCode: qr.code, 
      type: 'message' 
    });

    res.json({ totalVisits, todayVisits, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
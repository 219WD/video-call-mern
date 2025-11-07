const express = require('express');
const QRCode = require('../models/QRCode');
const auth = require('../middleware/auth');
const router = express.Router();

// Generar QR único permanente
router.post('/generate', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const code = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const qr = new QRCode({
      code,
      owner: req.userId,
      title
    });
    
    await qr.save();
    res.json({ qrCode: code, url: `${process.env.CLIENT_URL}/join/${code}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener QR del usuario
router.get('/my-qr', auth, async (req, res) => {
  try {
    const qr = await QRCode.findOne({ owner: req.userId });
    res.json(qr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
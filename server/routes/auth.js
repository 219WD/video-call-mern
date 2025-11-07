const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Login con Google
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const { sub, email, name, picture } = ticket.getPayload();
    
    let user = await User.findOne({ 
      $or: [{ googleId: sub }, { email }] 
    });
    
    if (!user) {
      user = new User({
        googleId: sub,
        email,
        name,
        picture,
        role: 'guest'
      });
      await user.save();
    }
    
    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '30d' 
    });
    
    res.json({ 
      token: jwtToken, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        picture: user.picture,
        role: user.role 
      } 
    });
  } catch (error) {
    res.status(400).json({ error: 'Token de Google inválido' });
  }
});

// Registro tradicional (opcional)
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const user = new User({ username, password, email, role: 'host' });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '30d' 
    });
    
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      } 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
    expiresIn: '30d' 
  });
  
  res.json({ 
    token, 
    user: { 
      id: user._id, 
      username: user.username, 
      email: user.email,
      role: user.role 
    } 
  });
});

module.exports = router;
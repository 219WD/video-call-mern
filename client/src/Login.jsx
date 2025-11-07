// Login.jsx (VERSIÓN 2025 - FUNCIONA PERFECTAMENTE)
import React, { useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from './services/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      console.log('✅ Token recibido de Google (GIS)');
      const token = response.credential;

      const res = await api.post('/auth/google', { token });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (error) {
      console.error('❌ Error con backend:', error.response?.data || error);
      alert('Error al conectar con el servidor. Usa modo demo.');
    }
  }, [login, navigate]);

  useEffect(() => {
    // Cargar Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('googleButtonDiv'),
        { 
          theme: 'outline', 
          size: 'large',
          text: 'continue_with',
          width: 300
        }
      );

      // Opcional: prompt automático (solo primera vez)
      // window.google.accounts.id.prompt();
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [handleCredentialResponse]);

  const handleDemoLogin = () => {
    const mockUser = {
      id: 'demo-' + Date.now(),
      name: 'Usuario Demo',
      email: 'demo@qrdoor.com',
      picture: 'https://ui-avatars.com/api/?name=Demo&background=667eea&color=fff',
      role: 'host'
    };
    login('demo-token-' + Date.now(), mockUser);
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <h1 style={styles.title}>QR Door</h1>
        <p style={styles.subtitle}>Videollamadas seguras por QR</p>

        <div style={{ margin: '30px 0' }}>
          <div id="googleButtonDiv"></div>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>o</span>
        </div>

        <button onClick={handleDemoLogin} style={styles.demoButton}>
          🚀 Modo Demo (sin Google)
        </button>

        <div style={styles.features}>
          <ul style={styles.featuresList}>
            <li>QR permanente único</li>
            <li>Videollamadas WebRTC P2P</li>
            <li>Historial y estadísticas</li>
            <li>Funciona en Vercel + Railway/Render</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: '40px 30px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    maxWidth: 400,
    width: '100%',
    textAlign: 'center'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 10px 0'
  },
  subtitle: { color: '#666', margin: '0 0 20px' },
  divider: { position: 'relative', margin: '30px 0' },
  dividerText: { background: 'white', padding: '0 15px', color: '#666' },
  demoButton: {
    width: '100%',
    padding: '15px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  features: { marginTop: 30, textAlign: 'left' },
  featuresList: { paddingLeft: 20, color: '#555' }
};

export default Login;
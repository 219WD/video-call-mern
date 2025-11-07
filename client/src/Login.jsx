import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from './services/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      console.log('🔐 Iniciando login con Google...');
      
      // Cargar SDK de Google
      await loadGoogleSDK();
      
      const auth2 = window.gapi.auth2.getAuthInstance();
      const googleUser = await auth2.signIn();
      const token = googleUser.getAuthResponse().id_token;
      
      console.log('✅ Token de Google obtenido');
      
      // Enviar token al backend
      const response = await api.post('/auth/google', { token });
      console.log('✅ Respuesta del backend recibida');
      
      login(response.data.token, response.data.user);
      navigate('/');
      
    } catch (error) {
      console.error('❌ Error en login Google:', error);
      alert('Error al iniciar sesión con Google. Usa el modo demo.');
    }
  };

  const loadGoogleSDK = () => {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        console.log('✅ Google SDK ya cargado');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/platform.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Google SDK cargado');
        window.gapi.load('auth2', () => {
          try {
            window.gapi.auth2.init({
              client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
              scope: 'email profile'
            });
            console.log('✅ Google Auth inicializado');
            resolve();
          } catch (error) {
            console.error('❌ Error inicializando Google Auth:', error);
            reject(error);
          }
        });
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleDemoLogin = () => {
    console.log('🎮 Iniciando modo demo...');
    const mockUser = {
      id: 'user-' + Date.now(),
      name: 'Usuario Demo',
      email: 'demo@ejemplo.com',
      picture: '',
      role: 'host'
    };
    
    login('demo-token-' + Date.now(), mockUser);
    setTimeout(() => navigate('/'), 100);
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <div style={styles.header}>
          <h1 style={styles.title}>Bienvenido a QR Door</h1>
          <p style={styles.subtitle}>Sistema de videollamadas por QR</p>
        </div>

        <div style={styles.loginOptions}>
          <button 
            onClick={handleGoogleLogin}
            style={styles.googleButton}
          >
            <div style={styles.googleButtonContent}>
              <svg style={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span style={styles.googleText}>Continuar con Google</span>
            </div>
          </button>

          <div style={styles.divider}>
            <span style={styles.dividerText}>o</span>
          </div>

          <button 
            onClick={handleDemoLogin}
            style={styles.demoButton}
          >
            🚀 Modo Demo (Sin Google)
          </button>
        </div>

        <div style={styles.features}>
          <h3 style={styles.featuresTitle}>Funcionalidades:</h3>
          <ul style={styles.featuresList}>
            <li style={styles.featureItem}>🎯 QR único permanente</li>
            <li style={styles.featureItem}>📞 Videollamadas en tiempo real</li>
            <li style={styles.featureItem}>📊 Historial de visitas</li>
            <li style={styles.featureItem}>💬 Sistema de mensajes</li>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loginCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: 20,
    padding: '40px 30px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
    maxWidth: 400,
    width: '100%',
    textAlign: 'center'
  },
  header: {
    marginBottom: 30
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 10px 0'
  },
  subtitle: {
    color: '#666',
    fontSize: '1.1rem',
    margin: 0
  },
  loginOptions: {
    marginBottom: 30
  },
  googleButton: {
    width: '100%',
    padding: '15px 20px',
    background: 'white',
    border: '2px solid #f1f1f1',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: 15,
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
  },
  googleButtonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  googleIcon: {
    width: 20,
    height: 20
  },
  googleText: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#333'
  },
  divider: {
    position: 'relative',
    margin: '20px 0',
    textAlign: 'center'
  },
  dividerText: {
    background: 'white',
    padding: '0 15px',
    color: '#666',
    fontSize: '0.9rem'
  },
  demoButton: {
    width: '100%',
    padding: '15px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 'bold',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
  },
  features: {
    borderTop: '1px solid #f0f0f0',
    paddingTop: 25
  },
  featuresTitle: {
    fontSize: '1.2rem',
    color: '#333',
    margin: '0 0 15px 0'
  },
  featuresList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    textAlign: 'left'
  },
  featureItem: {
    padding: '8px 0',
    color: '#555',
    fontSize: '0.95rem'
  }
};

export default Login;
import React from 'react';
import { useAuth } from './contexts/AuthContext';
import api from './services/api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      // Cargar SDK de Google
      await loadGoogleSDK();
      
      const auth2 = window.gapi.auth2.getAuthInstance();
      const googleUser = await auth2.signIn();
      const token = googleUser.getAuthResponse().id_token;
      
      // Enviar token al backend
      const response = await api.post('/auth/google', { token });
      login(response.data.token, response.data.user);
      navigate('/'); // Redirigir al dashboard después del login
    } catch (error) {
      console.error('Error en login Google:', error);
      alert('Error al iniciar sesión con Google. Por favor, intenta de nuevo.');
    }
  };

  const loadGoogleSDK = () => {
    return new Promise((resolve) => {
      if (window.gapi) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/platform.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.gapi.load('auth2', () => {
          window.gapi.auth2.init({
            client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
            scope: 'email profile'
          });
          resolve();
        });
      };
      document.head.appendChild(script);
    });
  };

  // Versión de respaldo si el SDK falla
  const handleGoogleLoginFallback = async () => {
    try {
      // Implementación simple sin SDK (para desarrollo)
      const response = await api.post('/auth/google', {
        token: 'dev-token-' + Date.now()
      });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (error) {
      console.error('Error en login de desarrollo:', error);
      alert('Modo desarrollo: Login simulado exitoso');
      // Simular login exitoso para desarrollo
      login('dev-token', {
        id: '1',
        name: 'Usuario Demo',
        email: 'demo@ejemplo.com',
        picture: '',
        role: 'host'
      });
      navigate('/');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <div style={styles.header}>
          <h1 style={styles.title}>Bienvenido</h1>
          <p style={styles.subtitle}>Inicia sesión para gestionar tus visitas</p>
        </div>

        <div style={styles.loginOptions}>
          <button 
            onClick={handleGoogleLogin}
            style={styles.googleButton}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
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

          <button 
            onClick={handleGoogleLoginFallback}
            style={styles.demoButton}
          >
            Modo Desarrollo (Sin Google)
          </button>
        </div>

        <div style={styles.features}>
          <h3 style={styles.featuresTitle}>¿Qué puedes hacer?</h3>
          <ul style={styles.featuresList}>
            <li style={styles.featureItem}>🎯 Generar tu QR personal único</li>
            <li style={styles.featureItem}>📞 Recibir videollamadas de visitantes</li>
            <li style={styles.featureItem}>📊 Ver historial de visitas</li>
            <li style={styles.featureItem}>💬 Recibir mensajes cuando no estés</li>
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
    fontSize: '2.5rem',
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
  demoButton: {
    width: '100%',
    padding: '12px 20px',
    background: 'transparent',
    border: '2px solid #667eea',
    borderRadius: 12,
    cursor: 'pointer',
    color: '#667eea',
    fontSize: '0.9rem',
    transition: 'all 0.3s ease'
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
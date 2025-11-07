import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import api from './services/api';

const GuestPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    // Si ya está autenticado, usar sus datos
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleCall = () => {
    if (!user) {
      alert('Por favor inicia sesión primero');
      return;
    }
    navigate(`/call/${roomId}`);
  };

  const handleLeaveMessage = async () => {
    if (!name.trim() || !message.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      await api.post('/socket/leave-message', {
        roomId,
        name: name.trim(),
        message: message.trim()
      });
      
      alert('Mensaje enviado correctamente');
      setMessage('');
      setShowMessageForm(false);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      alert('Error enviando mensaje');
    }
  };

// Reemplaza la función handleGoogleLogin con:
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
  } catch (error) {
    console.error('Error en login Google:', error);
    alert('Error al iniciar sesión con Google');
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
    script.onload = () => {
      window.gapi.load('auth2', () => {
        window.gapi.auth2.init({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID, // Client ID del frontend
          scope: 'email profile'
        });
        resolve();
      });
    };
    document.head.appendChild(script);
  });
};

  const mockGoogleLogin = () => {
    return new Promise((resolve) => {
      // Simular login de Google
      resolve({
        token: 'mock-google-token',
        user: {
          name: 'Usuario Google',
          email: 'usuario@google.com'
        }
      });
    });
  };

  return (
    <div style={s.container}>
      {!user ? (
        <div style={s.loginSection}>
          <h2>Iniciar Sesión</h2>
          <p>Para tocar el timbre, inicia sesión con Google</p>
          <button onClick={handleGoogleLogin} style={s.googleButton}>
            <img src="/google-icon.png" alt="Google" style={s.googleIcon} />
            Iniciar con Google
          </button>
        </div>
      ) : (
        <>
          <div style={s.userInfo}>
            <img src={user.picture} alt={user.name} style={s.avatar} />
            <p>Hola, {user.name}</p>
          </div>

          <button onClick={handleCall} style={s.callButton}>
            🔔 TOCAR TIMBRE
          </button>

          <p style={s.info}>Sala: {roomId}</p>

          {!showMessageForm ? (
            <button 
              onClick={() => setShowMessageForm(true)}
              style={s.messageButton}
            >
              Dejar Mensaje
            </button>
          ) : (
            <div style={s.messageForm}>
              <h3>Dejar Mensaje</h3>
              <input
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={s.input}
              />
              <textarea
                placeholder="Escribe tu mensaje..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={s.textarea}
                rows="4"
              />
              <div style={s.formActions}>
                <button onClick={handleLeaveMessage} style={s.submitButton}>
                  Enviar Mensaje
                </button>
                <button 
                  onClick={() => setShowMessageForm(false)}
                  style={s.cancelButton}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const s = {
  container: { 
    height: '100vh', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: 20
  },
  loginSection: {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.1)',
    padding: 40,
    borderRadius: 20,
    backdropFilter: 'blur(10px)'
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '15px 30px',
    background: 'white',
    color: '#333',
    border: 'none',
    borderRadius: 50,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 20
  },
  googleIcon: {
    width: 20,
    height: 20
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%'
  },
  callButton: {
    background: '#28a745',
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    padding: '30px 60px',
    border: 'none',
    borderRadius: 50,
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    margin: '20px 0'
  },
  info: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.8
  },
  messageButton: {
    background: 'transparent',
    color: 'white',
    border: '2px solid white',
    padding: '10px 20px',
    borderRadius: 25,
    cursor: 'pointer',
    marginTop: 10
  },
  messageForm: {
    background: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    width: '100%',
    maxWidth: 400,
    backdropFilter: 'blur(10px)'
  },
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    border: 'none'
  },
  textarea: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    border: 'none',
    resize: 'vertical'
  },
  formActions: {
    display: 'flex',
    gap: 10
  },
  submitButton: {
    flex: 1,
    background: '#28a745',
    color: 'white',
    border: 'none',
    padding: 10,
    borderRadius: 8,
    cursor: 'pointer'
  },
  cancelButton: {
    flex: 1,
    background: 'transparent',
    color: 'white',
    border: '1px solid white',
    padding: 10,
    borderRadius: 8,
    cursor: 'pointer'
  }
};

export default GuestPage;
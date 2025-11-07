import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuth } from './contexts/AuthContext';

const SOCKET_SERVER = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const socket = io(SOCKET_SERVER, { transports: ['websocket'] });

const HostRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [ringing, setRinging] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const localStream = useRef(null);

  useEffect(() => {
    // Inicializar con cámara apagada
    initializeCamera(false);

    socket.emit('join-room', { 
      roomId, 
      role: 'host',
      userData: user
    });

    socket.on('ring', (data) => {
      setRinging(true);
      setCurrentCall(data);
      
      // Sonido de timbre con vibración
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-tone-1057.mp3');
      audio.loop = true;
      audio.play().catch(() => {});
      window.ringAudio = audio;

      // Vibrar si está soportado
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    });

    socket.on('offer', async ({ offer, from, guest }) => {
      await handleOffer(offer, from, guest);
    });

    socket.on('ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', endCall);

    return () => {
      if (window.ringAudio) window.ringAudio.pause();
      socket.off();
    };
  }, [roomId, user]);

  const initializeCamera = async (enabled = false) => {
    try {
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: enabled, 
        audio: true 
      });
      
      localStream.current = stream;
      localVideo.current.srcObject = stream;

      // Si la cámara está deshabilitada, apagar video tracks
      if (!enabled) {
        stream.getVideoTracks().forEach(track => track.enabled = false);
      }
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
    }
  };

  const handleOffer = async (offer, from, guest) => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);
    
    // Solo agregar audio si la cámara está apagada
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        if (track.kind === 'audio' || (track.kind === 'video' && cameraEnabled)) {
          pc.current.addTrack(track, localStream.current);
        }
      });
    }

    pc.current.ontrack = e => remoteVideo.current.srcObject = e.streams[0];
    pc.current.onicecandidate = e => e.candidate && socket.emit('ice-candidate', { candidate: e.candidate, to: from });

    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    socket.emit('answer', { answer, to: from });
  };

  const toggleCamera = async () => {
    const newState = !cameraEnabled;
    setCameraEnabled(newState);

    if (localStream.current) {
      const videoTracks = localStream.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = newState;
      });

      // Notificar al guest del cambio
      if (pc.current && callActive) {
        socket.emit('toggle-camera', { enabled: newState });
      }
    }

    // Si se activa la cámara y no hay stream, inicializar
    if (newState && !localStream.current) {
      await initializeCamera(true);
    }
  };

  const acceptCall = () => {
    socket.emit('accept-call');
    setRinging(false);
    setCallActive(true);
    if (window.ringAudio) window.ringAudio.pause();
  };

  const rejectCall = () => {
    socket.emit('reject-call');
    setRinging(false);
    setCurrentCall(null);
    if (window.ringAudio) window.ringAudio.pause();
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call');
    setCallActive(false);
    setCurrentCall(null);
    setCameraEnabled(false);
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Sala: {roomId}</h2>
        <p>Esperando visitas...</p>
      </div>

      <div style={styles.videoContainer}>
        {/* Video local (host) - Solo se muestra si la cámara está activa */}
        <div style={styles.localVideo}>
          {cameraEnabled ? (
            <video 
              ref={localVideo} 
              autoPlay 
              muted 
              playsInline 
              style={styles.video}
            />
          ) : (
            <div style={styles.cameraOff}>
              <p>Cámara apagada</p>
            </div>
          )}
          <div style={styles.videoLabel}>Tú</div>
        </div>

        {/* Video remoto (guest) */}
        <div style={styles.remoteVideo}>
          <video 
            ref={remoteVideo} 
            autoPlay 
            playsInline 
            style={styles.video}
          />
          <div style={styles.videoLabel}>Visitante</div>
        </div>
      </div>

      {/* Notificación de llamada entrante */}
      {ringing && currentCall && (
        <div style={styles.ringingOverlay}>
          <div style={styles.ringingModal}>
            <h3 style={styles.ringingTitle}>🔔 LLAMADA ENTRANTE</h3>
            <p style={styles.callerInfo}>
              {currentCall.guest?.name || 'Visitante'} está llamando
            </p>
            <div style={styles.ringingButtons}>
              <button 
                onClick={acceptCall} 
                style={styles.acceptButton}
              >
                ✅ ACEPTAR
              </button>
              <button 
                onClick={rejectCall} 
                style={styles.rejectButton}
              >
                ❌ RECHAZAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controles durante la llamada activa */}
      {callActive && (
        <div style={styles.controls}>
          <button 
            onClick={toggleCamera}
            style={{
              ...styles.controlButton,
              ...(cameraEnabled ? styles.buttonOn : styles.buttonOff)
            }}
          >
            {cameraEnabled ? '📹 Cámara ON' : '📷 Cámara OFF'}
          </button>
          <button 
            onClick={endCall}
            style={{...styles.controlButton, ...styles.endCallButton}}
          >
            📞 Colgar
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { 
    minHeight: '100vh', 
    background: '#1a1a1a', 
    color: 'white',
    padding: 20 
  },
  header: { 
    textAlign: 'center', 
    marginBottom: 30 
  },
  videoContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
    maxWidth: 1200,
    margin: '0 auto'
  },
  localVideo: {
    position: 'relative',
    background: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden'
  },
  remoteVideo: {
    position: 'relative',
    background: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden'
  },
  video: {
    width: '100%',
    height: 300,
    objectFit: 'cover'
  },
  cameraOff: {
    width: '100%',
    height: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#333',
    color: '#666'
  },
  videoLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(0,0,0,0.7)',
    padding: '5px 10px',
    borderRadius: 8,
    fontSize: 12
  },
  ringingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  ringingModal: {
    background: 'white',
    color: '#333',
    padding: 40,
    borderRadius: 20,
    textAlign: 'center',
    maxWidth: 400,
    width: '90%'
  },
  ringingTitle: {
    fontSize: 24,
    marginBottom: 10,
    color: '#007bff'
  },
  callerInfo: {
    fontSize: 18,
    marginBottom: 30
  },
  ringingButtons: {
    display: 'flex',
    gap: 20,
    justifyContent: 'center'
  },
  acceptButton: {
    background: '#28a745',
    color: 'white',
    padding: '15px 25px',
    border: 'none',
    borderRadius: 50,
    fontSize: 16,
    cursor: 'pointer',
    flex: 1
  },
  rejectButton: {
    background: '#dc3545',
    color: 'white',
    padding: '15px 25px',
    border: 'none',
    borderRadius: 50,
    fontSize: 16,
    cursor: 'pointer',
    flex: 1
  },
  controls: {
    position: 'fixed',
    bottom: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 20,
    background: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 50
  },
  controlButton: {
    padding: '15px 25px',
    border: 'none',
    borderRadius: 25,
    fontSize: 16,
    cursor: 'pointer',
    color: 'white'
  },
  buttonOn: {
    background: '#28a745'
  },
  buttonOff: {
    background: '#6c757d'
  },
  endCallButton: {
    background: '#dc3545'
  }
};

export default HostRoom;
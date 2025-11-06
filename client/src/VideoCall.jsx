import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const SOCKET_SERVER = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const socket = io(SOCKET_SERVER);

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        setupWebRTC(stream);
      })
      .catch(err => {
        alert('No se pudo acceder a la cámara/micrófono: ' + err.message);
      });

    socket.emit('join-room', roomId);

    socket.on('call-accepted', async ({ answer }) => {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCalling(false);
    });

    socket.on('new-ice-candidate', async (candidate) => {
      try {
        await pc.current.addIceCandidate(candidate);
      } catch (e) { }
    });

    socket.on('call-ended', () => endCall());

    return () => {
      socket.off();
      endCall();
    };
  }, [roomId]);

  const setupWebRTC = (stream) => {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(configuration);

    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    pc.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, to: roomId });
      }
    };

    // El guest inicia la llamada
    initiateCall();
  };

  const initiateCall = async () => {
    setCalling(true);
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit('call-offer', { offer, roomId });
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localVideo.current?.srcObject) {
      localVideo.current.srcObject.getTracks().forEach(t => t.stop());
    }
    socket.emit('end-call', { roomId });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <h2>Sala: {roomId}</h2>
      <div style={styles.videoContainer}>
        <video ref={localVideo} autoPlay muted playsInline style={styles.localVideo} />
        <video ref={remoteVideo} autoPlay playsInline style={styles.remoteVideo} />
      </div>
      {calling && <p style={styles.calling}>Llamando...</p>}
      <button onClick={endCall} style={styles.endButton}>Colgar</button>
    </div>
  );
};

const styles = {
  container: { textAlign: 'center', padding: '20px' },
  videoContainer: { display: 'flex', justifyContent: 'center', gap: '10px', margin: '20px 0' },
  localVideo: { width: '300px', border: '2px solid #007bff', borderRadius: '8px' },
  remoteVideo: { width: '300px', border: '2px solid #28a745', borderRadius: '8px' },
  calling: { color: '#007bff', fontWeight: 'bold' },
  endButton: { background: '#dc3545', color: 'white', padding: '10px 20px', fontSize: '18px', border: 'none', borderRadius: '8px', cursor: 'pointer' }
};

export default VideoCall;
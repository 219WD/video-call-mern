import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const SOCKET_SERVER = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const socket = io(SOCKET_SERVER);

const HostRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const localStream = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        localStream.current = stream;
      });

    socket.emit('join-room', { roomId, role: 'host' });

    socket.on('incoming-call', ({ offer, from }) => {
      console.log('LLAMADA ENTRANTE');
      setIncomingCall({ offer, from });
      new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-tone-1057.mp3').play().catch(() => {});
    });

    socket.on('new-ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', () => navigate('/'));

    return () => socket.off();
  }, [roomId]);

  const acceptCall = async () => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);

    localStream.current.getTracks().forEach(track => pc.current.addTrack(track, localStream.current));

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: incomingCall.from });
      }
    };

    await pc.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    socket.emit('accept-call', { answer, to: incomingCall.from });
    setIncomingCall(null);
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call', { roomId });
    navigate('/');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Sala: {roomId}</h2>
      <video ref={localVideo} autoPlay muted playsInline style={{ width: '300px', borderRadius: '8px' }} />
      {incomingCall ? (
        <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', margin: '20px' }}>
          <p>LLAMADA ENTRANTE!</p>
          <button onClick={acceptCall} style={{ background: '#28a745', color: 'white', padding: '10px 20px', margin: '5px', border: 'none', borderRadius: '4px' }}>
            Aceptar
          </button>
          <button onClick={() => setIncomingCall(null)} style={{ background: '#dc3545', color: 'white', padding: '10px 20px', margin: '5px', border: 'none', borderRadius: '4px' }}>
            Rechazar
          </button>
        </div>
      ) : (
        <p>Esperando llamada...</p>
      )}
      <video ref={remoteVideo} autoPlay playsInline style={{ width: '300px', borderRadius: '8px', marginTop: '20px' }} />
      <button onClick={endCall} style={{ marginTop: '20px', padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>
        Salir
      </button>
    </div>
  );
};

export default HostRoom;
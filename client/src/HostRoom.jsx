import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const SOCKET_SERVER = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const socket = io(SOCKET_SERVER, { transports: ['websocket'] });

const HostRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [ringing, setRinging] = useState(false);
  const localStream = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        localStream.current = stream;
      });

    socket.emit('join-room', { roomId, role: 'host' });

    socket.on('ring', () => {
      setRinging(true);
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-tone-1057.mp3');
      audio.loop = true;
      audio.play().catch(() => {});
      window.ringAudio = audio;
    });

    socket.on('offer', async ({ offer, from }) => {
      const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      pc.current = new RTCPeerConnection(config);
      localStream.current.getTracks().forEach(t => pc.current.addTrack(t, localStream.current));
      pc.current.ontrack = e => remoteVideo.current.srcObject = e.streams[0];
      pc.current.onicecandidate = e => e.candidate && socket.emit('ice-candidate', { candidate: e.candidate, to: from });

      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit('answer', { answer, to: from });
    });

    socket.on('ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', endCall);

    return () => {
      if (window.ringAudio) window.ringAudio.pause();
      socket.off();
    };
  }, [roomId]);

  const acceptCall = () => {
    socket.emit('accept-call');
    setRinging(false);
    if (window.ringAudio) window.ringAudio.pause();
  };

  const rejectCall = () => {
    socket.emit('reject-call');
    setRinging(false);
    if (window.ringAudio) window.ringAudio.pause();
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call');
    navigate('/');
  };

  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <h2>Sala: {roomId}</h2>
      <video ref={localVideo} autoPlay muted playsInline style={{ width: 300, borderRadius: 12, margin: 10 }} />

      {ringing && (
        <div style={{ background: '#fff3cd', padding: 20, borderRadius: 12, margin: 20 }}>
          <p style={{ fontSize: 24, fontWeight: 'bold' }}>LLAMADA ENTRANTE</p>
          <button onClick={acceptCall} style={{ background: '#28a745', color: 'white', padding: '14px 28px', margin: 10, border: 'none', borderRadius: 8, fontSize: 18 }}>ACEPTAR</button>
          <button onClick={rejectCall} style={{ background: '#dc3545', color: 'white', padding: '14px 28px', margin: 10, border: 'none', borderRadius: 8, fontSize: 18 }}>RECHAZAR</button>
        </div>
      )}

      <video ref={remoteVideo} autoPlay playsInline style={{ width: 300, borderRadius: 12, margin: 10 }} />
      <button onClick={endCall} style={{ padding: '12px 24px', background: '#6c757d', color: 'white', border: 'none', borderRadius: 8 }}>Salir</button>
    </div>
  );
};

export default HostRoom;
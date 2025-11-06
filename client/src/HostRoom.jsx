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
  const [calling, setCalling] = useState(false);
  const [guestId, setGuestId] = useState(null);
  const localStream = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        localStream.current = stream;
      });

    socket.emit('join-room', { roomId, role: 'host' });

    socket.on('ring', () => {
      setCalling(true);
      new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-tone-1057.mp3').play();
    });

    socket.on('offer', async ({ offer, from }) => {
      setGuestId(from);
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

    socket.on('call-ended', () => {
      endCall();
    });

    return () => socket.off();
  }, [roomId]);

  const acceptCall = () => {
    socket.emit('accept-call');
    setCalling(false);
  };

  const rejectCall = () => {
    socket.emit('reject-call');
    setCalling(false);
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call');
    navigate('/');
  };

  return (
    <div style={s.container}>
      <h2>Sala: {roomId}</h2>
      <video ref={localVideo} autoPlay muted playsInline style={s.video} />

      {calling && (
        <div style={s.ring}>
          <p>¡Llamada entrante!</p>
          <button onClick={acceptCall} style={s.accept}>ACEPTAR</button>
          <button onClick={rejectCall} style={s.reject}>RECHAZAR</button>
        </div>
      )}

      <video ref={remoteVideo} autoPlay playsInline style={s.video} />
      <button onClick={endCall} style={s.hangup}>COLGAR</button>
    </div>
  );
};

const s = {
  container: { textAlign: 'center', padding: 20 },
  video: { width: 300, borderRadius: 12, margin: 10, border: '3px solid #007bff' },
  ring: { background: '#fff3cd', padding: 20, borderRadius: 12, margin: 20 },
  accept: { background: '#28a745', color: 'white', padding: '12px 24px', margin: 5, border: 'none', borderRadius: 8, fontWeight: 'bold' },
  reject: { background: '#dc3545', color: 'white', padding: '12px 24px', margin: 5, border: 'none', borderRadius: 8, fontWeight: 'bold' },
  hangup: { background: '#6c757d', color: 'white', padding: '12px 24px', margin: 20, border: 'none', borderRadius: 8 }
};

export default HostRoom;
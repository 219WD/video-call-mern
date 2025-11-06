import React, { useEffect, useRef } from 'react';
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
  const localStream = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        localStream.current = stream;
        setupWebRTC(stream);
      });

    socket.emit('join-room', { roomId, role: 'guest' });

    socket.on('call-accepted', () => {
      console.log('Llamada aceptada');
    });

    socket.on('answer', async ({ answer }) => {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-rejected', () => {
      alert('Llamada rechazada');
      endCall();
    });

    socket.on('call-ended', endCall);

    return () => socket.off();
  }, [roomId]);

  const setupWebRTC = (stream) => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));
    pc.current.ontrack = e => remoteVideo.current.srcObject = e.streams[0];
    pc.current.onicecandidate = e => e.candidate && socket.emit('ice-candidate', { candidate: e.candidate, to: roomId });

    setTimeout(async () => {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit('call-offer', { offer });
    }, 1000);
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call');
    navigate('/');
  };

  return (
    <div style={s.container}>
      <h2>Llamando...</h2>
      <video ref={localVideo} autoPlay muted playsInline style={s.video} />
      <video ref={remoteVideo} autoPlay playsInline style={s.video} />
      <button onClick={endCall} style={s.hangup}>COLGAR</button>
    </div>
  );
};

const s = {
  container: { textAlign: 'center', padding: 20 },
  video: { width: 300, borderRadius: 12, margin: 10, border: '3px solid #28a745' },
  hangup: { background: '#dc3545', color: 'white', padding: '12px 24px', margin: 20, border: 'none', borderRadius: 8 }
};

export default VideoCall;
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
    // Media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        localStream.current = stream;
        setupWebRTC(stream);
      });

    // Unirse como guest
    socket.emit('join-room', { roomId, role: 'guest' });

    // Recibir answer
    socket.on('call-accepted', async ({ answer }) => {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('new-ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', () => navigate('/'));

    return () => socket.off();
  }, [roomId]);

  const setupWebRTC = (stream) => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);

    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: roomId });
      }
    };

    // ENVÍA OFERTA INMEDIATA
    setTimeout(async () => {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit('call-offer', { offer, roomId });
      console.log('OFERTA ENVIADA');
    }, 1500);
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    socket.emit('end-call', { roomId });
    navigate('/');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Llamando...</h2>
      <video ref={localVideo} autoPlay muted playsInline style={{ width: '300px', borderRadius: '8px' }} />
      <video ref={remoteVideo} autoPlay playsInline style={{ width: '300px', borderRadius: '8px', marginTop: '20px' }} />
      <button onClick={endCall} style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>
        Colgar
      </button>
    </div>
  );
};

export default VideoCall;
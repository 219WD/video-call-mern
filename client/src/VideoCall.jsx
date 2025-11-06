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
  const [calling, setCalling] = useState(true);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        setupWebRTC(stream);
      });

    socket.emit('join-room', { roomId, role: 'guest' });

    socket.on('call-accepted', async ({ answer }) => {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCalling(false);
    });

    socket.on('new-ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', endCall);

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

    initiateCall();
  };

  const initiateCall = async () => {
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit('call-offer', { offer, roomId });
  };

  const endCall = () => {
    if (pc.current) pc.current.close();
    if (localVideo.current?.srcObject) localVideo.current.srcObject.getTracks().forEach(t => t.stop());
    socket.emit('end-call', { roomId });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <h2>Llamando... {roomId}</h2>
      <video ref={localVideo} autoPlay muted playsInline style={styles.video} />
      {calling && <p>Llamando...</p>}
      {!calling && <video ref={remoteVideo} autoPlay playsInline style={styles.video} />}
      <button onClick={endCall} style={styles.end}>Colgar</button>
    </div>
  );
};

const styles = {
  container: { textAlign: 'center', padding: '20px' },
  video: { width: '300px', borderRadius: '8px', margin: '10px' },
  end: { background: '#dc3545', color: 'white', padding: '10px 20px', margin: '10px', border: 'none', borderRadius: '4px' }
};

export default VideoCall;
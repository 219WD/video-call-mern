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
  const [localStream, setLocalStream] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideo.current.srcObject = stream;
        setLocalStream(stream);
      });

    socket.emit('join-room', { roomId, role: 'host' });

    socket.on('incoming-call', ({ offer, from }) => {
      setIncomingCall({ offer, from });
    });

    socket.on('call-accepted', ({ answer }) => {
      if (pc.current) pc.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('new-ice-candidate', async (candidate) => {
      if (pc.current) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-ended', endCall);

    return () => socket.off();
  }, [roomId]);

  const acceptCall = async () => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => pc.current.addTrack(track, localStream));

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
    if (localVideo.current?.srcObject) localVideo.current.srcObject.getTracks().forEach(t => t.stop());
    socket.emit('end-call', { roomId });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <h2>Sala: {roomId}</h2>
      <video ref={localVideo} autoPlay muted playsInline style={styles.video} />
      {incomingCall ? (
        <div style={styles.alert}>
          <p>Llamada entrante!</p>
          <button onClick={acceptCall} style={styles.accept}>Aceptar</button>
          <button onClick={() => setIncomingCall(null)} style={styles.decline}>Rechazar</button>
        </div>
      ) : (
        <p>Esperando llamada...</p>
      )}
      {incomingCall === null && <video ref={remoteVideo} autoPlay playsInline style={styles.video} />}
      <button onClick={endCall} style={styles.end}>Salir</button>
    </div>
  );
};

const styles = {
  container: { textAlign: 'center', padding: '20px' },
  video: { width: '300px', borderRadius: '8px', margin: '10px' },
  alert: { background: '#fff3cd', padding: '15px', borderRadius: '8px', margin: '20px' },
  accept: { background: '#28a745', color: 'white', padding: '10px 20px', margin: '5px', border: 'none', borderRadius: '4px' },
  decline: { background: '#dc3545', color: 'white', padding: '10px 20px', margin: '5px', border: 'none', borderRadius: '4px' },
  end: { background: '#6c757d', color: 'white', padding: '10px 20px', margin: '10px', border: 'none', borderRadius: '4px' }
};

export default HostRoom;
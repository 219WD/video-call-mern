import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

const HostPage = () => {
  const [roomId, setRoomId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const navigate = useNavigate();

  const generateRoom = () => {
    const newRoomId = uuidv4().slice(0, 8);
    setRoomId(newRoomId);
    setQrUrl(`${window.location.origin}/join/${newRoomId}`);
    navigate(`/room/${newRoomId}`); // Host entra a su sala
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Generar QR para Videollamada</h1>
      <button onClick={generateRoom} style={styles.button}>
        Crear Sala
      </button>
      {qrUrl && (
        <div style={styles.qrContainer}>
          <QRCodeCanvas value={qrUrl} size={200} />
          <p style={styles.link}>Sala: <strong>{roomId}</strong></p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { textAlign: 'center', padding: '40px', fontFamily: 'Arial' },
  title: { fontSize: '28px', marginBottom: '20px' },
  button: { padding: '12px 24px', fontSize: '18px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  qrContainer: { marginTop: '30px' },
  link: { marginTop: '10px', fontSize: '16px' }
};

export default HostPage;
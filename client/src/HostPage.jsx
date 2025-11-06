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
    const url = `${window.location.origin}/join/${newRoomId}`;
    setQrUrl(url);
    
    // Redirige al host a su sala PERO mantiene el QR en esta pestaña
    // Abre en nueva pestaña para que el QR siga visible
    window.open(`/room/${newRoomId}`, '_blank');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Generar QR para Videollamada</h1>
      <button onClick={generateRoom} style={styles.button}>
        Crear Sala
      </button>

      {/* QR SIEMPRE VISIBLE */}
      {qrUrl && (
        <div style={styles.qrContainer}>
          <QRCodeCanvas value={qrUrl} size={256} />
          <p style={styles.link}>
            Sala: <strong>{roomId}</strong>
          </p>
          <p style={styles.info}>
            Escanea con tu celular o <a href={qrUrl} target="_blank" rel="noopener noreferrer">abre aquí</a>
          </p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { textAlign: 'center', padding: '40px', fontFamily: 'Arial' },
  title: { fontSize: '28px', marginBottom: '20px' },
  button: { padding: '14px 28px', fontSize: '18px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  qrContainer: { marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px', display: 'inline-block' },
  link: { marginTop: '10px', fontSize: '18px', fontWeight: 'bold' },
  info: { marginTop: '10px', fontSize: '16px', color: '#555' }
};

export default HostPage;
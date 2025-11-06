import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const GuestPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const startCall = () => {
    navigate(`/call/${roomId}`);
  };

  return (
    <div style={styles.container}>
      <button onClick={startCall} style={styles.callButton}>
        LLAMAR
      </button>
      <p style={styles.info}>Sala: <strong>{roomId}</strong></p>
    </div>
  );
};

const styles = {
  container: { 
    height: '100vh', 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#f0f2f5'
  },
  callButton: {
    background: '#28a745',
    color: 'white',
    fontSize: '48px',
    fontWeight: 'bold',
    padding: '60px 100px',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
    transition: 'all 0.2s'
  },
  info: { marginTop: '30px', fontSize: '18px' }
};

export default GuestPage;
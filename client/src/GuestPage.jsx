import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const GuestPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  return (
    <div style={s.container}>
      <button onClick={() => navigate(`/call/${roomId}`)} style={s.call}>
        LLAMAR
      </button>
      <p style={s.info}>Sala: {roomId}</p>
    </div>
  );
};

const s = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  call: { background: '#28a745', color: 'white', fontSize: 48, fontWeight: 'bold', padding: '60px 100px', border: 'none', borderRadius: '50%', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', cursor: 'pointer' },
  info: { marginTop: 30, fontSize: 18 }
};

export default GuestPage;
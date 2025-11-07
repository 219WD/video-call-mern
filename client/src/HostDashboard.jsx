import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from './contexts/AuthContext';
import api from './services/api';

const HostDashboard = () => {
  const { user } = useAuth();
  const [qrCode, setQrCode] = useState(null);
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadQRCode(),
        loadVisits(), 
        loadStats()
      ]);
    } catch (error) {
      console.log('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async () => {
    try {
      const response = await api.get('/qr/my-qr');
      setQrCode(response.data);
    } catch (error) {
      // Error 401 es normal si no hay QR generado
      if (error.response?.status === 401) {
        console.log('No autenticado para QR - probablemente no existe');
      } else {
        console.log('Error cargando QR:', error.message);
      }
    }
  };

  const loadVisits = async () => {
    try {
      const response = await api.get('/visits/history');
      setVisits(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('No autenticado para visitas - probablemente no hay datos');
      } else {
        console.log('Error cargando visitas:', error.message);
      }
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/visits/stats');
      setStats(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('No autenticado para stats - probablemente no hay datos');
      } else {
        console.log('Error cargando stats:', error.message);
      }
    }
  };

  const generateQR = async () => {
    try {
      const response = await api.post('/qr/generate', {
        title: 'Mi QR de Visitas'
      });
      setQrCode(response.data);
      alert('QR generado exitosamente!');
    } catch (error) {
      console.error('Error generando QR:', error);
      alert('Error generando QR. Intenta nuevamente.');
    }
  };

  const qrUrl = qrCode ? `${window.location.origin}/join/${qrCode.qrCode}` : '';

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <h2>Cargando...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Mi Dashboard de Visitas</h1>
        <p>Bienvenido, {user?.name}</p>
      </header>

      {/* Estadísticas */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Total Visitas</h3>
          <p style={styles.statNumber}>{stats.totalVisits || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Visitas Hoy</h3>
          <p style={styles.statNumber}>{stats.todayVisits || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Mensajes</h3>
          <p style={styles.statNumber}>{stats.messages || 0}</p>
        </div>
      </div>

      {/* Generar QR */}
      <div style={styles.qrSection}>
        <h2>Mi QR Personal</h2>
        {!qrCode ? (
          <div>
            <p style={styles.noQR}>No tienes un QR generado aún</p>
            <button onClick={generateQR} style={styles.generateButton}>
              Generar Mi QR Único
            </button>
          </div>
        ) : (
          <div style={styles.qrContainer}>
            <QRCodeCanvas value={qrUrl} size={200} />
            <p style={styles.qrCode}>Código: <strong>{qrCode.code}</strong></p>
            <p style={styles.info}>
              Comparte este QR para que te visiten
            </p>
          </div>
        )}
      </div>

      {/* Historial de Visitas */}
      <div style={styles.history}>
        <h2>Historial de Visitas</h2>
        {visits.length === 0 ? (
          <p>No hay visitas registradas aún</p>
        ) : (
          <div style={styles.visitsList}>
            {visits.map((visit, index) => (
              <div key={index} style={styles.visitCard}>
                <div style={styles.visitHeader}>
                  <strong>{visit.guest?.name || 'Visitante'}</strong>
                  <span style={styles.visitType}>{visit.type}</span>
                </div>
                <p style={styles.visitTime}>
                  {new Date(visit.timestamp).toLocaleString()}
                </p>
                {visit.message && (
                  <p style={styles.message}>"{visit.message}"</p>
                )}
                <span style={{
                  ...styles.status,
                  ...(visit.status === 'accepted' ? styles.accepted : 
                      visit.status === 'rejected' ? styles.rejected : styles.messageStatus)
                }}>
                  {visit.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: 800, margin: '0 auto', padding: 20 },
  header: { textAlign: 'center', marginBottom: 40 },
  loading: { textAlign: 'center', padding: 40 },
  stats: { display: 'flex', gap: 20, marginBottom: 40, justifyContent: 'center' },
  statCard: { background: '#f8f9fa', padding: 20, borderRadius: 12, textAlign: 'center', flex: 1 },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: '#007bff', margin: 0 },
  qrSection: { textAlign: 'center', marginBottom: 40, padding: 30, background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  noQR: { color: '#666', marginBottom: 20 },
  generateButton: { padding: '15px 30px', fontSize: 18, background: '#007bff', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  qrContainer: { display: 'inline-block' },
  qrCode: { marginTop: 10, fontSize: 14, fontFamily: 'monospace' },
  info: { color: '#666', fontSize: 14 },
  history: { background: '#fff', padding: 30, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  visitsList: { maxHeight: 400, overflowY: 'auto' },
  visitCard: { border: '1px solid #eee', padding: 15, borderRadius: 8, marginBottom: 10 },
  visitHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  visitType: { background: '#e9ecef', padding: '2px 8px', borderRadius: 12, fontSize: 12 },
  visitTime: { color: '#666', fontSize: 12, margin: '5px 0' },
  message: { fontStyle: 'italic', color: '#333', margin: '5px 0' },
  status: { fontSize: 12, padding: '2px 8px', borderRadius: 12, display: 'inline-block' },
  accepted: { background: '#d4edda', color: '#155724' },
  rejected: { background: '#f8d7da', color: '#721c24' },
  messageStatus: { background: '#fff3cd', color: '#856404' }
};

export default HostDashboard;
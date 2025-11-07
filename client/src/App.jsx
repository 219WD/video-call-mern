import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import HostDashboard from './HostDashboard';
import GuestPage from './GuestPage';
import HostRoom from './HostRoom';
import VideoCall from './VideoCall';
import Login from './Login';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><HostDashboard /></ProtectedRoute>} />
          <Route path="/join/:roomId" element={<GuestPage />} />
          <Route path="/room/:roomId" element={<ProtectedRoute><HostRoom /></ProtectedRoute>} />
          <Route path="/call/:roomId" element={<VideoCall />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HostPage from './HostPage';
import GuestPage from './GuestPage';
import HostRoom from './HostRoom.jsx';
import VideoCall from './VideoCall';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HostPage />} />
        <Route path="/join/:roomId" element={<GuestPage />} />
        <Route path="/room/:roomId" element={<HostRoom />} />
        <Route path="/call/:roomId" element={<VideoCall />} />
      </Routes>
    </Router>
  );
}

export default App;
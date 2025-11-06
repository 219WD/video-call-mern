import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HostPage from './HostPage.jsx';
import GuestPage from './GuestPage.jsx';
import VideoCall from './VideoCall.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HostPage />} />
        <Route path="/join/:roomId" element={<GuestPage />} />
        <Route path="/call/:roomId" element={<VideoCall />} />
      </Routes>
    </Router>
  );
}

export default App;
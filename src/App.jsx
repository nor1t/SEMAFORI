import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import CamerasPage from './pages/CamerasPage';
import AIChatPage from './pages/AIChatPage';
import LiveMapPage from './pages/LiveMapPage';
import TrafficAnalytics from './pages/TrafficAnalytics';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <Routes>
              {/* All pages are browsable as a guest.  Authentication is only
                  required at the action level (sending an AI chat message,
                  submitting a Live Map incident report). */}
              <Route path="/" element={<Navigate to="/cameras" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/cameras" element={<CamerasPage />} />
              <Route path="/ai-chat" element={<AIChatPage />} />
              <Route path="/live-map" element={<LiveMapPage />} />
              <Route path="/analytics" element={<TrafficAnalytics />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </AuthProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

import React, { useState, useEffect } from 'react';

const Settings = ({ onClose }) => {
  // Initialize state with values from localStorage
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'albanian');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('notifications') !== 'false');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('autoSave') !== 'false');

  useEffect(() => {
    // Apply theme on mount and when theme changes
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const handleNotificationsChange = (enabled) => {
    setNotifications(enabled);
    localStorage.setItem('notifications', enabled);
  };

  const handleAutoSaveChange = (enabled) => {
    setAutoSave(enabled);
    localStorage.setItem('autoSave', enabled);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-lg">⚙️</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Konfigurimet</h3>
              <p className="text-sm text-slate-400">Personalizo përvojën tënde</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-6">
          {/* Theme Setting */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-200">Tema</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-2xl border-2 transition ${
                  theme === 'light'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
                    <span className="text-lg">☀️</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Drita</p>
                    <p className="text-xs text-slate-400">Ndriçim i lehtë</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-2xl border-2 transition ${
                  theme === 'dark'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-lg">🌙</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Errësirë</p>
                    <p className="text-xs text-slate-400">Ndriçim i errët</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Language Setting */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-200">Gjuha</h4>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
            >
              <option value="albanian">🇦🇱 Shqip</option>
              <option value="english">🇺🇸 English</option>
            </select>
          </div>

          {/* Notifications Setting */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-200">Njoftimet</h4>
              <p className="text-xs text-slate-400">Merr njoftime për incidente të reja</p>
            </div>
            <button
              onClick={() => handleNotificationsChange(!notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                notifications ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Auto Save Setting */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-200">Ruajtje Automatike</h4>
              <p className="text-xs text-slate-400">Ruaj automatikisht ndryshimet</p>
            </div>
            <button
              onClick={() => handleAutoSaveChange(!autoSave)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                autoSave ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  autoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* App Info */}
          <div className="pt-4 border-t border-slate-700">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">SEMAFORI</h3>
              <p className="text-sm text-slate-400">Version 1.0.0</p>
              <p className="text-xs text-slate-500 mt-2">Sistemi i Menaxhimit të Trafikut</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
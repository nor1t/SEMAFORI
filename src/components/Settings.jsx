import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const Settings = ({ onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(() => localStorage.getItem('notifications') !== 'false');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('autoSave') !== 'false');

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
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
      <div className="bg-slate-900 dark:bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-lg">⚙️</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t('settings')}</h3>
              <p className="text-sm text-slate-400">{t('personalizeExperience')}</p>
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
        <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
          {/* Theme Setting */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">{t('theme')}</h4>
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
                    <p className="text-sm font-medium text-white">{t('light')}</p>
                    <p className="text-xs text-slate-400">{t('lightTheme')}</p>
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
                    <p className="text-sm font-medium text-white">{t('dark')}</p>
                    <p className="text-xs text-slate-400">{t('darkTheme')}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Language Setting */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">{t('language')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLanguageChange('albanian')}
                className={`p-4 rounded-2xl border-2 transition ${
                  language === 'albanian'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs">
                    SQ
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{t('albanian')}</p>
                    <p className="text-xs text-slate-400">Shqiptare</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleLanguageChange('english')}
                className={`p-4 rounded-2xl border-2 transition ${
                  language === 'english'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                    EN
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{t('english')}</p>
                    <p className="text-xs text-slate-400">English</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
            <div>
              <p className="text-sm font-medium text-white">{t('notifications')}</p>
              <p className="text-xs text-slate-400">Get alerts for new incidents</p>
            </div>
            <button
              onClick={() => handleNotificationsChange(!notifications)}
              className={`w-12 h-6 rounded-full transition ${
                notifications ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition transform ${
                  notifications ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Auto-Save Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
            <div>
              <p className="text-sm font-medium text-white">{t('autoSave')}</p>
              <p className="text-xs text-slate-400">Automatically save reports</p>
            </div>
            <button
              onClick={() => handleAutoSaveChange(!autoSave)}
              className={`w-12 h-6 rounded-full transition ${
                autoSave ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition transform ${
                  autoSave ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* App Info */}
          <div className="pt-4 border-t border-slate-700">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">SEMAFORI</h3>
              <p className="text-sm text-slate-400">Version 1.0.0</p>
              <p className="text-xs text-slate-500 mt-2">Traffic Management System</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const Settings = ({ onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(() => localStorage.getItem('notifications') !== 'false');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('autoSave') !== 'false');

  const panelClass = theme === 'light'
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-900 border-slate-700 text-white';

  const secondaryTextClass = theme === 'light' ? 'text-slate-500' : 'text-slate-400';
  const sectionTitleClass = theme === 'light' ? 'text-slate-700' : 'text-slate-200';

  const handleNotificationsChange = (enabled) => {
    setNotifications(enabled);
    localStorage.setItem('notifications', enabled);
  };

  const handleAutoSaveChange = (enabled) => {
    setAutoSave(enabled);
    localStorage.setItem('autoSave', enabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl ${panelClass}`}>
        <div className={`flex items-center justify-between border-b p-6 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500">
              <span className="text-lg text-white">⚙️</span>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('settings')}</h3>
              <p className={`text-sm ${secondaryTextClass}`}>{t('personalizeExperience')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${theme === 'light' ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
          >
            ✕
          </button>
        </div>

        <div className="max-h-96 space-y-6 overflow-y-auto p-6">
          <div className="space-y-3">
            <h4 className={`text-sm font-semibold uppercase tracking-wide ${sectionTitleClass}`}>{t('theme')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`rounded-2xl border-2 p-4 transition ${
                  theme === 'light'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400">
                    <span className="text-lg">☀️</span>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('light')}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>{t('lightTheme')}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`rounded-2xl border-2 p-4 transition ${
                  theme === 'dark'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                    <span className="text-lg">🌙</span>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('dark')}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>{t('darkTheme')}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className={`text-sm font-semibold uppercase tracking-wide ${sectionTitleClass}`}>{t('language')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLanguage('albanian')}
                className={`rounded-2xl border-2 p-4 transition ${
                  language === 'albanian'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">SQ</div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('albanian')}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>Shqip</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setLanguage('english')}
                className={`rounded-2xl border-2 p-4 transition ${
                  language === 'english'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">EN</div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('english')}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>English</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className={`flex items-center justify-between rounded-2xl border p-4 ${theme === 'light' ? 'border-slate-200 bg-slate-100/80' : 'border-slate-700 bg-slate-800/50'}`}>
            <div>
              <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('notifications')}</p>
              <p className={`text-xs ${secondaryTextClass}`}>{t('notificationsInfo')}</p>
            </div>
            <button
              onClick={() => handleNotificationsChange(!notifications)}
              className={`h-6 w-12 rounded-full transition ${notifications ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'}`}
            >
              <div className={`h-5 w-5 rounded-full bg-white transition ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className={`flex items-center justify-between rounded-2xl border p-4 ${theme === 'light' ? 'border-slate-200 bg-slate-100/80' : 'border-slate-700 bg-slate-800/50'}`}>
            <div>
              <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('autoSave')}</p>
              <p className={`text-xs ${secondaryTextClass}`}>{t('autoSaveInfo')}</p>
            </div>
            <button
              onClick={() => handleAutoSaveChange(!autoSave)}
              className={`h-6 w-12 rounded-full transition ${autoSave ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'}`}
            >
              <div className={`h-5 w-5 rounded-full bg-white transition ${autoSave ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className={`border-t pt-4 text-center ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
            <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('appInfoTitle')}</h3>
            <p className={`text-sm ${secondaryTextClass}`}>{t('appInfoSubtitle')}</p>
            <p className={`mt-2 text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{t('trafficSystemInfo')}</p>
          </div>
        </div>

        <div className={`border-t p-4 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-600"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

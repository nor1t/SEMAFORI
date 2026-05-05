import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AIAssistant from './AIAssistant';
import BrandMark from './BrandMark';
import Settings from './Settings';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';

const Header = ({ reports = [] }) => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: 'Officer',
  });

  const roleOptions = [
    { value: 'Officer', label: t('trafficOfficer') },
    { value: 'Supervisor', label: t('supervisor') },
    { value: 'Manager', label: t('manager') },
    { value: 'Admin', label: t('administrator') },
  ];

  const loadProfile = useCallback(() => {
    if (!user) return;

    setProfileData({
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
      phone: user.user_metadata?.phone || '',
      department: user.user_metadata?.department || '',
      role: user.user_metadata?.role || 'Officer',
    });
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          phone: profileData.phone,
          department: profileData.department,
          role: profileData.role,
        },
      });

      if (error) throw error;

      setIsEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-gray-200/70 bg-white/95 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-4">
            <BrandMark className="h-12 w-12" innerClassName="h-10 w-10" />
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-gray-600 dark:text-slate-400">{t('trafficCommandCenter')}</p>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">SEMAFORI</h1>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/dashboard"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
              }`}
            >
              {t('dashboard')}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="hidden items-center gap-2 rounded-full bg-gray-100/60 px-3 py-2 text-gray-600 transition hover:bg-gray-200/80 sm:flex dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800/80"
              title={t('settings')}
            >
              <span className="text-lg">⚙️</span>
              <span className="text-sm font-medium">{t('settings')}</span>
            </button>

            <button
              onClick={() => setShowAIAssistant(true)}
              className="hidden items-center gap-2 rounded-full bg-purple-500/15 px-3 py-2 text-purple-700 transition hover:bg-purple-500/25 sm:flex dark:text-purple-300"
              title={t('aiAssistant')}
            >
              <span className="text-lg">🤖</span>
              <span className="text-sm font-medium">{t('aiAssistant')}</span>
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100/60 px-4 py-2 shadow-inner transition hover:bg-gray-200/80 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800/80"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 font-bold text-white">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 sm:block dark:text-slate-300">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('userDefault')}
                </span>
                <svg className={`h-4 w-4 text-slate-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-gray-300 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 text-lg font-bold text-white">
                        {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user?.user_metadata?.full_name || t('userDefault')}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{user?.email}</p>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3">
                      {!isEditing ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-300">{t('role')}:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{roleOptions.find((item) => item.value === profileData.role)?.label || profileData.role}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-300">{t('department')}:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{profileData.department || t('notSet')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-300">{t('phone')}:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{profileData.phone || t('notSet')}</span>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-sm text-gray-600 dark:text-slate-300">{t('fullName')}</label>
                            <input
                              type="text"
                              value={profileData.full_name}
                              onChange={(event) => setProfileData((prev) => ({ ...prev, full_name: event.target.value }))}
                              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:border-cyan-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm text-gray-600 dark:text-slate-300">{t('role')}</label>
                            <select
                              value={profileData.role}
                              onChange={(event) => setProfileData((prev) => ({ ...prev, role: event.target.value }))}
                              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:border-cyan-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            >
                              {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm text-gray-600 dark:text-slate-300">{t('department')}</label>
                            <input
                              type="text"
                              value={profileData.department}
                              onChange={(event) => setProfileData((prev) => ({ ...prev, department: event.target.value }))}
                              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:border-cyan-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                              placeholder={t('departmentPlaceholder')}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm text-gray-600 dark:text-slate-300">{t('phone')}</label>
                            <input
                              type="tel"
                              value={profileData.phone}
                              onChange={(event) => setProfileData((prev) => ({ ...prev, phone: event.target.value }))}
                              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:border-cyan-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                              placeholder={t('phonePlaceholder')}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                          >
                            {t('editProfile')}
                          </button>
                          <button
                            onClick={handleLogout}
                            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {t('signOut')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-slate-700"
                          >
                            {saving ? t('saving') : t('saveChanges')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200/70 md:hidden dark:border-slate-800/70">
          <nav className="flex">
            <Link
              to="/dashboard"
              className={`flex-1 px-4 py-3 text-center text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
              }`}
            >
              {t('dashboard')}
            </Link>
          </nav>
        </div>
      </header>

      {showAIAssistant && <AIAssistant reports={reports} onClose={() => setShowAIAssistant(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </>
  );
};

export default Header;

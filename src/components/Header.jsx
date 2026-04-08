import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AIAssistant from './AIAssistant';
import Settings from './Settings';

const Header = ({ reports = [] }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProfile = async () => {
    try {
      const profile = {
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        department: user.user_metadata?.department || '',
        role: user.user_metadata?.role || 'Officer',
      };
      setProfileData(profile);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { supabase } = await import('../services/supabaseClient');
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          phone: profileData.phone,
          department: profileData.department,
          role: profileData.role,
        }
      });

      if (error) throw error;
      setIsEditing(false);
      // Reload profile data
      await loadProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
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
      <header className="fixed top-0 left-0 right-0 z-50 dark:bg-slate-950/95 dark:backdrop-blur-xl dark:border-b dark:border-slate-800/70 bg-white/95 backdrop-blur-xl border-b border-gray-200/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-r from-cyan-500 to-sky-500 shadow-lg shadow-cyan-500/20">
                <span className="text-2xl">🚦</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] dark:text-slate-400 text-gray-600">Qendra e Komandës së Trafikut</p>
                <h1 className="text-xl font-semibold dark:text-white text-gray-900">SEMAFORI</h1>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-cyan-500 text-slate-950'
                  : 'dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
              }`}
            >
              Paneli
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800/80 bg-gray-100/60 text-gray-600 hover:bg-gray-200/80 transition"
              title="Konfigurimet"
            >
              <span className="text-lg">⚙️</span>
              <span className="text-sm font-medium">Opsionet</span>
            </button>
            <button
              onClick={() => setShowAIAssistant(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-purple-500/15 dark:text-purple-300 text-purple-700 hover:bg-purple-500/25 transition"
              title="Asistenti AI"
            >
              <span className="text-lg">🤖</span>
              <span className="text-sm font-medium">AI</span>
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 dark:bg-slate-800/60 bg-gray-100/60 px-4 py-2 rounded-full shadow-inner dark:border dark:border-slate-700 border border-gray-300 dark:hover:bg-slate-800/80 hover:bg-gray-200/80 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 flex items-center justify-center text-white font-bold">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium dark:text-slate-300 text-gray-600 hidden sm:block">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-80 dark:bg-slate-900/95 bg-white/95 backdrop-blur-xl rounded-2xl dark:border dark:border-slate-700 border border-gray-300 shadow-2xl z-50">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg">
                        {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="dark:text-white text-gray-900 font-semibold">{user?.user_metadata?.full_name || 'User'}</p>
                        <p className="dark:text-slate-400 text-gray-600 text-sm">{user?.email}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {!isEditing ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="dark:text-slate-300 text-gray-600 text-sm">Roli:</span>
                            <span className="dark:text-white text-gray-900 text-sm">{profileData.role}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="dark:text-slate-300 text-gray-600 text-sm">Departamenti:</span>
                            <span className="dark:text-white text-gray-900 text-sm">{profileData.department || 'Nuk është vendosur'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="dark:text-slate-300 text-gray-600 text-sm">Telefoni:</span>
                            <span className="dark:text-white text-gray-900 text-sm">{profileData.phone || 'Nuk është vendosur'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block dark:text-slate-300 text-gray-600 text-sm mb-1">Emri i Plotë</label>
                            <input
                              type="text"
                              value={profileData.full_name}
                              onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                              className="w-full dark:bg-slate-800 bg-gray-100 dark:border dark:border-slate-600 border border-gray-300 rounded-lg px-3 py-2 dark:text-white text-gray-900 text-sm focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                          <div>
                            <label className="block dark:text-slate-300 text-gray-600 text-sm mb-1">Roli</label>
                            <select
                              value={profileData.role}
                              onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                              className="w-full dark:bg-slate-800 bg-gray-100 dark:border dark:border-slate-600 border border-gray-300 rounded-lg px-3 py-2 dark:text-white text-gray-900 text-sm focus:outline-none focus:border-cyan-400"
                            >
                              <option value="Officer">Oficer Trafiku</option>
                              <option value="Supervisor">Supervizor</option>
                              <option value="Manager">Menaxher</option>
                              <option value="Admin">Administrator</option>
                            </select>
                          </div>
                          <div>
                            <label className="block dark:text-slate-300 text-gray-600 text-sm mb-1">Departamenti</label>
                            <input
                              type="text"
                              value={profileData.department}
                              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                              className="w-full dark:bg-slate-800 bg-gray-100 dark:border dark:border-slate-600 border border-gray-300 rounded-lg px-3 py-2 dark:text-white text-gray-900 text-sm focus:outline-none focus:border-cyan-400"
                              placeholder="p.sh. Kontrolli i Trafikut"
                            />
                          </div>
                          <div>
                            <label className="block dark:text-slate-300 text-gray-600 text-sm mb-1">Telefoni</label>
                            <input
                              type="tel"
                              value={profileData.phone}
                              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                              className="w-full dark:bg-slate-800 bg-gray-100 dark:border dark:border-slate-600 border border-gray-300 rounded-lg px-3 py-2 dark:text-white text-gray-900 text-sm focus:outline-none focus:border-cyan-400"
                              placeholder="Shkruaj numrin e telefonit"
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
                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2 rounded-lg text-sm font-medium transition"
                          >
                            Redakto Profilin
                          </button>
                          <button
                            onClick={handleLogout}
                            className="px-4 py-2 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
                          >
                            Çkyçu
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition"
                          >
                            Anulo
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:dark:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-lg text-sm font-medium transition"
                          >
                            {saving ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}
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

        {/* Mobile Navigation */}
        <div className="md:hidden dark:border-t dark:border-slate-800/70 border-t border-gray-200/70">
          <nav className="flex">
            <Link
              to="/dashboard"
              className={`flex-1 px-4 py-3 text-center text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-cyan-500 text-slate-950'
                  : 'dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
              }`}
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {showAIAssistant && (
        <AIAssistant
          reports={reports}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

export default Header;
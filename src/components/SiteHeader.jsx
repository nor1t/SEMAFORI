import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';

const navigationLinks = [
  { label: 'Cameras', to: '/cameras' },
  { label: 'AI Chat', to: '/ai-chat' },
  { label: 'Live Map', to: '/live-map' },
  { label: 'Analytics', to: '/analytics' },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative h-7 w-14 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-tblue-400/50"
      style={{ background: dark ? 'linear-gradient(135deg, #1e3a5f, #0f2540)' : 'linear-gradient(135deg, #dbeafe, #93c5fd)' }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div
        className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 ${dark ? 'bg-navy-800' : 'bg-white'}`}
        style={{ left: dark ? '30px' : '2px' }}
      >
        {dark
          ? <iconify-icon icon="lucide:moon" width="14" class="text-tblue-300"></iconify-icon>
          : <iconify-icon icon="lucide:sun" width="14" class="text-tblue-600"></iconify-icon>}
      </div>
    </button>
  );
}

/* ── Language toggle: same pill style as the theme switch ── */
function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const albanian = language !== 'english';

  return (
    <button
      type="button"
      onClick={() => setLanguage(albanian ? 'english' : 'albanian')}
      className="relative h-7 w-[4.5rem] rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-tblue-400/50"
      style={{ background: albanian ? 'linear-gradient(135deg, #991b1b, #dc2626)' : 'linear-gradient(135deg, #1e3a5f, #0f2540)' }}
      aria-label={albanian ? 'Switch to English' : 'Switch to Albanian'}
      role="switch"
      aria-checked={!albanian}
      title="Gjuha / Language"
    >
      <div
        className="absolute top-0.5 h-6 w-8 rounded-full bg-white shadow-md transition-all duration-300"
        style={{ left: albanian ? '2px' : '38px' }}
      />
      <span className={`absolute left-0 top-0 flex h-full w-9 items-center justify-center text-[10px] font-bold transition-colors duration-300 ${albanian ? 'text-red-700' : 'text-white/70'}`}>SQ</span>
      <span className={`absolute right-0 top-0 flex h-full w-9 items-center justify-center text-[10px] font-bold transition-colors duration-300 ${albanian ? 'text-white/70' : 'text-navy-800'}`}>EN</span>
    </button>
  );
}

const displayName = (u) =>
  u?.user_metadata?.full_name?.trim() || u?.email?.split('@')[0] || 'User';

const SiteHeader = () => {
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const dark = theme === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSettingsOpen(false);
  }, [location.pathname]);

  /* Close the settings menu on outside click or Escape */
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onPointerDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);

  const isLinkActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      // Stay on the current page — guests can keep browsing.
    } finally {
      setLoggingOut(false);
      setSettingsOpen(false);
    }
  };

  const shellClass = scrolled
    ? dark
      ? 'bg-navy-900/90 shadow-2xl shadow-black/30 backdrop-blur-xl'
      : 'bg-paper-50/90 shadow-lg shadow-black/5 backdrop-blur-xl'
    : 'bg-transparent';

  const navTextClass = dark ? 'text-gray-400 hover:text-tblue-400' : 'text-gray-500 hover:text-tblue-600';
  const activeClass = dark ? 'text-tblue-300' : 'text-tblue-600';
  const menuItemClass = dark
    ? 'text-gray-300 hover:bg-white/5 hover:text-white'
    : 'text-gray-600 hover:bg-gray-100 hover:text-navy-800';

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${shellClass}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/cameras" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-tblue-500/20">
            <img src="/NewLogo.png" alt="SEMAFORI Logo" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <span className={`font-serif text-sm font-semibold tracking-wide ${dark ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
            <span className={`block text-[9px] uppercase tracking-[0.2em] ${dark ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>Smart Traffic</span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navigationLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[13px] tracking-wide transition-colors duration-200 ${isLinkActive(link.to) ? activeClass : navTextClass}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Settings menu: theme toggle, profile, about, sign in/out */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`group flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-tblue-400/50 ${settingsOpen ? 'ring-2 ring-tblue-400/50' : ''}`}
              aria-label="Settings"
              aria-expanded={settingsOpen}
            >
              <iconify-icon icon="lucide:settings" width="16" class={`transition-transform duration-300 group-hover:rotate-90 ${dark ? 'text-tblue-300' : 'text-tblue-600'}`}></iconify-icon>
            </button>

            {settingsOpen && (
              <div className={`animate-slide-up absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${dark ? 'border-navy-600/30 bg-navy-900/95' : 'border-gray-200 bg-white/95'}`}>
                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setSettingsOpen(false)}
                    className={`m-2 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                      {displayName(user).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13px] font-medium ${dark ? 'text-white' : 'text-navy-800'}`}>{displayName(user)}</div>
                      <div className="truncate text-[11px] text-gray-500">{user.email}</div>
                    </div>
                    <iconify-icon icon="lucide:chevron-right" width="14" class="text-gray-500"></iconify-icon>
                  </Link>
                )}

                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Preferences</div>
                <div className="px-2">
                  <div className="flex items-center justify-between rounded-xl px-2 py-2">
                    <span className={`flex items-center gap-2.5 text-[13px] ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <iconify-icon icon={dark ? 'lucide:moon' : 'lucide:sun'} width="15" class="text-tblue-400"></iconify-icon>
                      Dark Mode
                    </span>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center justify-between rounded-xl px-2 py-2">
                    <span className={`flex items-center gap-2.5 text-[13px] ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <iconify-icon icon="lucide:languages" width="15" class="text-tblue-400"></iconify-icon>
                      Language
                    </span>
                    <LanguageToggle />
                  </div>
                </div>

                <div className={`mx-2 my-1 border-t ${dark ? 'border-white/5' : 'border-gray-100'}`} />

                <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">General</div>
                <div className="px-2 pb-1">
                  <Link to="/profile" onClick={() => setSettingsOpen(false)} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${menuItemClass}`}>
                    <iconify-icon icon="lucide:user" width="15"></iconify-icon>
                    Profile
                  </Link>
                  <Link to="/about" onClick={() => setSettingsOpen(false)} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${menuItemClass}`}>
                    <iconify-icon icon="lucide:info" width="15"></iconify-icon>
                    About
                  </Link>
                </div>

                <div className={`mx-2 my-1 border-t ${dark ? 'border-white/5' : 'border-gray-100'}`} />

                <div className="p-2">
                  {user ? (
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <iconify-icon icon="lucide:log-out" width="15"></iconify-icon>
                      {loggingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  ) : (
                    <Link to="/login" onClick={() => setSettingsOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-tblue-400 transition-colors hover:bg-tblue-500/10">
                      <iconify-icon icon="lucide:log-in" width="15"></iconify-icon>
                      Login / Sign Up
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setMobileOpen((prev) => !prev)} className="p-2 lg:hidden" aria-label="Toggle navigation menu">
            <iconify-icon icon={mobileOpen ? 'lucide:x' : 'lucide:menu'} width="20" class={dark ? 'text-white' : 'text-navy-800'}></iconify-icon>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={`animate-slide-up border-t lg:hidden ${dark ? 'border-navy-600/30 bg-navy-900/95 backdrop-blur-xl' : 'border-gray-200 bg-paper-50/95 backdrop-blur-xl'}`}>
          <div className="flex flex-col gap-3 px-6 py-4">
            {navigationLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`py-2 text-sm transition-colors ${isLinkActive(link.to) ? activeClass : dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              to="/profile"
              className={`py-2 text-sm transition-colors ${isLinkActive('/profile') ? activeClass : dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
            >
              Profile
            </Link>
            <Link
              to="/about"
              className={`py-2 text-sm transition-colors ${isLinkActive('/about') ? activeClass : dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
            >
              About
            </Link>

            {user ? (
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className={`py-2 text-left text-sm transition-colors ${dark ? 'text-gray-300 hover:text-red-400' : 'text-gray-600 hover:text-red-600'} disabled:opacity-60`}
              >
                {loggingOut ? 'Signing Out...' : 'Log Out'}
              </button>
            ) : (
              <Link
                to="/login"
                className={`py-2 text-sm transition-colors ${dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default SiteHeader;

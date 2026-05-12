import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const dashboardLinks = [
  { label: 'Overview', to: '/dashboard#overview', hash: '#overview' },
  { label: 'Live Map', to: '/dashboard#map', hash: '#map' },
  { label: 'AI Assistant', to: '/dashboard#ai', hash: '#ai' },
  { label: 'About', to: '/dashboard#about', hash: '#about' },
];

const HEADER_SCROLL_OFFSET = 96;

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

const SiteHeader = () => {
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dark = theme === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/traffic-command-center';

  const scrollToHash = useCallback((hash, behavior = 'smooth') => {
    if (!hash) return false;

    const section = document.querySelector(hash);
    if (!section) return false;

    const top = section.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(top, 0), behavior });
    return true;
  }, []);

  const isLinkActive = (hash) => {
    if (!isDashboardRoute) return false;
    if (hash === '#overview') {
      return !location.hash || location.hash === '#overview';
    }
    return location.hash === hash;
  };

  useEffect(() => {
    if (!isDashboardRoute || !location.hash) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      scrollToHash(location.hash);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isDashboardRoute, location.hash, scrollToHash]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDashboardNavigation = (event, hash) => {
    event.preventDefault();

    if (!hash) return;

    if (!isDashboardRoute) {
      navigate(`/dashboard${hash}`);
      return;
    }

    if (location.pathname !== '/dashboard' || location.hash !== hash) {
      navigate(`/dashboard${hash}`);
    }

    scrollToHash(hash);
  };

  const shellClass = scrolled
    ? dark
      ? 'bg-navy-900/90 shadow-2xl shadow-black/30 backdrop-blur-xl'
      : 'bg-paper-50/90 shadow-lg shadow-black/5 backdrop-blur-xl'
    : 'bg-transparent';

  const navTextClass = dark ? 'text-gray-400 hover:text-tblue-400' : 'text-gray-500 hover:text-tblue-600';
  const activeClass = dark ? 'text-tblue-300' : 'text-tblue-600';
  const actionClass = dark
    ? 'border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10'
    : 'border-navy-800/10 bg-white/70 text-navy-800 hover:border-navy-800/20 hover:bg-white';

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${shellClass}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-tblue-500/20">
            <img src="/logo.PNG" alt="SEMAFORI Logo" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <span className={`font-serif text-sm font-semibold tracking-wide ${dark ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
            <span className={`block text-[9px] uppercase tracking-[0.2em] ${dark ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>Smart Traffic</span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {dashboardLinks.map((link) => (
            <Link
              key={link.hash}
              to={link.to}
              onClick={(event) => handleDashboardNavigation(event, link.hash)}
              className={`text-[13px] tracking-wide transition-colors duration-200 ${isLinkActive(link.hash) ? activeClass : navTextClass}`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/profile"
            className={`text-[13px] tracking-wide transition-colors duration-200 ${location.pathname === '/profile' ? activeClass : navTextClass}`}
          >
            Profile
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {user ? (
            <>
              <Link
                to="/profile"
                className={`hidden rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition md:inline-flex ${actionClass}`}
              >
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Profile'}
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className={`hidden rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition md:inline-flex ${actionClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {loggingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={`hidden rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition md:inline-flex ${actionClass}`}
            >
              Login
            </Link>
          )}

          <button onClick={() => setMobileOpen((prev) => !prev)} className="p-2 lg:hidden" aria-label="Toggle navigation menu">
            <iconify-icon icon={mobileOpen ? 'lucide:x' : 'lucide:menu'} width="20" class={dark ? 'text-white' : 'text-navy-800'}></iconify-icon>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={`animate-slide-up border-t lg:hidden ${dark ? 'border-navy-600/30 bg-navy-900/95 backdrop-blur-xl' : 'border-gray-200 bg-paper-50/95 backdrop-blur-xl'}`}>
          <div className="flex flex-col gap-3 px-6 py-4">
            {dashboardLinks.map((link) => (
              <Link
                key={link.hash}
                to={link.to}
                onClick={(event) => handleDashboardNavigation(event, link.hash)}
                className={`py-2 text-sm transition-colors ${isLinkActive(link.hash) ? activeClass : dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/profile"
              className={`py-2 text-sm transition-colors ${location.pathname === '/profile' ? activeClass : dark ? 'text-gray-300 hover:text-tblue-400' : 'text-gray-600 hover:text-tblue-600'}`}
            >
              Profile
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

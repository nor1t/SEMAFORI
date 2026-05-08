import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const footerColumns = [
  {
    title: 'Platform',
    links: [
      { label: 'Overview', to: '/dashboard#overview' },
      { label: 'Live Map', to: '/dashboard#map' },
      { label: 'AI Assistant', to: '/dashboard#ai' },
      { label: 'Profile', to: '/profile' },
      { label: 'About', to: '/dashboard#about' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'Traffic Flow', to: '/dashboard#overview' },
      { label: 'Incident Monitoring', to: '/dashboard#map' },
      { label: 'Forecasting', to: '/dashboard#ai' },
      { label: 'Command Center', to: '/dashboard' },
      { label: 'Response Insights', to: '/dashboard#about' },
    ],
  },
  {
    title: 'Access',
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Profile Settings', to: '/profile' },
      { label: 'Sign In', to: '/login' },
      { label: 'Create Account', to: '/signup' },
      { label: 'Live Overview', to: '/dashboard#overview' },
    ],
  },
];

const socialLinks = [
  { icon: 'lucide:twitter', href: 'https://x.com/NoritQy', label: 'Twitter' },
  { icon: 'lucide:github', href: 'https://github.com/nor1t', label: 'GitHub' },
  { icon: 'lucide:linkedin', href: 'https://www.linkedin.com/in/noriti/', label: 'LinkedIn' },
  { icon: 'lucide:mail', href: 'mailto:qnorit@gmail.com', label: 'Email' },
];

const SiteFooter = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <footer className={`border-t py-16 ${dark ? 'border-navy-600/15 bg-navy-950' : 'border-gray-200 bg-paper-50'}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tblue-500/20">
                <img src="/logo.PNG" alt="SEMAFORI Logo" className="h-5 w-5 object-contain" />
              </div>
              <div>
                <span className={`font-serif text-sm font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
                <span className={`block text-[9px] uppercase tracking-[0.2em] ${dark ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>Smart Traffic</span>
              </div>
            </div>
            <p className={`text-xs leading-relaxed ${dark ? 'text-gray-500' : 'text-gray-400'}`} style={{ lineHeight: '1.8' }}>
              Harmonizing urban movement through artificial intelligence and better real-time coordination.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h4 className={`mb-4 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{column.title}</h4>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link to={link.to} className={`text-xs transition-colors hover:text-tblue-400 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="eastern-line mb-8 w-full"></div>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className={`text-[11px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            &copy; 2026 SEMAFORI. All rights reserved. Norit Qyqalla
          </p>
          <div className="flex items-center gap-4">
            {socialLinks.map(({ icon, href, label }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className={`rounded-lg p-2 transition-colors ${dark ? 'text-gray-600 hover:bg-navy-800/40 hover:text-tblue-400' : 'text-gray-400 hover:bg-gray-100 hover:text-tblue-500'}`}
              >
                <iconify-icon icon={icon} width="16"></iconify-icon>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;

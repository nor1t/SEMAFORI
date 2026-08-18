import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const footerLinks = [
  { label: 'Cameras', to: '/cameras' },
  { label: 'AI Chat', to: '/ai-chat' },
  { label: 'Live Map', to: '/live-map' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'About', to: '/about' },
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
    <footer className={`border-t ${dark ? 'border-navy-600/15 bg-navy-950' : 'border-gray-200 bg-paper-50'}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 sm:flex-row">
        {/* Brand */}
        <Link to="/cameras" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-tblue-500/20">
            <img src="/NewLogo.png" alt="SEMAFORI Logo" className="h-4 w-4 object-contain" />
          </div>
          <span className={`font-serif text-xs font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
        </Link>

        {/* Essential links only */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {footerLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[11px] transition-colors hover:text-tblue-400 ${dark ? 'text-gray-500' : 'text-gray-400'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright + socials */}
        <div className="flex items-center gap-3">
          <p className={`text-[10px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            &copy; 2026 SEMAFORI · Norit Qyqalla
          </p>
          <div className="flex items-center gap-1">
            {socialLinks.map(({ icon, href, label }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className={`rounded-md p-1.5 transition-colors ${dark ? 'text-gray-600 hover:bg-navy-800/40 hover:text-tblue-400' : 'text-gray-400 hover:bg-gray-100 hover:text-tblue-500'}`}
              >
                <iconify-icon icon={icon} width="14"></iconify-icon>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;

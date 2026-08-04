import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Shared "log in to continue" prompt for every guest-gated action
 * (AI assistant, community chat, …). Routes through the existing
 * /login and /signup flows and returns the user to `from` afterwards.
 */
const AuthPromptModal = ({
  open,
  onClose,
  from = '/',
  title = 'Log in to use this feature',
  message = 'You need to log in or sign up to continue.',
}) => {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{ background: 'var(--app-bg)', borderColor: 'var(--card-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <iconify-icon icon="lucide:x" width="16" />
        </button>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10">
          <iconify-icon icon="lucide:lock" width="20" className="text-orange-400" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => navigate('/login', { state: { from } })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            <iconify-icon icon="lucide:log-in" width="15" />
            Log in
          </button>
          <button
            onClick={() => navigate('/signup', { state: { from } })}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
          >
            Create an account
          </button>
        </div>
        <button onClick={onClose} className="mt-3 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
          Maybe later
        </button>
      </div>
    </div>
  );
};

export default AuthPromptModal;
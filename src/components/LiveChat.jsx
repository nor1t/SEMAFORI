import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import AuthPromptModal from './AuthPromptModal';

const TABLE = 'chat_messages';
const PAGE_SIZE = 50;
const MAX_KEPT = 200;
const SETUP_NOTE = 'Live chat is not set up yet — the chat table is missing in the database.';

const displayName = (user) =>
  user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'User';

const timeLabel = (ts) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return hm;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${hm}`;
};

/* Missing table / migration-not-run errors — show a friendly setup note. */
const isSetupError = (error) => {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
};

/**
 * Live community chat for the Cameras page.
 * Reads are public; sending requires an account (RLS enforced server-side,
 * guests are routed through the shared AuthPromptModal).
 */
const LiveChat = ({ className = '' }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const scrollRef = useRef(null);
  const guestKeyRef = useRef(`guest-${Math.random().toString(36).slice(2, 10)}`);

  /* ── Initial history + realtime inserts (no polling) ── */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from(TABLE)
          .select('id, user_id, sender_name, content, created_at')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (cancelled) return;
        if (fetchError) throw fetchError;
        setMessages((data || []).reverse());
      } catch (err) {
        if (cancelled) return;
        setError(isSetupError(err) ? SETUP_NOTE : 'Could not load the chat right now. Check your connection and retry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel('semafori-chat-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLE },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row].slice(-MAX_KEPT)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [reloadTick]);

  /* ── Presence: live "N online" counter (guests count as viewers) ── */
  useEffect(() => {
    const key = user?.id || guestKeyRef.current;
    const presence = supabase.channel('semafori-chat-presence', { config: { presence: { key } } });
    presence
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Math.max(1, Object.keys(presence.presenceState()).length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ name: user ? displayName(user) : 'Guest' });
        }
      });
    return () => {
      supabase.removeChannel(presence);
    };
  }, [user]);

  /* ── Keep the newest message in view ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from(TABLE)
        .insert([{ content, sender_name: displayName(user) }])
        .select('id, user_id, sender_name, content, created_at')
        .single();
      if (insertError) throw insertError;
      setInput('');
      // Append immediately; the realtime handler dedupes by id when the
      // broadcast copy of the same row arrives.
      if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    } catch (err) {
      setError(isSetupError(err) ? SETUP_NOTE : 'Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`glass-card rounded-xl flex flex-col overflow-hidden ${className}`}>
      <style>{`
        .chat-bubble { max-width: 85%; padding: 7px 11px; border-radius: 14px; font-size: 12px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; color: var(--text-strong); }
        .chat-own { background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.25); border-bottom-right-radius: 4px; }
        .chat-other { background: var(--card-bg); border: 1px solid var(--card-border); border-bottom-left-radius: 4px; }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <iconify-icon icon="lucide:messages-square" width="15" className="text-orange-400" />
          <span className="text-sm font-semibold tracking-tight">Live Chat</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {onlineCount} online
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <iconify-icon icon="lucide:loader-circle" width="18" className="animate-spin text-zinc-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-2.5">
              <iconify-icon icon="lucide:message-circle" width="18" className="text-zinc-600" />
            </div>
            <p className="text-[12px] text-zinc-500">No messages yet</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Be the first to say hello.</p>
          </div>
        ) : (
          messages.map((m) => {
            const own = !!user && m.user_id === user.id;
            return (
              <div key={m.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-1.5 px-1 mb-0.5">
                  <span className={`text-[10px] font-semibold ${own ? 'text-orange-400' : 'text-zinc-400'}`}>
                    {own ? 'You' : m.sender_name || 'User'}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-600">{timeLabel(m.created_at)}</span>
                </div>
                <div className={`chat-bubble ${own ? 'chat-own' : 'chat-other'}`}>{m.content}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Error note */}
      {error && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 text-[10px] text-red-400">
          <span className="min-w-0">{error}</span>
          <button onClick={() => setReloadTick((t) => t + 1)} className="flex-shrink-0 font-semibold hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3 flex-shrink-0" style={{ borderColor: 'var(--card-border)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            if (!user) setAuthPromptOpen(true);
          }}
          readOnly={!user}
          placeholder={user ? 'Message the community…' : 'Log in to chat…'}
          maxLength={500}
          className="flex-1 min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
        />
        <button
          type="submit"
          disabled={sending || (!!user && !input.trim())}
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? (
            <iconify-icon icon="lucide:loader-circle" width="15" className="animate-spin" />
          ) : (
            <iconify-icon icon="lucide:send-horizontal" width="15" />
          )}
        </button>
      </form>

      <AuthPromptModal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        from="/cameras"
        message="You need to log in or sign up to join the live community chat. You can keep watching the cameras either way."
      />
    </div>
  );
};

export default LiveChat;
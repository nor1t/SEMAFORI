import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { groq } from '../services/groqService';
import {
  buildLiveNetworkSummary,
  buildRouteFallback,
  detectRouteRequest,
  formatDistance,
  formatTravelTime,
  GROQ_MODEL,
  CAMERA_LOCATIONS,
  getLoadColor,
} from '../shared/trafficData';
import useTrafficData from '../hooks/useTrafficData';
import { useAuth } from '../hooks/useAuth';
import SiteHeader from '../components/SiteHeader';
import AuthPromptModal from '../components/AuthPromptModal';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/* Route helpers */
async function geocodePlace(query, signal) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } });
  if (!response.ok) throw new Error('The geocoding service did not respond.');
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error(`I could not find "${query}" on the map.`);
  return { query, name: data[0].display_name, lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

function buildExternalMapLinks(origin, destination) {
  return [
    { label: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.name)}&destination=${encodeURIComponent(destination.name)}&travelmode=driving` },
    { label: 'Waze', href: `https://www.waze.com/ul?ll=${destination.lat}%2C${destination.lng}&navigate=yes` },
    { label: 'Apple Maps', href: `https://maps.apple.com/?saddr=${encodeURIComponent(origin.name)}&daddr=${encodeURIComponent(destination.name)}&dirflg=d` },
  ];
}

async function fetchGoogleRoute(routeRequest, signal) {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', routeRequest.origin);
  url.searchParams.set('destination', routeRequest.destination);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('units', 'metric');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) throw new Error('Google Maps routing service failed.');
  const payload = await response.json();
  if (payload.status !== 'OK' || !Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw new Error(payload.error_message || payload.status || 'No route returned from Google Maps.');
  }
  const primaryRoute = payload.routes[0];
  const leg = primaryRoute.legs?.[0];
  if (!leg) throw new Error('No route leg was returned from Google Maps.');
  const alternatives = payload.routes.slice(1, 3).map((route, index) => {
    const altLeg = route.legs?.[0];
    return altLeg ? `${index + 1}. ${formatTravelTime(altLeg.duration.value / 60)} for ${formatDistance(altLeg.distance.value / 1000)}` : `Alternative ${index + 1}`;
  });
  return { source: 'Google Maps Directions', distanceKm: leg.distance.value / 1000, durationMin: leg.duration.value / 60, alternatives };
}

async function fetchOsmRoute(origin, destination, signal) {
  const routeUrl = new URL(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`);
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('alternatives', 'true');
  routeUrl.searchParams.set('steps', 'false');
  const response = await fetch(routeUrl, { signal });
  if (!response.ok) throw new Error('The routing service is temporarily unavailable.');
  const payload = await response.json();
  if (!Array.isArray(payload.routes) || payload.routes.length === 0) throw new Error('No drivable route was returned.');
  const primaryRoute = payload.routes[0];
  const alternatives = payload.routes.slice(1, 3).map((route, index) => `${index + 1}. ${formatTravelTime(route.duration / 60)} for ${formatDistance(route.distance / 1000)}`);
  return { source: 'OpenStreetMap + OSRM', distanceKm: primaryRoute.distance / 1000, durationMin: primaryRoute.duration / 60, alternatives };
}

async function fetchRouteContext(routeRequest) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const [origin, destination] = await Promise.all([
      geocodePlace(routeRequest.origin, controller.signal),
      geocodePlace(routeRequest.destination, controller.signal),
    ]);
    let routeData;
    if (GOOGLE_MAPS_API_KEY) {
      try { routeData = await fetchGoogleRoute(routeRequest, controller.signal); } catch (e) { console.warn('GMaps route failed, fallback OSRM.', e); }
    }
    if (!routeData) routeData = await fetchOsmRoute(origin, destination, controller.signal);
    return { ok: true, source: routeData.source, origin, destination, distanceKm: routeData.distanceKm, durationMin: routeData.durationMin, alternatives: routeData.alternatives, links: buildExternalMapLinks(origin, destination) };
  } catch (error) {
    return { ok: false, error: error?.message || 'I could not resolve that route right now.' };
  } finally { window.clearTimeout(timeoutId); }
}

async function getAssistantReply({ message, history, liveSummary, routeContext }) {
  const fallbackContent = buildRouteFallback(routeContext, liveSummary);
  if (!groq) {
    return { content: fallbackContent, links: routeContext?.ok ? routeContext.links : [], source: routeContext?.ok ? routeContext.source : 'Local fallback' };
  }
  const conversation = history.slice(-6).map((item) => ({ role: item.role, content: item.content }));
  const routeSummary = routeContext?.ok
    ? `Route estimate source: ${routeContext.source}. Origin: ${routeContext.origin.name}. Destination: ${routeContext.destination.name}. Distance: ${formatDistance(routeContext.distanceKm)}. Duration: ${formatTravelTime(routeContext.durationMin)}. Alternatives: ${routeContext.alternatives.join(' | ') || 'none'}.`
    : routeContext?.error ? `Route lookup failed: ${routeContext.error}` : 'No explicit place-to-place route request detected.';
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.35,
      max_completion_tokens: 420,
      messages: [
        { role: 'system', content: 'You are the SEMAFORI traffic command assistant. Give practical traffic advice. If route data is provided, use it directly. Keep answers concise, mention the route source when route data exists, and never claim live data from Google Maps, Waze, or Apple Maps unless you only provide launch links for them.' },
        { role: 'user', content: `${liveSummary}\n${routeSummary}\nUser request: ${message}` },
        ...conversation,
      ],
    });
    return { content: completion.choices[0]?.message?.content?.trim() || fallbackContent, links: routeContext?.ok ? routeContext.links : [], source: routeContext?.ok ? routeContext.source : 'Groq' };
  } catch (error) {
    console.error('Traffic AI error:', error);
    return { content: fallbackContent, links: routeContext?.ok ? routeContext.links : [], source: routeContext?.ok ? routeContext.source : 'Local fallback' };
  }
}

const quickPrompts = [
  'How is traffic near Pejton right now?',
  'Which camera is the busiest right now?',
  'Give me a route from Prishtine to Ferizaj.',
];

const AIChatPage = () => {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuth();
  const {
    loads,
    counts,
    networkCongestion,
    avgConfidence,
    directionToday,
    peaks,
  } = useTrafficData();
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 'assistant-welcome', role: 'assistant', content: 'Ask me about congestion, junction priorities, or a route in the format "from A to B". I answer with live counts from the four Prishtina cameras and can add launch links for Google Maps, Waze, and Apple Maps.', links: [], source: 'SEMAFORI AI', timestamp: new Date() },
  ]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [sessionStart] = useState(new Date());
  const [sessionTime, setSessionTime] = useState('0:00');

  /* Session timer */
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
      setSessionTime(`${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);
  /* Load chat history from Supabase */
  useEffect(() => {
    if (!user) return;
    supabase.from('ai_chat_history').select('messages').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data && data.messages && Array.isArray(data.messages)) {
          setChatHistory(data.messages);
        }
      }).catch(() => {});
  }, [user]);

  
  const persistHistory = (msgs) => {
    if (!user) return;
    const newPairs = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user' && msgs[i+1] && msgs[i+1].role === 'assistant') {
        newPairs.push({
          id: msgs[i].id, role: 'user', content: msgs[i].content, timestamp: msgs[i].timestamp,
          reply: { role: 'assistant', content: msgs[i+1].content, links: msgs[i+1].links || [], source: msgs[i+1].source || 'SEMAFORI AI', timestamp: msgs[i+1].timestamp }
        });
        i++;
      }
    }
    setChatHistory((prev) => {
      const existingIds = new Set(newPairs.map(p => p.id));
      const merged = [...prev.filter(p => !existingIds.has(p.id)), ...newPairs];
      supabase.from('ai_chat_history').upsert({ user_id: user.id, messages: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(() => {}).catch((e) => console.error('History save failed:', e));
      return merged;
    });
  };

  const restoreHistory = (pair, allPairs) => {
    const idx = allPairs.indexOf(pair);
    const msgs = [{ id: 'assistant-welcome', role: 'assistant', content: 'Ask me about congestion, junction priorities, or a route in the format "from A to B". I answer with live counts from the four Prishtina cameras and can add launch links for Google Maps, Waze, and Apple Maps.', links: [], source: 'SEMAFORI AI', timestamp: new Date() }];
    for (let i = 0; i <= idx; i++) {
      const p = allPairs[i];
      msgs.push({ id: p.id || Date.now().toString(), role: 'user', content: p.content, timestamp: new Date(p.timestamp) });
      if (p.reply) msgs.push({ id: (Date.now()+1).toString(), role: 'assistant', content: p.reply.content || '', links: p.reply.links || [], source: p.reply.source || 'SEMAFORI AI', timestamp: new Date(p.reply.timestamp) });
    }
    setMessages(msgs);
    setHistoryOpen(false);
  };

  const deleteHistoryPair = (pair) => {
    const updated = chatHistory.filter(p => p !== pair);
    setChatHistory(updated);
    if (user) supabase.from('ai_chat_history').upsert({ user_id: user.id, messages: updated, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(() => {}).catch(() => {});
  };


  /* Supabase snapshots replaced by useTrafficData (loads) */

  /* Stats come from useTrafficData; no simulation intervals remain. */

  /* Scroll on new messages */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  /* Focus input on mount */
  useEffect(() => {
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 800);
  }, []);

  /* Restore the message a guest drafted before being asked to log in */
  useEffect(() => {
    const draft = sessionStorage.getItem('semafori_chat_draft');
    if (draft) {
      setInput(draft);
      sessionStorage.removeItem('semafori_chat_draft');
    }
  }, []);

  const handleSend = async (presetValue) => {
    const nextInput = (presetValue ?? input).trim();
    if (!nextInput || typing) return;
    /* Chatting requires an account — guests are sent through the existing
       login flow and returned here; the drafted message is preserved. */
    if (!user) {
      sessionStorage.setItem('semafori_chat_draft', nextInput);
      setAuthPromptOpen(true);
      return;
    }
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: nextInput, links: [], timestamp: new Date() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setTyping(true);
    try {
      const routeRequest = detectRouteRequest(nextInput);
      const routeContext = routeRequest ? await fetchRouteContext(routeRequest) : null;
      const reply = await getAssistantReply({ message: nextInput, history, liveSummary, routeContext });
      const updated = [...history, { id: `assistant-${Date.now()}`, role: 'assistant', content: reply.content, links: reply.links, source: reply.source, timestamp: new Date() }]; setMessages(updated); setTimeout(() => persistHistory(updated), 100);
    } finally { setTyping(false); }
  };

  const formatContent = (text) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const liveSummary = buildLiveNetworkSummary(loads, counts);
  const networkVehicles = loads.reduce((s, l) => s + (Number(l.vehicle_count) || 0), 0);
  const ci = networkCongestion;
  const confPct = avgConfidence != null ? Math.round(avgConfidence * 100) : null;
  const peakTimeLabel = peaks
    ? new Date(peaks.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const peakCamLabel = peaks
    ? (peaks.camera_name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

  return (
    <div className="theme-cockpit h-screen flex flex-col overflow-hidden" style={{ color: 'var(--app-fg)' }}>
      <style>{`
        .glass-card { background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--card-border); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset; }
        .glass-card:hover { background: var(--card-bg-hover); border-color: var(--card-border-hover); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
        .progress-track { background: var(--track-bg); border-radius: 9999px; overflow: hidden; height: 4px; }
        .progress-fill { height: 100%; border-radius: 9999px; transition: width 1s cubic-bezier(0.16,1,0.3,1); }
        .msg-user { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.15); }
        .msg-ai { background: var(--card-bg); border: 1px solid var(--card-border); }
        .input-area { background: var(--input-bg); backdrop-filter: blur(10px); border: 1px solid var(--input-border); transition: border-color 0.3s ease, box-shadow 0.3s ease; }
        .input-area:focus-within { border-color: rgba(249,115,22,0.3); box-shadow: 0 0 20px -5px rgba(249,115,22,0.1); }
        .suggestion-chip { background: var(--chip-bg); border: 1px solid var(--card-border); transition: all 0.3s ease; cursor: pointer; }
        .suggestion-chip:hover { background: rgba(249,115,22,0.08); border-color: rgba(249,115,22,0.2); transform: translateY(-1px); }
        .typing-dot { width: 5px; height: 5px; border-radius: 9999px; background: #71717a; animation: typingBounce 1.4s ease-in-out infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.5); opacity: 0; } }
        .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1 { animation-delay: 0.05s; opacity: 0; } .d2 { animation-delay: 0.1s; opacity: 0; }
        .d3 { animation-delay: 0.15s; opacity: 0; } .d4 { animation-delay: 0.2s; opacity: 0; }
        .d5 { animation-delay: 0.25s; opacity: 0; } .d6 { animation-delay: 0.3s; opacity: 0; }
        .msg-in { animation: msgIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        .status-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 9999px; background: #4ade80; animation: pulseRing 2s cubic-bezier(0.215,0.61,0.355,1) infinite; }
        .bg-glow { position: fixed; border-radius: 9999px; filter: blur(120px); opacity: 0.05; pointer-events: none; z-index: -10; }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
      `}</style>

      <div className="bg-glow" style={{ top: '-100px', left: '200px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-150px', right: '-50px', width: '400px', height: '400px', background: '#3b82f6' }} />

      <SiteHeader />

      <main className="pt-16 flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex overflow-hidden relative">

          {/* Left: Chat Area */}
            {/* History sidebar */}
            {historyOpen && (
              <div className="absolute left-0 top-0 bottom-0 w-[280px] z-30 border-r border-white/[0.06] flex flex-col" style={{ background: 'var(--app-bg)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">History</span>
                  <button onClick={() => setHistoryOpen(false)} className="p-1 rounded hover:bg-white/5"><iconify-icon icon="lucide:x" width="14" className="text-zinc-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto chat-scroll p-3 space-y-1.5">
                  {chatHistory.length === 0 ? (
                    <p className="text-[11px] text-zinc-600 text-center py-8">No saved conversations yet.<br />Start chatting to save history.</p>
                  ) : chatHistory.map((pair, i) => (
                    <div key={pair.id || i} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                      <button onClick={() => restoreHistory(pair, chatHistory)} className="flex-1 text-left min-w-0">
                        <div className="text-[11px] text-zinc-300 truncate">{pair.content.slice(0, 50)}{pair.content.length > 50 ? '...' : ''}</div>
                        <div className="text-[9px] text-zinc-600 mt-0.5">{pair.timestamp ? new Date(pair.timestamp).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}</div>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteHistoryPair(pair); }} className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-zinc-600 transition-all"><iconify-icon icon="lucide:trash-2" width="11" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className={`flex-1 flex flex-col min-w-0 relative anim d1 transition-all ${historyOpen ? 'ml-[280px]' : ''}`}>

            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/50">
              <div className="flex items-center gap-1.5">
                <img src="/AIlogo.png" alt="SEMAFORI AI" className="w-7 h-7 rounded-md object-contain" />
                <button onClick={() => setHistoryOpen((v) => !v)} className={`p-2 rounded-lg transition-colors ${historyOpen ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-500 hover:bg-white/5'}`} title="Chat history">
                  <iconify-icon icon="lucide:clock" width="16" />
                </button>
                <button className="p-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5" title="New chat" onClick={() => { setMessages([{ id: 'assistant-welcome', role: 'assistant', content: 'Ask me about congestion, junction priorities, or a route in the format \"from A to B\".', links: [], source: 'SEMAFORI AI', timestamp: new Date() }]); setHistoryOpen(false); }}>
                  <iconify-icon icon="lucide:plus" width="16" className="text-zinc-400" />
                  <span className="text-[11px] text-zinc-400">New chat</span>
                </button>
              </div>
              <button onClick={() => setShowMetrics((v) => !v)} className={`p-1.5 rounded-lg transition-colors ${showMetrics ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-500 hover:bg-white/5'}`} title="Toggle traffic metrics">
                <iconify-icon icon="lucide:bar-chart-3" width="14" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-4">
              <div className="flex justify-center msg-in">
                <div className="px-3 py-1.5 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-[10px] text-zinc-500 font-medium">
                  Session started at {sessionStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} • Groq {GROQ_MODEL}
                </div>
              </div>

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} msg-in`}>
                  <div className={message.role === 'user' ? 'max-w-[75%]' : 'max-w-[80%]'}>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <img src="/AIlogo.png" alt="AI" className="w-5 h-5 rounded-md object-contain" />
                        <span className="text-[10px] font-medium text-zinc-500">{message.source || 'SEMAFORI AI'}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">{message.timestamp?.toLocaleTimeString?.('en-US', { hour12: false }) || ''}</span>
                      </div>
                    )}
                    <div className={message.role === 'user' ? 'msg-user rounded-2xl rounded-tr-md px-4 py-3' : 'msg-ai rounded-2xl rounded-tl-md px-4 py-3'}>
                      <p className="text-[13px] font-light leading-relaxed text-zinc-300">
                        {message.role === 'user' ? <span className="text-white">{formatContent(message.content)}</span> : formatContent(message.content)}
                      </p>
                    </div>
                    {message.links?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pl-1">
                        {message.links.map((link) => (
                          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium bg-tblue-500/10 border border-tblue-500/20 text-tblue-300 hover:bg-tblue-500/20 transition-colors">
                            Open in {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                    {message.role === 'user' && (
                      <div className="flex items-center justify-end gap-2 mt-1.5 pr-1">
                        <span className="text-[9px] text-zinc-600 font-mono">{message.timestamp?.toLocaleTimeString?.('en-US', { hour12: false }) || ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex justify-start msg-in">
                  <div className="msg-ai rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-3">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                      <iconify-icon icon="lucide:sparkles" width="10" className="text-white keep-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="px-5 pb-2">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => handleSend(prompt)} className="suggestion-chip rounded-xl px-3 py-2 text-[11px] text-zinc-400 font-light">{prompt}</button>
                ))}
              </div>
            </div>

            {/* Guest notice — chatting requires an account */}
            {!user && (
              <div className="px-5 pb-2">
                <div className="auth-hint">
                  <iconify-icon icon="lucide:lock" width="12" className="flex-shrink-0" />
                  <span>You are browsing as a guest — log in to send messages. Your draft will be kept.</span>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-5 pb-4 pt-1">
              <div className="input-area rounded-2xl p-3 flex items-end gap-3">
                <button className="p-2 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0 mb-0.5">
                  <iconify-icon icon="lucide:paperclip" width="16" className="text-zinc-500" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows="1"
                  placeholder="Ask about traffic, routes, or congestion..."
                  className="bg-transparent outline-none resize-none text-[13px] font-light leading-relaxed w-full placeholder:text-zinc-600 text-white"
                />
                <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || typing}
                    className="p-2 rounded-lg bg-white text-black hover:scale-105 active:scale-[0.98] transition-all duration-300 disabled:opacity-30 disabled:hover:scale-100"
                    style={{ boxShadow: '0 0 20px -5px rgba(255,255,255,0.2)' }}
                  >
                    <iconify-icon icon="lucide:arrow-up" width="16" />
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-zinc-600 text-center mt-2">SEMAFORI AI can make mistakes. Verify important traffic information.</p>
            </div>
          </div>

          {/* Right: Traffic Stats */}
          {showMetrics && (
          <div className="hidden lg:flex flex-col w-[320px] xl:w-[360px] border-l border-zinc-800/50 overflow-y-auto chat-scroll">
            {/* Top Metrics */}
            <div className="p-4 space-y-3 anim d2">
              <div className="flex items-center gap-2 mb-1">
                <iconify-icon icon="lucide:activity" width="14" className="text-zinc-500" />
                <span className="stat-label">Traffic Metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Vehicles now</div>
                  <div className="text-lg font-semibold">{networkVehicles.toLocaleString()}</div>
                </div>
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Detection conf.</div>
                  <div className="text-lg font-semibold">{confPct != null ? confPct : '—'}<span className="text-xs text-zinc-500 ml-0.5">%</span></div>
                </div>
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Congestion</div>
                  <div className="text-lg font-semibold">{ci}<span className="text-xs text-zinc-500 ml-0.5">%</span></div>
                </div>
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Session</div>
                  <div className="text-lg font-semibold">{sessionTime}</div>
                </div>
              </div>
            </div>

            {/* Congestion Bar */}
            <div className="px-4 pb-4 anim d3">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="stat-label">Congestion Index</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{ci}%</span>
                </div>
                <div className="progress-track mb-3">
                  <div className="progress-fill" style={{ width: `${ci}%`, background: 'linear-gradient(to right, #4ade80, #facc15, #f97316)' }} />
                </div>
              </div>
            </div>

            {/* Line Crossings Today — real in/out from the counting lines */}
            {directionToday.hasData && (
              <div className="px-4 pb-4 anim d4">
                <div className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <iconify-icon icon="lucide:compass" width="14" className="text-zinc-500" />
                    <span className="stat-label">Line Crossings Today</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Inbound', icon: 'lucide:arrow-down-right', val: directionToday.in, color: 'bg-orange-500' },
                      { label: 'Outbound', icon: 'lucide:arrow-up-right', val: directionToday.out, color: 'bg-blue-500' },
                    ].map(d => (
                      <div key={d.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <iconify-icon icon={d.icon} width="12" className="text-zinc-500" /> {d.label}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-300">{d.val}</span>
                        </div>
                        <div className="progress-track"><div className={`progress-fill ${d.color}`} style={{ width: `${Math.min((d.val / Math.max(directionToday.in, directionToday.out, 1)) * 100, 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Peak — last 24h (real) */}
            <div className="px-4 pb-4 anim d5">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:trending-up" width="14" className="text-zinc-500" />
                  <span className="stat-label">Peak — last 24h</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-semibold">{peaks ? peaks.count : '—'}</span>
                  <span className="text-xs text-zinc-500">vehicles in one cycle</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="lucide:clock" width="12" className="text-zinc-600" />
                    {peakTimeLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="lucide:video" width="12" className="text-zinc-600" />
                    {peakCamLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Cameras Status */}
            <div className="px-4 pb-4 anim d6">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:video" width="14" className="text-zinc-500" />
                  <span className="stat-label">Camera Load</span>
                </div>
                <div className="space-y-2">
                  {CAMERA_LOCATIONS.map((cam) => {
                    const load = loads.find((s) => s.camera_id === cam.id) || {};
                    const level = load.load_level || 'low';
                    const color = getLoadColor(level);
                    const name = (cam.name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div key={cam.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[11px] text-zinc-400">{name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">{load.vehicle_count ?? '—'} • {Number(load.rolling_rate) || 0}/cyc</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Session Info */}
            <div className="px-4 pb-6 anim d6">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:info" width="14" className="text-zinc-500" />
                  <span className="stat-label">Assistant Info</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-zinc-500">Model</span><span className="text-zinc-300 font-mono">Groq {GROQ_MODEL}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Messages</span><span className="text-zinc-300 font-mono">{messages.length}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Routes</span><span className="text-zinc-300 font-mono">OSM + OSRM</span></div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Login prompt — shown when a guest tries to send a message */}
      <AuthPromptModal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        from="/ai-chat"
        message="You need to log in or sign up to chat with the AI assistant. Your message is saved and will be waiting for you when you get back."
      />
    </div>
  );
};

export default AIChatPage;
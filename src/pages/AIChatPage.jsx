import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { groq } from '../services/groqService';
import { supabase } from '../services/supabaseClient';
import {
  baseTrafficMarkers,
  buildRouteFallback,
  buildTrafficSummary,
  detectRouteRequest,
  formatDistance,
  formatTravelTime,
  GROQ_MODEL,
  CAMERA_LOCATIONS,
  getLoadColor,
} from '../shared/trafficData';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function rng(min, max) { return min + Math.random() * (max - min); }

/* ── Route helpers ── */
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

async function getAssistantReply({ message, history, markers, routeContext }) {
  const fallbackContent = buildRouteFallback(routeContext, markers);
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
        { role: 'user', content: `${buildTrafficSummary(markers)}\n${routeSummary}\nUser request: ${message}` },
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
  'How bad is traffic near Bill Clinton Boulevard right now?',
  'Give me a route from Prishtine to Ferizaj.',
  'Which intersection should be prioritized for signal tuning?',
];

const AIChatPage = () => {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const allTrafficMarkers = useMemo(() => baseTrafficMarkers, []);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 'assistant-welcome', role: 'assistant', content: 'Ask me about congestion, junction priorities, or a route in the format "from A to B". I can estimate the drive and add launch links for Google Maps, Waze, and Apple Maps.', links: [], source: 'SEMAFORI AI', timestamp: new Date() },
  ]);
  const [clock, setClock] = useState('');
  const [sessionStart] = useState(new Date());
  const [sessionTime, setSessionTime] = useState('0:00');
  const [snapshots, setSnapshots] = useState([]);

  // Stats
  const [vehicles, setVehicles] = useState(1247);
  const [speed, setSpeed] = useState(34);
  const [congestion, setCongestion] = useState(62);
  const [waitTime, setWaitTime] = useState(42);
  const [dirN, setDirN] = useState(384);
  const [dirS, setDirS] = useState(312);
  const [dirE, setDirE] = useState(298);
  const [dirW, setDirW] = useState(253);

  /* Clock & session timer */
  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
      const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
      setSessionTime(`${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  /* Supabase snapshots */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const result = await supabase.from('traffic_load').select('*').order('camera_id', { ascending: true });
        if (!result.error) setSnapshots(result.data || []);
      } catch { /* ignore */ }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  /* Stats simulation */
  useEffect(() => {
    const id = setInterval(() => {
      setVehicles(v => Math.max(1100, Math.min(1400, v + Math.floor(rng(-5, 10)))));
      setSpeed(s => Math.max(18, Math.min(52, s + rng(-2.5, 2))));
      setCongestion(c => Math.max(20, Math.min(95, c + rng(-3, 3))));
      setWaitTime(w => Math.max(15, Math.min(75, w + rng(-3, 3))));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  /* Direction counts */
  useEffect(() => {
    const id = setInterval(() => {
      setDirN(Math.round(vehicles * rng(0.26, 0.32)));
      setDirS(Math.round(vehicles * rng(0.22, 0.28)));
      setDirE(Math.round(vehicles * rng(0.20, 0.26)));
      setDirW(vehicles - dirN - dirS - dirE || 250);
    }, 3000);
    return () => clearInterval(id);
  }, [vehicles, dirN, dirS, dirE]);

  /* Scroll on new messages */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  /* Focus input on mount */
  useEffect(() => {
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 800);
  }, []);

  const handleSend = async (presetValue) => {
    const nextInput = (presetValue ?? input).trim();
    if (!nextInput || typing) return;
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: nextInput, links: [], timestamp: new Date() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setTyping(true);
    try {
      const routeRequest = detectRouteRequest(nextInput);
      const routeContext = routeRequest ? await fetchRouteContext(routeRequest) : null;
      const reply = await getAssistantReply({ message: nextInput, history, markers: allTrafficMarkers, routeContext });
      setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: reply.content, links: reply.links, source: reply.source, timestamp: new Date() }]);
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

  const ci = Math.round(congestion);
  const nsWait = Math.round(waitTime * 0.9);
  const ewWait = Math.round(waitTime * 1.12);

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .glass-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
        .progress-track { background: rgba(255,255,255,0.06); border-radius: 9999px; overflow: hidden; height: 4px; }
        .progress-fill { height: 100%; border-radius: 9999px; transition: width 1s cubic-bezier(0.16,1,0.3,1); }
        .msg-user { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.15); }
        .msg-ai { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .input-area { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.3s ease, box-shadow 0.3s ease; }
        .input-area:focus-within { border-color: rgba(249,115,22,0.3); box-shadow: 0 0 20px -5px rgba(249,115,22,0.1); }
        .suggestion-chip { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); transition: all 0.3s ease; cursor: pointer; }
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

      <main className="pt-14 h-screen flex flex-col">
        <div className="flex-1 flex overflow-hidden">

          {/* ══════════ LEFT: Chat Area ══════════ */}
          <div className="flex-1 flex flex-col min-w-0 anim d1">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center">
                  <iconify-icon icon="lucide:sparkles" width="16" className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">SEMAFORI AI</h2>
                  <p className="text-[10px] text-zinc-500">Traffic + route guidance · Groq {GROQ_MODEL}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Clear chat" onClick={() => setMessages([{ id: 'assistant-welcome', role: 'assistant', content: 'Ask me about congestion, junction priorities, or a route in the format "from A to B".', links: [], source: 'SEMAFORI AI', timestamp: new Date() }])}>
                  <iconify-icon icon="lucide:trash-2" width="16" className="text-zinc-500" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-4">
              <div className="flex justify-center msg-in">
                <div className="px-3 py-1.5 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-[10px] text-zinc-500 font-medium">
                  Session started · {sessionStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} · Groq {GROQ_MODEL}
                </div>
              </div>

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} msg-in`}>
                  <div className={message.role === 'user' ? 'max-w-[75%]' : 'max-w-[80%]'}>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                          <iconify-icon icon="lucide:sparkles" width="10" className="text-white" />
                        </div>
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
                      <iconify-icon icon="lucide:sparkles" width="10" className="text-white" />
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

          {/* ══════════ RIGHT: Traffic Stats ══════════ */}
          <div className="hidden lg:flex flex-col w-[320px] xl:w-[360px] border-l border-zinc-800/50 overflow-y-auto chat-scroll">
            {/* Top Metrics */}
            <div className="p-4 space-y-3 anim d2">
              <div className="flex items-center gap-2 mb-1">
                <iconify-icon icon="lucide:activity" width="14" className="text-zinc-500" />
                <span className="stat-label">Traffic Metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Vehicles/hr</div>
                  <div className="text-lg font-semibold">{Math.round(vehicles).toLocaleString()}</div>
                </div>
                <div className="glass-card rounded-xl p-3">
                  <div className="stat-label mb-1">Avg Speed</div>
                  <div className="text-lg font-semibold">{Math.round(speed)}<span className="text-xs text-zinc-500 ml-0.5">km/h</span></div>
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

            {/* Direction Breakdown */}
            <div className="px-4 pb-4 anim d4">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:compass" width="14" className="text-zinc-500" />
                  <span className="stat-label">By Direction</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Northbound', icon: 'lucide:arrow-up', val: dirN, color: 'bg-orange-500' },
                    { label: 'Southbound', icon: 'lucide:arrow-down', val: dirS, color: 'bg-blue-500' },
                    { label: 'Eastbound', icon: 'lucide:arrow-right', val: dirE, color: 'bg-emerald-500' },
                    { label: 'Westbound', icon: 'lucide:arrow-left', val: dirW, color: 'bg-fuchsia-500' },
                  ].map(d => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                          <iconify-icon icon={d.icon} width="12" className="text-zinc-500" /> {d.label}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-300">{d.val}</span>
                      </div>
                      <div className="progress-track"><div className={`progress-fill ${d.color}`} style={{ width: `${Math.min((d.val / (vehicles || 500)) * 300, 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Avg Wait Time */}
            <div className="px-4 pb-4 anim d5">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:clock" width="14" className="text-zinc-500" />
                  <span className="stat-label">Avg Wait Time</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-semibold">{Math.round(waitTime)}</span>
                  <span className="text-xs text-zinc-500">seconds</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500">N-S</span>
                  <span className="text-[10px] font-mono text-zinc-300">{nsWait}s</span>
                </div>
                <div className="progress-track mb-2"><div className="progress-fill bg-orange-500" style={{ width: `${(nsWait / 80) * 100}%` }} /></div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500">E-W</span>
                  <span className="text-[10px] font-mono text-zinc-300">{ewWait}s</span>
                </div>
                <div className="progress-track"><div className="progress-fill bg-blue-500" style={{ width: `${(ewWait / 80) * 100}%` }} /></div>
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
                    const load = snapshots.find((s) => s.camera_id === cam.id) || {};
                    const level = load.load_level || 'low';
                    const color = getLoadColor(level);
                    const name = (cam.name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div key={cam.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[11px] text-zinc-400">{name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">{load.vehicle_count ?? '—'}</span>
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
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default AIChatPage;
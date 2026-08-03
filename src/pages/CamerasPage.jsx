import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { CAMERA_FEEDS, CAMERA_LOCATIONS, getLoadColor } from '../shared/trafficData';
import { snapshotUrl } from '../shared/snapshots';
import usePipelineHealth from '../hooks/usePipelineHealth';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/* ── Helpers ── */
function rng(min, max) { return min + Math.random() * (max - min); }

const PHASES = ['ns-green', 'ns-yellow', 'ew-green', 'ew-yellow'];
const PHASE_DURATIONS = [50, 5, 45, 5];
const PHASE_COLORS = {
  'ns-green':  { dot: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', fill: 'bg-emerald-500' },
  'ns-yellow': { dot: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/10', fill: 'bg-yellow-500' },
  'ew-green':  { dot: 'bg-blue-500',   text: 'text-blue-400',   border: 'border-blue-500/20',   bg: 'bg-blue-500/10',   fill: 'bg-blue-500' },
  'ew-yellow': { dot: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/10', fill: 'bg-yellow-500' },
};

const THROUGHPUT_DATA = [
  { v: 180, lv: 160 }, { v: 420, lv: 390 }, { v: 680, lv: 710 }, { v: 920, lv: 880 },
  { v: 760, lv: 730 }, { v: 640, lv: 610 }, { v: 710, lv: 690 }, { v: 780, lv: 750 },
  { v: 830, lv: 800 }, { v: 890, lv: 860 }, { v: 960, lv: 920 }, { v: 1080, lv: 1020 },
  { v: 1040, lv: 980 }, { v: 820, lv: 790 }, { v: 580, lv: 560 }, { v: 390, lv: 370 },
];
const MAX_THROUGHPUT = Math.max(...THROUGHPUT_DATA.flatMap(d => [d.v, d.lv]));

const INITIAL_INCIDENTS = [
  { id: 1, title: 'Fender bender — southbound', time: '14:32', status: 'Lane partially blocked', severity: 'high' },
  { id: 2, title: 'Signal malfunction — east approach', time: '11:47', status: 'Resolved', severity: 'mid' },
  { id: 3, title: 'Stalled vehicle — westbound', time: '09:15', status: 'Cleared', severity: 'low' },
  { id: 4, title: 'Pedestrian crossing violation', time: '08:22', status: 'No action needed', severity: 'low' },
];

/* ── Sparkline ── */
function Sparkline({ count, seed }) {
  const bars = useMemo(() => Array.from({ length: count }, (_, i) => {
    const seeded = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    return { key: i, h: seeded * 16 + 4 };
  }), [count, seed]);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const id = setInterval(() => {
      const children = ref.current.children;
      for (let i = 0; i < children.length - 1; i++) children[i].style.height = children[i + 1].style.height;
      children[children.length - 1].style.height = (Math.random() * 16 + 4) + 'px';
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div ref={ref} className="flex items-end gap-[2px] h-6 mt-3">
      {bars.map(b => (
        <div key={b.key} className="mini-bar" style={{ height: b.h + 'px', width: '3px', background: 'rgba(249,115,22,0.35)', borderRadius: '1.5px', minWidth: '3px', transition: 'height 0.5s ease' }} />
      ))}
    </div>
  );
}

/* ── Throughput Chart ── */
function ThroughputChart() {
  return (
    <div className="flex items-end gap-[6px] h-32">
      {THROUGHPUT_DATA.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-[2px]">
          <div className="w-full rounded-sm" style={{ height: (d.lv / MAX_THROUGHPUT * 100) + '%', background: 'rgba(255,255,255,0.04)', minHeight: '2px' }} />
          <div className="w-full rounded-sm" style={{ height: (d.v / MAX_THROUGHPUT * 100) + '%', background: d.v >= 900 ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.3)', minHeight: '2px', marginTop: '-' + (d.lv / MAX_THROUGHPUT * 100) + '%' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Pipeline status badge: LIVE / STALE Xm / OFFLINE ── */
function pipelineBadge(camId, health, online) {
  if (!online) return { label: 'OFFLINE', cls: 'text-zinc-500' };
  const cam = health?.cameras?.[camId];
  if (!cam?.last_success_utc) return { label: 'NO DATA', cls: 'text-zinc-500' };
  const ageMin = Math.floor((Date.now() - new Date(cam.last_success_utc).getTime()) / 60000);
  if (ageMin < 10) return { label: 'LIVE', cls: 'text-emerald-400' };
  return { label: `STALE ${ageMin}m`, cls: 'text-amber-400' };
}

const CamerasPage = () => {
  const { health: pipelineHealth, online: pipelineOnline } = usePipelineHealth();
  const [selectedCamera, setSelectedCamera] = useState(
    CAMERA_FEEDS.find((c) => c.id === 'c003') || CAMERA_FEEDS[0],
  );
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [camTimestamp, setCamTimestamp] = useState('');
  const [latency, setLatency] = useState(12);
  const [vehicles, setVehicles] = useState(1247);
  const [speed, setSpeed] = useState(34);
  const [congestion, setCongestion] = useState(62);
  const [waitTime, setWaitTime] = useState(42);
  const [dirN, setDirN] = useState(384);
  const [dirS, setDirS] = useState(312);
  const [dirE, setDirE] = useState(298);
  const [dirW, setDirW] = useState(253);
  const [snapshots, setSnapshots] = useState([]);
  const [snapTick, setSnapTick] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(PHASE_DURATIONS[0]);

  /* ── Clock ── */
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const ts = now.toLocaleTimeString('en-US', { hour12: false });
      setCamTimestamp(ts + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2));
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ── Latency ── */
  useEffect(() => {
    const id = setInterval(() => setLatency(8 + Math.floor(Math.random() * 12)), 2000);
    return () => clearInterval(id);
  }, []);

  /* ── Signal phase ── */
  useEffect(() => {
    const id = setInterval(() => {
      setPhaseLeft(prev => {
        if (prev <= 0) return PHASE_DURATIONS[(phaseIdx + 1) % PHASES.length];
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phaseIdx]);
  useEffect(() => {
    if (phaseLeft <= 0) setPhaseIdx(prev => (prev + 1) % PHASES.length);
  }, [phaseLeft]);

  /* ── Snapshots ── */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const result = await supabase
          .from('traffic_load')
          .select('*')
          .order('camera_id', { ascending: true });
        if (!result.error) setSnapshots(result.data || []);
      } catch { /* ignore */ }
    };
    fetchAll();
    const interval = setInterval(() => { fetchAll(); setSnapTick(Math.random()); }, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── Stats ── */
  useEffect(() => {
    const id = setInterval(() => {
      setVehicles(v => Math.max(1100, Math.min(1400, v + Math.floor(rng(-5, 10)))));
      setSpeed(s => Math.max(18, Math.min(52, s + rng(-2.5, 2))));
      setCongestion(c => Math.max(20, Math.min(95, c + rng(-3, 3))));
      setWaitTime(w => Math.max(15, Math.min(75, w + rng(-3, 3))));
      setDirN(Math.round(vehicles * rng(0.26, 0.32)));
      setDirS(Math.round(vehicles * rng(0.22, 0.28)));
      setDirE(Math.round(vehicles * rng(0.20, 0.26)));
    }, 3000);
    return () => clearInterval(id);
  }, [vehicles]);

  const ci = Math.round(congestion);
  const congestionClass = ci < 40 ? 'congestion-low' : ci < 65 ? 'congestion-mid' : ci < 80 ? 'congestion-high' : 'congestion-severe';
  const phase = PHASES[phaseIdx];
  const pc = PHASE_COLORS[phase];
  const phasePct = (phaseLeft / PHASE_DURATIONS[phaseIdx]) * 100;
  const nsWait = Math.round(waitTime * 0.9);
  const ewWait = Math.round(waitTime * 1.12);

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .glass-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
        .stat-value { font-size: 22px; font-weight: 600; color: #fff; line-height: 1.2; }
        .progress-track { background: rgba(255,255,255,0.06); border-radius: 9999px; overflow: hidden; height: 4px; }
        .progress-fill { height: 100%; border-radius: 9999px; transition: width 1s cubic-bezier(0.16,1,0.3,1); }
        .incident-badge { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px; }
        .congestion-low { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.4); }
        .congestion-mid { background: #facc15; box-shadow: 0 0 6px rgba(250,204,21,0.4); }
        .congestion-high { background: #f97316; box-shadow: 0 0 6px rgba(249,115,22,0.4); }
        .congestion-severe { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.4); }
        .mini-bar { border-radius: 1.5px; min-width: 3px; transition: height 0.5s ease; }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1 { animation-delay: 0.05s; opacity: 0; } .d2 { animation-delay: 0.1s; opacity: 0; }
        .d3 { animation-delay: 0.15s; opacity: 0; } .d4 { animation-delay: 0.2s; opacity: 0; }
        .d5 { animation-delay: 0.25s; opacity: 0; } .d6 { animation-delay: 0.3s; opacity: 0; }
        .d7 { animation-delay: 0.35s; opacity: 0; }
        .live-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 9999px; background: #ef4444; animation: pulse-ring 1.5s cubic-bezier(0.215,0.61,0.355,1) infinite; }
        .scan-line { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(to right, transparent, rgba(249,115,22,0.4), transparent); animation: scan 3s linear infinite; pointer-events: none; z-index: 5; }
        .bg-glow { position: fixed; border-radius: 9999px; filter: blur(120px); opacity: 0.06; pointer-events: none; z-index: -10; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
      `}</style>

      {/* Background Glows */}
      <div className="bg-glow" style={{ top: '-100px', left: '100px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-100px', right: '-100px', width: '400px', height: '400px', background: '#ef4444' }} />

      <SiteHeader />

      <main className="pt-20 pb-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-6 anim d1">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-1.5">Prishtinë — Traffic Corridor</p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">Traffic Camera Center</h1>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <iconify-icon icon="lucide:map-pin" width="12" />
                <span>{selectedCamera.name} — Gjirafa Slow TV</span>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-12 gap-5">

            {/* LEFT: Camera Feeds */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4 anim d2">

              {/* Primary Camera — Gjirafa iframe */}
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}>
                <iframe
                  key={selectedCamera.id}
                  title={`Gjirafa ${selectedCamera.name} live`}
                  src={selectedCamera.url}
                  style={{ width: '100%', display: 'block', aspectRatio: '16/10', border: 0 }}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => setCameraStatus('ready')}
                  onError={() => setCameraStatus('error')}
                />
                <div className="scan-line" />

                {/* HUD */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-0 left-0 right-0 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[9px] font-mono text-red-400 font-semibold">REC</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/60 bg-black/40 px-1.5 py-0.5 rounded">{selectedCamera.name.toUpperCase()}</span>
                    </div>
                    <span className="text-[9px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded">{camTimestamp}</span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <div className="w-12 h-12 border border-white/30 rounded-full" />
                    <div className="absolute w-px h-6 bg-white/20" />
                    <div className="absolute w-6 h-px bg-white/20" />
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded">Gjirafa Slow TV</span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-black/40 px-1.5 py-0.5 rounded">{latency}ms</span>
                  </div>

                  {cameraStatus !== 'ready' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-sm text-white font-medium">
                        {cameraStatus === 'loading' ? 'Connecting…' : 'Feed unavailable'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2×2 Detection Snapshots */}
              <div className="grid grid-cols-2 gap-2">
                {CAMERA_LOCATIONS.map((cam) => {
                  const load = snapshots.find((s) => s.camera_id === cam.id) || {};
                  const level = load.load_level || 'low';
                  const color = getLoadColor(level);
                  const name = (cam.name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  const badge = pipelineBadge(cam.id, pipelineHealth, pipelineOnline);
                  return (
                    <div key={cam.id} className="relative group cursor-pointer"
                      style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000', aspectRatio: '16 / 10' }}
                      onClick={() => {
                        const feed = CAMERA_FEEDS.find((c) => c.id === cam.id);
                        if (feed) { setCameraStatus('loading'); setSelectedCamera(feed); }
                      }}
                    >
                      <img
                        src={snapshotUrl(cam.name, snapTick)}
                        alt={name}
                        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
                        onLoad={(e) => {
                          const sib = e.target.nextSibling;
                          if (sib && sib.textContent !== '') sib.style.display = 'none';
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const sib = e.target.nextSibling;
                          if (sib) sib.style.display = 'flex';
                        }}
                      />
                      <div className="absolute inset-0 items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-500 hidden">no snapshot</div>
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors pointer-events-none" />
                      <div className={`absolute top-1.5 left-1.5 text-[8px] font-mono bg-black/50 px-1 py-0.5 rounded ${badge.cls}`}>{badge.label}</div>
                      <div className="absolute bottom-1.5 left-1.5 text-[8px] font-mono text-white/50 bg-black/50 px-1 py-0.5 rounded">{name}</div>
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  );
                })}
              </div>

              {/* Signal Phase */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:traffic-cone" width="14" className="text-orange-400" />
                  <span className="stat-label">Signal Phase</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PHASES.map(p => {
                    const isActive = p === phase;
                    const c = PHASE_COLORS[p];
                    const labelMap = { 'ns-green': 'N-S Go', 'ns-yellow': 'N-S Wait', 'ew-green': 'E-W Go', 'ew-yellow': 'E-W Wait' };
                    return (
                      <div key={p} className={`text-center p-2 rounded-lg ${isActive ? c.bg + ' border ' + c.border : 'bg-zinc-800/50 border border-zinc-700/30'}`}>
                        <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${isActive ? c.dot : 'bg-zinc-600'}`} />
                        <span className={`text-[8px] font-medium uppercase ${isActive ? c.text : 'text-zinc-500'}`}>{labelMap[p]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Phase timer</span>
                  <span className={`text-sm font-mono font-semibold ${pc.text}`}>{phaseLeft}s</span>
                </div>
                <div className="progress-track mt-1.5">
                  <div className={`progress-fill ${pc.fill}`} style={{ width: `${phasePct}%` }} />
                </div>
              </div>
            </div>

            {/* RIGHT: Statistics */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">

              {/* 4 Key Metrics */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Vehicles / hr */}
                <div className="glass-card rounded-xl p-4 anim d3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:car" width="14" className="text-orange-400" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <iconify-icon icon="lucide:trending-up" width="10" /> +5.2%
                    </div>
                  </div>
                  <div className="stat-value">{Math.round(vehicles).toLocaleString()}</div>
                  <div className="stat-label mt-1">Vehicles / hr</div>
                  <Sparkline count={18} seed={1} />
                </div>

                {/* Avg Speed */}
                <div className="glass-card rounded-xl p-4 anim d4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:gauge" width="14" className="text-blue-400" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                      <iconify-icon icon="lucide:trending-down" width="10" /> -8.1%
                    </div>
                  </div>
                  <div className="stat-value">{Math.round(speed)}<span className="text-sm text-zinc-500 ml-1">km/h</span></div>
                  <div className="stat-label mt-1">Avg Speed</div>
                  <Sparkline count={18} seed={2} />
                </div>

                {/* Congestion */}
                <div className="glass-card rounded-xl p-4 anim d5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-yellow-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:alert-triangle" width="14" className="text-yellow-400" />
                    </div>
                    <div className={`congestion-indicator ${congestionClass}`} style={{ width: 8, height: 8, borderRadius: '9999px', flexShrink: 0 }} />
                  </div>
                  <div className="stat-value">{ci}<span className="text-sm text-zinc-500 ml-1">%</span></div>
                  <div className="stat-label mt-1">Congestion Index</div>
                  <div className="progress-track mt-3">
                    <div className="progress-fill" style={{ width: `${ci}%`, background: 'linear-gradient(to right, #4ade80, #facc15, #f97316)' }} />
                  </div>
                </div>

                {/* Incidents */}
                <div className="glass-card rounded-xl p-4 anim d6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:siren" width="14" className="text-red-400" />
                    </div>
                    <span className="incident-badge bg-red-500/15 text-red-400">1 Active</span>
                  </div>
                  <div className="stat-value">1</div>
                  <div className="stat-label mt-1">Incidents</div>
                  <div className="text-[10px] text-red-400/80 mt-2 truncate">Fender bender — southbound lane</div>
                </div>
              </div>

              {/* Throughput + Direction */}
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 glass-card rounded-xl p-5 anim d5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <iconify-icon icon="lucide:bar-chart-3" width="16" className="text-zinc-500" />
                      <span className="text-sm font-semibold tracking-tight">Hourly Throughput</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-orange-500/60" />This Week</span>
                      <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2 h-2 rounded-sm bg-zinc-700" />Last Week</span>
                    </div>
                  </div>
                  <ThroughputChart />
                  <div className="flex justify-between mt-2 text-[9px] text-zinc-600 font-mono">
                    <span>6AM</span><span>9AM</span><span>12PM</span><span>3PM</span><span>6PM</span><span>9PM</span>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5 anim d6">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="lucide:compass" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">By Direction</span>
                  </div>
                  <div className="space-y-3.5">
                    {[
                      { label: 'Northbound', icon: 'lucide:arrow-up', val: dirN, pct: dirN / vehicles * 100, color: 'bg-orange-500' },
                      { label: 'Southbound', icon: 'lucide:arrow-down', val: dirS, pct: dirS / vehicles * 100, color: 'bg-blue-500' },
                      { label: 'Eastbound', icon: 'lucide:arrow-right', val: dirE, pct: dirE / vehicles * 100, color: 'bg-emerald-500' },
                      { label: 'Westbound', icon: 'lucide:arrow-left', val: dirW, pct: dirW / vehicles * 100, color: 'bg-fuchsia-500' },
                    ].map(d => (
                      <div key={d.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                            <iconify-icon icon={d.icon} width="12" className="text-zinc-500" /> {d.label}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">{d.val}</span>
                        </div>
                        <div className="progress-track"><div className={`progress-fill ${d.color}`} style={{ width: `${Math.min(d.pct * 2, 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vehicle Types + Incidents + Wait Time */}
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="lucide:layers" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">Vehicle Types</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Passenger Cars', pct: 78, color: 'bg-orange-400' },
                      { label: 'Light Trucks', pct: 12, color: 'bg-blue-400' },
                      { label: 'Transit / Bus', pct: 6, color: 'bg-emerald-400' },
                      { label: 'Motorcycles / Other', pct: 4, color: 'bg-zinc-500' },
                    ].map(t => (
                      <div key={t.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-sm ${t.color}`} />
                          <span className="text-[11px] text-zinc-300">{t.label}</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">{t.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex rounded-md overflow-hidden h-2 mt-4">
                    <div className="bg-orange-400" style={{ width: '78%' }} />
                    <div className="bg-blue-400" style={{ width: '12%' }} />
                    <div className="bg-emerald-400" style={{ width: '6%' }} />
                    <div className="bg-zinc-500" style={{ width: '4%' }} />
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <iconify-icon icon="lucide:file-warning" width="16" className="text-zinc-500" />
                      <span className="text-sm font-semibold tracking-tight">Incident Log</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Last 6h</span>
                  </div>
                  <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {INITIAL_INCIDENTS.map(inc => {
                      const isHigh = inc.severity === 'high';
                      const isMid = inc.severity === 'mid';
                      return (
                        <div key={inc.id} className={`flex items-start gap-2.5 p-2 rounded-lg ${isHigh ? 'bg-red-500/5 border border-red-500/10' : isMid ? 'bg-yellow-500/5 border border-yellow-500/10' : ''}`}>
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isHigh ? 'bg-red-500' : isMid ? 'bg-yellow-500' : 'bg-zinc-600'}`} />
                          <div>
                            <p className={`text-[11px] font-medium ${isHigh ? 'text-zinc-200' : 'text-zinc-300'}`}>{inc.title}</p>
                            <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{inc.time} · {inc.status}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="lucide:clock" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">Avg Wait Time</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-semibold">{Math.round(waitTime)}</span>
                    <span className="text-sm text-zinc-500">seconds</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">North-South</span>
                      <span className="text-[11px] font-mono text-zinc-300">{nsWait}s</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill bg-orange-500" style={{ width: `${(nsWait / 80) * 100}%` }} /></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">East-West</span>
                      <span className="text-[11px] font-mono text-zinc-300">{ewWait}s</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill bg-blue-500" style={{ width: `${(ewWait / 80) * 100}%` }} /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between">
                      <span className="stat-label">Cycle Length</span>
                      <span className="text-[12px] font-mono text-zinc-300">120s</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="stat-label">Green Ratio</span>
                      <span className="text-[12px] font-mono text-emerald-400">68%</span>
                    </div>
                  </div>
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

export default CamerasPage;
import React, { useEffect, useState } from 'react';
import { CAMERA_FEEDS, CAMERA_LOCATIONS, getLoadColor } from '../shared/trafficData';
import { snapshotUrl } from '../shared/snapshots';
import usePipelineHealth from '../hooks/usePipelineHealth';
import useTrafficData from '../hooks/useTrafficData';
import LiveChat from '../components/LiveChat';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/* ── Pipeline status badge: LIVE / STALE Xm / OFFLINE ── */
function pipelineBadge(camId, health, online, nowMs) {
  if (!online) return { label: 'OFFLINE', cls: 'text-zinc-500' };
  const cam = health?.cameras?.[camId];
  if (!cam?.last_success_utc) return { label: 'NO DATA', cls: 'text-zinc-500' };
  const ageMin = Math.floor((nowMs - new Date(cam.last_success_utc).getTime()) / 60000);
  if (ageMin < 10) return { label: 'LIVE', cls: 'text-emerald-400' };
  return { label: `STALE ${ageMin}m`, cls: 'text-amber-400' };
}

/* ── Hourly throughput: today (orange) overlaid on yesterday (zinc) ── */
function ThroughputChart({ today, yesterday }) {
  const max = Math.max(1, ...today, ...yesterday);
  const pct = (v) => Math.max(2, (v / max) * 100);
  return (
    <div className="flex items-end gap-[6px] h-24">
      {today.map((v, i) => (
        <div key={i} className="flex-1 relative h-full">
          <div
            className="absolute bottom-0 w-full rounded-sm"
            style={{ height: pct(yesterday[i]) + '%', background: 'rgba(255,255,255,0.05)' }}
            title={`Yesterday ${i}:00 — ${yesterday[i]} vehicles`}
          />
          <div
            className="absolute bottom-0 w-full rounded-sm"
            style={{
              height: pct(v) + '%',
              background: v >= max * 0.8 ? 'rgba(249,115,22,0.65)' : 'rgba(249,115,22,0.3)',
            }}
            title={`Today ${i}:00 — ${v} vehicles`}
          />
        </div>
      ))}
    </div>
  );
}

const prettyCamName = (slug) =>
  (slug || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const CamerasPage = () => {
  const { health: pipelineHealth, online: pipelineOnline } = usePipelineHealth();
  const { loads, latencyMs, hourlyToday, hourlyYesterday, peaks } = useTrafficData();

  const [selectedCamera, setSelectedCamera] = useState(
    CAMERA_FEEDS.find((c) => c.id === 'c003') || CAMERA_FEEDS[0],
  );
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [camTimestamp, setCamTimestamp] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [snapTick, setSnapTick] = useState(0);

  /* ── Clock (real time) ── */
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setNowMs(now.getTime());
      const ts = now.toLocaleTimeString('en-US', { hour12: false });
      setCamTimestamp(ts + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2));
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ── Snapshot refresh tick (cache-buster only) ── */
  useEffect(() => {
    const id = setInterval(() => setSnapTick(Math.random()), 30000);
    return () => clearInterval(id);
  }, []);

  /* ── Derived values (all computed from Supabase rows) ── */
  const peakTimeLabel = peaks
    ? new Date(peaks.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const peakCamLabel = peaks ? prettyCamName(peaks.camera_name) : '—';

  return (
    <div className="theme-cockpit" style={{ background: 'var(--app-bg)', minHeight: '100vh', color: 'var(--app-fg)' }}>
      <style>{`
        .glass-card { background: var(--card-bg); backdrop-filter: blur(10px); border: 1px solid var(--card-border); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .glass-card:hover { background: var(--card-bg-hover); border-color: var(--card-border-hover); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
        .stat-value { font-size: 22px; font-weight: 600; color: var(--text-strong); line-height: 1.2; }
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

      <div className="bg-glow" style={{ top: '-100px', left: '100px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-100px', right: '-100px', width: '400px', height: '400px', background: '#ef4444' }} />

      <SiteHeader />

      <main className="pt-20 pb-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-4 anim d1">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-1.5">Prishtinë — Traffic Corridor</p>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">Traffic Camera Center</h1>
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
            <div className="lg:col-span-7 xl:col-span-8 space-y-3 anim d2">

              {/* Primary Camera — Gjirafa iframe */}
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}>
                <iframe
                  key={selectedCamera.id}
                  title={`Gjirafa ${selectedCamera.name} live`}
                  src={selectedCamera.url}
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', border: 0 }}
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
                    <span className="text-[9px] font-mono text-emerald-400 bg-black/40 px-1.5 py-0.5 rounded">{latencyMs != null ? `${latencyMs}ms` : '—'}</span>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CAMERA_LOCATIONS.map((cam) => {
                  const load = loads.find((s) => s.camera_id === cam.id) || {};
                  const level = load.load_level || 'low';
                  const color = getLoadColor(level);
                  const name = prettyCamName(cam.name);
                  const badge = pipelineBadge(cam.id, pipelineHealth, pipelineOnline, nowMs);
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
                      <div className="absolute bottom-1.5 right-1.5 text-[8px] font-mono text-white/70 bg-black/50 px-1 py-0.5 rounded">{load.vehicle_count ?? '—'} veh</div>
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  );
                })}
              </div>

              {/* Peak (last 24h) — real data, compact strip */}
              <div className="glass-card rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <iconify-icon icon="lucide:trending-up" width="14" className="text-orange-400 flex-shrink-0" />
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="stat-value">{peaks ? peaks.count : '—'}</span>
                    <span className="stat-label truncate">peak vehicles / cycle — 24h</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-zinc-400 flex-shrink-0">
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="lucide:clock" width="12" className="text-zinc-500" />
                    {peakTimeLabel}
                  </span>
                  <span className="hidden sm:flex items-center gap-1.5">
                    <iconify-icon icon="lucide:video" width="12" className="text-zinc-500" />
                    {peakCamLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: Live Chat + Hourly Throughput */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 anim d3">
              <LiveChat className="flex-1 min-h-[340px]" />

              {/* Hourly Throughput — same real data, moved below the chat */}
              <div className="glass-card rounded-xl p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <iconify-icon icon="lucide:bar-chart-3" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">Hourly Throughput</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-orange-500/60" />Today</span>
                    <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2 h-2 rounded-sm bg-zinc-700" />Yesterday</span>
                  </div>
                </div>
                <ThroughputChart today={hourlyToday} yesterday={hourlyYesterday} />
                <div className="flex justify-between mt-2 text-[9px] text-zinc-600 font-mono">
                  <span>12AM</span><span>5AM</span><span>9AM</span><span>2PM</span><span>7PM</span><span>11PM</span>
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


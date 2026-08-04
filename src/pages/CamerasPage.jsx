import React, { useEffect, useState } from 'react';
import { CAMERA_FEEDS, CAMERA_LOCATIONS, getLoadColor } from '../shared/trafficData';
import { snapshotUrl } from '../shared/snapshots';
import usePipelineHealth from '../hooks/usePipelineHealth';
import useTrafficData from '../hooks/useTrafficData';
import { useAuth } from '../hooks/useAuth';
import { fetchIncidentReports } from '../services/reportService';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/* ── Camera stream status: ONLINE (recent success) / OFFLINE (stream down) ── */
function camStatus(camId, health, healthOnline, nowMs) {
  if (!healthOnline) return { label: 'OFFLINE', cls: 'text-red-400', online: false };
  const cam = health?.cameras?.[camId];
  const successMs = cam?.last_success_utc ? new Date(cam.last_success_utc).getTime() : null;
  const errorMs = cam?.last_error_utc ? new Date(cam.last_error_utc).getTime() : null;
  const fresh = successMs != null && nowMs > 0 && nowMs - successMs < 600000;
  const notErroring = errorMs == null || (successMs != null && successMs >= errorMs);
  const online = fresh && notErroring;
  return online
    ? { label: 'ONLINE', cls: 'text-emerald-400', online: true }
    : { label: 'OFFLINE', cls: 'text-red-400', online: false };
}

/* ── Sparkline: the last N real values, no simulation ── */
function Sparkline({ data, color = 'rgba(249,115,22,0.35)' }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-6 mt-3">
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            height: Math.max(2, (v / max) * 24) + 'px',
            width: '3px',
            background: color,
            borderRadius: '1.5px',
            minWidth: '3px',
            transition: 'height 0.5s ease',
          }}
        />
      ))}
      {data.length === 0 && <span className="text-[9px] text-zinc-600">no data yet</span>}
    </div>
  );
}

/* ── Hourly throughput: today (orange) overlaid on yesterday (zinc) ── */
function ThroughputChart({ today, yesterday }) {
  const max = Math.max(1, ...today, ...yesterday);
  const pct = (v) => Math.max(2, (v / max) * 100);
  return (
    <div className="flex items-end gap-[6px] h-32">
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
  const { user } = useAuth();
  const {
    loads,
    counts,
    latencyMs,
    hourlyToday,
    hourlyYesterday,
    todaySoFar,
    yesterdaySoFar,
    vehicleTypeTotals,
    networkCongestion,
    avgConfidence,
    directionToday,
    peaks,
  } = useTrafficData();

  const [selectedCamera, setSelectedCamera] = useState(
    CAMERA_FEEDS.find((c) => c.id === 'c003') || CAMERA_FEEDS[0],
  );
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [camTimestamp, setCamTimestamp] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [snapTick, setSnapTick] = useState(0);
  const [reports, setReports] = useState([]);

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

  /* ── Real incident reports ── */
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchIncidentReports(user.id);
        if (!cancelled) setReports(rows || []);
      } catch { /* keep previous data */ }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  /* ── Derived values (all computed from Supabase rows) ── */
  // Only cameras with a working stream count toward the network total —
  // a dead camera's last-known count is stale and must not be counted.
  const networkVehicles = loads.reduce((s, l) => {
    const st = camStatus(l.camera_id, pipelineHealth, pipelineOnline, nowMs);
    return st.online ? s + (Number(l.vehicle_count) || 0) : s;
  }, 0);
  const ci = networkCongestion;
  const congestionClass =
    ci < 40 ? 'congestion-low' : ci < 65 ? 'congestion-mid' : ci < 80 ? 'congestion-high' : 'congestion-severe';

  const selectedCounts = counts.filter((r) => r.camera_id === selectedCamera.id);
  const countSpark = selectedCounts.slice(-18).map((r) => Number(r.vehicle_count) || 0);
  const confSpark = selectedCounts
    .slice(-18)
    .map((r) => Math.round((Number(r.avg_confidence) || 0) * 100));

  const trendPct =
    yesterdaySoFar > 0 ? Math.round(((todaySoFar - yesterdaySoFar) / yesterdaySoFar) * 100) : null;

  const activeReports = reports.filter((r) => r.status === 'active');

  const typeTotal = Object.values(vehicleTypeTotals).reduce((a, b) => a + b, 0);
  const baseTypeRows = [
    { label: 'Cars', key: 'car', color: 'bg-orange-400' },
    { label: 'Trucks', key: 'truck', color: 'bg-blue-400' },
    { label: 'Buses', key: 'bus', color: 'bg-emerald-400' },
    { label: 'Motorcycles', key: 'motorcycle', color: 'bg-fuchsia-400' },
  ].map((t) => ({ ...t, value: vehicleTypeTotals[t.key] || 0 }));
  const otherValue = typeTotal - baseTypeRows.reduce((s, t) => s + t.value, 0);
  const typeRows = otherValue > 0
    ? [...baseTypeRows, { label: 'Other', key: 'other', color: 'bg-zinc-500', value: otherValue }]
    : baseTypeRows;
  const activeTypeRows = typeRows.filter((t) => t.value > 0);

  const liveCamCount = CAMERA_LOCATIONS.filter((c) => {
    const cam = pipelineHealth?.cameras?.[c.id];
    if (!cam?.last_success_utc) return false;
    return nowMs > 0 && nowMs - new Date(cam.last_success_utc).getTime() < 600000;
  }).length;

  const peakTimeLabel = peaks
    ? new Date(peaks.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const peakCamLabel = peaks ? prettyCamName(peaks.camera_name) : '—';
  const lastCycleLabel = pipelineHealth?.updated_utc
    ? new Date(pipelineHealth.updated_utc).toLocaleTimeString('en-GB', { hour12: false })
    : '—';

  const reportSeverityDot = (severity) =>
    severity === 'major' ? 'bg-red-500' : severity === 'moderate' ? 'bg-yellow-500' : 'bg-zinc-600';

  const reportTime = (createdAt) => {
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

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
              <div className="grid grid-cols-2 gap-2">
                {CAMERA_LOCATIONS.map((cam) => {
                  const load = loads.find((s) => s.camera_id === cam.id) || {};
                  const level = load.load_level || 'low';
                  const color = getLoadColor(level);
                  const name = prettyCamName(cam.name);
                  const status = camStatus(cam.id, pipelineHealth, pipelineOnline, nowMs);
                  return (
                    <div key={cam.id} className="relative group cursor-pointer"
                      style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000', aspectRatio: '16 / 10' }}
                      onClick={() => {
                        const feed = CAMERA_FEEDS.find((c) => c.id === cam.id);
                        if (feed) { setCameraStatus('loading'); setSelectedCamera(feed); }
                      }}
                    >
                      {status.online ? (
                        <>
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
                          <div className="absolute inset-0 items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-500 hidden">no signal</div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-500">no signal</div>
                      )}
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors pointer-events-none" />
                      <div className={`absolute top-1.5 left-1.5 text-[8px] font-mono bg-black/50 px-1 py-0.5 rounded ${status.cls}`}>{status.label}</div>
                      <div className="absolute bottom-1.5 left-1.5 text-[8px] font-mono text-white/50 bg-black/50 px-1 py-0.5 rounded">{name}</div>
                      <div className="absolute bottom-1.5 right-1.5 text-[8px] font-mono text-white/70 bg-black/50 px-1 py-0.5 rounded">{status.online ? `${load.vehicle_count ?? '—'} veh` : 'na'}</div>
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.online ? color : '#52525b' }} />
                    </div>
                  );
                })}
              </div>

              {/* Peak (last 24h) — real data */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <iconify-icon icon="lucide:trending-up" width="14" className="text-orange-400" />
                  <span className="stat-label">Peak — last 24h</span>
                </div>
                <div className="stat-value">{peaks ? peaks.count : '—'}</div>
                <div className="stat-label mt-1">vehicles in one cycle</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="lucide:clock" width="12" className="text-zinc-500" />
                    {peakTimeLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="lucide:video" width="12" className="text-zinc-500" />
                    {peakCamLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: Statistics (all real data) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">

              {/* 4 Key Metrics */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Vehicles last cycle */}
                <div className="glass-card rounded-xl p-4 anim d3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:car" width="14" className="text-orange-400" />
                    </div>
                    {trendPct != null && (
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${trendPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <iconify-icon icon={trendPct >= 0 ? 'lucide:trending-up' : 'lucide:trending-down'} width="10" />
                        {trendPct >= 0 ? '+' : ''}{trendPct}% vs yesterday
                      </div>
                    )}
                  </div>
                  <div className="stat-value">{networkVehicles.toLocaleString()}</div>
                  <div className="stat-label mt-1">Vehicles last cycle</div>
                  <Sparkline data={countSpark} />
                </div>

                {/* Detection confidence */}
                <div className="glass-card rounded-xl p-4 anim d4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <iconify-icon icon="lucide:scan-line" width="14" className="text-blue-400" />
                    </div>
                  </div>
                  <div className="stat-value">
                    {avgConfidence != null ? Math.round(avgConfidence * 100) : '—'}
                    <span className="text-sm text-zinc-500 ml-1">%</span>
                  </div>
                  <div className="stat-label mt-1">Detection confidence</div>
                  <Sparkline data={confSpark} color="rgba(96,165,250,0.35)" />
                </div>

                {/* Congestion Index */}
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
                    <span className={`incident-badge ${activeReports.length > 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {activeReports.length > 0 ? `${activeReports.length} Active` : 'Clear'}
                    </span>
                  </div>
                  <div className="stat-value">{activeReports.length}</div>
                  <div className="stat-label mt-1">Incidents</div>
                  <div className="text-[10px] text-red-400/80 mt-2 truncate">
                    {activeReports[0]?.title || reports[0]?.title || 'No reports yet'}
                  </div>
                </div>
              </div>

              {/* Throughput + Direction */}
              <div className="grid xl:grid-cols-3 gap-4">
                <div className={`${directionToday.hasData ? 'xl:col-span-2' : 'xl:col-span-3'} glass-card rounded-xl p-5 anim d5`}>
                  <div className="flex items-center justify-between mb-4">
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
                    <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
                  </div>
                </div>

                {directionToday.hasData && (
                  <div className="glass-card rounded-xl p-5 anim d6">
                    <div className="flex items-center gap-2 mb-4">
                      <iconify-icon icon="lucide:compass" width="16" className="text-zinc-500" />
                      <span className="text-sm font-semibold tracking-tight">Line Crossings Today</span>
                    </div>
                    <div className="space-y-3.5">
                      {[
                        { label: 'Inbound', icon: 'lucide:arrow-down-right', val: directionToday.in, color: 'bg-orange-500' },
                        { label: 'Outbound', icon: 'lucide:arrow-up-right', val: directionToday.out, color: 'bg-blue-500' },
                      ].map((d) => (
                        <div key={d.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                              <iconify-icon icon={d.icon} width="12" className="text-zinc-500" /> {d.label}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">{d.val}</span>
                          </div>
                          <div className="progress-track">
                            <div
                              className={`progress-fill ${d.color}`}
                              style={{ width: `${Math.min((d.val / Math.max(directionToday.in, directionToday.out, 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-4">Vehicles crossing the counting lines, summed across all cameras today.</p>
                  </div>
                )}
              </div>

              {/* Vehicle Types + Incident Log + Pipeline */}
              <div className="grid xl:grid-cols-3 gap-4">
                {/* Vehicle Types — real JSONB breakdown, today */}
                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="lucide:layers" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">Vehicle Types</span>
                  </div>
                  {activeTypeRows.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No detections recorded today yet.</p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {activeTypeRows.map((t) => (
                          <div key={t.key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2 h-2 rounded-sm ${t.color}`} />
                              <span className="text-[11px] text-zinc-300">{t.label}</span>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {Math.round((t.value / typeTotal) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex rounded-md overflow-hidden h-2 mt-4">
                        {activeTypeRows.map((t) => (
                          <div key={t.key} className={t.color} style={{ width: `${(t.value / typeTotal) * 100}%` }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Incident Log — real user reports */}
                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <iconify-icon icon="lucide:file-warning" width="16" className="text-zinc-500" />
                      <span className="text-sm font-semibold tracking-tight">Incident Log</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{reports.length} total</span>
                  </div>
                  <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {reports.length === 0 && (
                      <p className="text-[11px] text-zinc-600">No reports yet — create one on the Live Map.</p>
                    )}
                    {reports.slice(0, 8).map((rep) => (
                      <div key={rep.id} className={`flex items-start gap-2.5 p-2 rounded-lg ${rep.status === 'active' ? 'bg-red-500/5 border border-red-500/10' : ''}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${reportSeverityDot(rep.severity)}`} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-zinc-200 truncate">{rep.title}</p>
                          <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{reportTime(rep.createdAt)} · {rep.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pipeline status — real health.json data */}
                <div className="glass-card rounded-xl p-5 anim d7">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="lucide:activity" width="16" className="text-zinc-500" />
                    <span className="text-sm font-semibold tracking-tight">Pipeline</span>
                  </div>
                  <div className="space-y-2.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Status</span>
                      <span className={`font-mono font-semibold ${pipelineOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {pipelineOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Mode</span>
                      <span className="font-mono text-zinc-300">{pipelineHealth?.pipeline_mode || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Cycle interval</span>
                      <span className="font-mono text-zinc-300">{pipelineHealth?.interval_minutes ?? '—'} min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Cameras live</span>
                      <span className="font-mono text-zinc-300">{liveCamCount}/{CAMERA_LOCATIONS.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Last cycle</span>
                      <span className="font-mono text-zinc-300">{lastCycleLabel}</span>
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


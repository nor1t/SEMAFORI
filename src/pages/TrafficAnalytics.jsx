import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { getLoadColor, getLoadLabel } from '../shared/trafficData';
import { VALIDATION_RESULTS } from '../shared/validationResults';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

// ── Camera metadata — mirrors semafori-vision/cameras.py ──
const CAMERAS = [
  { id: 'c001', name: 'fushe-kosova', label: 'Fushë Kosova' },
  { id: 'c002', name: 'aktash', label: 'Aktash' },
  { id: 'c003', name: 'pejton', label: 'Pejton' },
  { id: 'c004', name: 'bregu-i-diellit', label: 'Bregu i Diellit' },
];

const CAM_COLORS = { c001: '#f97316', c002: '#60a5fa', c003: '#34d399', c004: '#e879f9' };
const RANGES = [1, 3, 7, 14];
const CYCLES_PER_DAY = 288; // 5-minute scheduler interval
const TYPE_KEYS = ['car', 'truck', 'bus', 'motorcycle'];
const TYPE_COLORS = { car: '#fb923c', truck: '#60a5fa', bus: '#34d399', motorcycle: '#e879f9', other: '#71717a' };

const TOOLTIP_STYLE = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 8,
  fontSize: 12,
};

/* ── Section wrapper (glass card with title) ── */
function SectionCard({ icon, title, subtitle, children, className = '' }) {
  return (
    <div className={`glass-card rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <iconify-icon icon={icon} width="15" className="text-zinc-500" />
        <span className="text-sm font-semibold tracking-tight">{title}</span>
      </div>
      {subtitle && <p className="text-[10px] text-zinc-600 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

/* ── Honest empty state ── */
function EmptyState({ text = 'No data for this range' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <iconify-icon icon="lucide:database-zap" width="20" className="text-zinc-700" />
      <p className="mt-2 text-[11px] text-zinc-600">{text}</p>
    </div>
  );
}

/* ── Live camera card (from traffic_load) ── */
function LiveCard({ load }) {
  const level = load?.load_level || 'low';
  const color = getLoadColor(level);
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-zinc-300 truncate">
          {load?.camera_name ? load.camera_name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'}
        </span>
        <span
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: color + '1a', color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {getLoadLabel(level)}
        </span>
      </div>
      <div className="stat-value">{load?.vehicle_count ?? '—'}</div>
      <div className="stat-label mt-1">vehicles · rate {load?.rolling_rate ?? '—'}/cycle</div>
      <div className="mt-2 text-[9px] text-zinc-600 font-mono">
        {load?.timestamp ? `updated ${new Date(load.timestamp).toLocaleTimeString('en-GB', { hour12: false })}` : 'no data yet'}
      </div>
    </div>
  );
}

const TrafficAnalytics = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  // Charts adapt to the active theme.
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  const tooltipStyle = dark
    ? TOOLTIP_STYLE
    : { background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 };
  const cursorFill = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const [range, setRange] = useState(3);
  const [counts, setCounts] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartCamera, setChartCamera] = useState('all');
  const [profileCamera, setProfileCamera] = useState('all');

  /* ── Fetch history once per range change ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const since = new Date(Date.now() - range * 86400000).toISOString();
        const result = await supabase
          .from('traffic_counts')
          .select('*')
          .gte('timestamp', since)
          .order('timestamp', { ascending: true })
          .limit(10000);
        if (cancelled) return;
        if (!result.error) setCounts(result.data || []);
      } catch { /* keep previous data */ }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  /* ── Live load rows (for cards + percentile thresholds) ── */
  useEffect(() => {
    let cancelled = false;
    const fetchLoads = async () => {
      try {
        const result = await supabase.from('traffic_load').select('*').order('camera_id', { ascending: true });
        if (!cancelled && !result.error) setLoads(result.data || []);
      } catch { /* ignore */ }
    };
    fetchLoads();
    const id = setInterval(fetchLoads, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* ── Data engine: everything derives from `counts` + `loads` ── */
  const perCam = useMemo(() => {
    const map = {};
    for (const cam of CAMERAS) map[cam.id] = [];
    for (const row of counts) {
      if (map[row.camera_id]) map[row.camera_id].push(row);
    }
    return map;
  }, [counts]);

  /* Hourly time series for the line chart (avg vehicles per hour bucket) */
  const hourlySeries = useMemo(() => {
    const series = [];
    const index = new Map();
    for (const row of counts) {
      const d = new Date(row.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      let idx = index.get(key);
      if (idx === undefined) {
        idx = series.length;
        index.set(key, idx);
        series.push({
          label: `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}h`,
        });
      }
      const bucket = series[idx];
      const cid = row.camera_id;
      bucket[`${cid}_sum`] = (bucket[`${cid}_sum`] || 0) + (Number(row.vehicle_count) || 0);
      bucket[`${cid}_n`] = (bucket[`${cid}_n`] || 0) + 1;
    }
    for (const bucket of series) {
      for (const cam of CAMERAS) {
        const n = bucket[`${cam.id}_n`] || 0;
        bucket[cam.id] = n > 0 ? +(bucket[`${cam.id}_sum`] / n).toFixed(1) : null;
      }
    }
    return series;
  }, [counts]);

  /* Hour-of-day profile (avg per cycle for each hour) */
  const profileData = useMemo(() => {
    const sums = new Array(24).fill(0);
    const ns = new Array(24).fill(0);
    for (const row of counts) {
      if (profileCamera !== 'all' && row.camera_id !== profileCamera) continue;
      const d = new Date(row.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const h = d.getHours();
      sums[h] += Number(row.vehicle_count) || 0;
      ns[h] += 1;
    }
    return sums.map((s, h) => ({
      hour: `${String(h).padStart(2, '0')}h`,
      avg: ns[h] ? +(s / ns[h]).toFixed(1) : 0,
    }));
  }, [counts, profileCamera]);

  const peakProfileHour = useMemo(
    () => profileData.reduce((best, cur) => (cur.avg > (best?.avg ?? -1) ? cur : best), null),
    [profileData],
  );

  /* Camera comparison ranking */
  const comparison = useMemo(() => {
    return CAMERAS.map((cam) => {
      const rows = perCam[cam.id] || [];
      const load = loads.find((l) => l.camera_id === cam.id) || {};
      const total = rows.reduce((s, r) => s + (Number(r.vehicle_count) || 0), 0);
      const avg = rows.length ? +(total / rows.length).toFixed(1) : 0;
      const peakRow = rows.reduce(
        (best, r) => ((Number(r.vehicle_count) || 0) > (Number(best?.vehicle_count) || -1) ? r : best),
        null,
      );
      const p90 = Number(load.percentile_90) || 0;
      const congestedPct = p90 > 0 && rows.length
        ? +((rows.filter((r) => (Number(r.vehicle_count) || 0) > p90).length / rows.length) * 100).toFixed(1)
        : null;
      return { cam, rows: rows.length, total, avg, peakRow, congestedPct };
    }).sort((a, b) => b.total - a.total);
  }, [perCam, loads]);

  /* Vehicle type mix per camera (summed JSONB breakdown) */
  const typeMix = useMemo(() => {
    return CAMERAS.map((cam) => {
      const sums = { car: 0, truck: 0, bus: 0, motorcycle: 0, other: 0 };
      for (const row of perCam[cam.id] || []) {
        const bd = row.vehicle_type_breakdown || {};
        for (const [key, value] of Object.entries(bd)) {
          const v = Number(value) || 0;
          if (TYPE_KEYS.includes(key)) sums[key] += v;
          else sums.other += v;
        }
      }
      return { camera: cam.label, ...sums };
    });
  }, [perCam]);

  /* Load distribution: classify each cycle against the camera's percentiles */
  const loadDist = useMemo(() => {
    return CAMERAS.map((cam) => {
      const rows = perCam[cam.id] || [];
      const load = loads.find((l) => l.camera_id === cam.id) || {};
      const p40 = Number(load.percentile_40) || 0;
      const p70 = Number(load.percentile_70) || 0;
      const p90 = Number(load.percentile_90) || 0;
      if (!rows.length || !(p90 > 0)) return { cam, ready: false };
      const buckets = { low: 0, medium: 0, high: 0, congested: 0 };
      for (const r of rows) {
        const n = Number(r.vehicle_count) || 0;
        if (n > p90) buckets.congested += 1;
        else if (n > p70) buckets.high += 1;
        else if (n > p40) buckets.medium += 1;
        else buckets.low += 1;
      }
      return { cam, ready: true, buckets, total: rows.length };
    });
  }, [perCam, loads]);

  /* Top 5 peak cycles */
  const topPeaks = useMemo(
    () => [...counts]
      .sort((a, b) => (Number(b.vehicle_count) || 0) - (Number(a.vehicle_count) || 0))
      .slice(0, 5),
    [counts],
  );

  /* Anomalies: |count − same-hour same-camera mean| > 2σ (and ≥3 vehicles) */
  const anomalies = useMemo(() => {
    const groups = new Map();
    for (const row of counts) {
      const d = new Date(row.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${row.camera_id}:${d.getHours()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(Number(row.vehicle_count) || 0);
    }
    const stats = new Map();
    for (const [key, arr] of groups) {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
      stats.set(key, { mean, sd: Math.sqrt(variance) });
    }
    const out = [];
    for (const row of counts) {
      const d = new Date(row.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const st = stats.get(`${row.camera_id}:${d.getHours()}`);
      if (!st || st.sd === 0) continue;
      const n = Number(row.vehicle_count) || 0;
      const z = (n - st.mean) / st.sd;
      if (Math.abs(z) > 2 && Math.abs(n - st.mean) >= 3) {
        out.push({ row, z, n, mean: st.mean });
      }
    }
    return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 8);
  }, [counts]);

  /* Data coverage (actual vs expected cycles) */
  const coverage = useMemo(() => {
    const expected = range * CYCLES_PER_DAY;
    return CAMERAS.map((cam) => {
      const actual = (perCam[cam.id] || []).length;
      return { cam, actual, pct: Math.min(100, Math.round((actual / expected) * 100)) };
    });
  }, [perCam, range]);

  /* ── CSV export ── */
  const exportCsv = () => {
    const header = 'timestamp,camera_id,camera_name,vehicle_count,in_count,out_count,vehicle_type_breakdown,avg_confidence';
    const lines = counts.map((r) => [
      r.timestamp,
      r.camera_id,
      r.camera_name,
      Number(r.vehicle_count) || 0,
      Number(r.in_count) || 0,
      Number(r.out_count) || 0,
      JSON.stringify(JSON.stringify(r.vehicle_type_breakdown || {})),
      Number(r.avg_confidence) || 0,
    ].join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `semafori_counts_${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTs = (ts) => new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="theme-cockpit" style={{ minHeight: '100vh', color: 'var(--app-fg)' }}>
      <style>{`
        .glass-card { background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--card-border); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset; }
        .glass-card:hover { background: var(--card-bg-hover); border-color: var(--card-border-hover); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
        .stat-value { font-size: 22px; font-weight: 600; color: var(--text-strong); line-height: 1.2; }
        .progress-track { background: var(--track-bg); border-radius: 9999px; overflow: hidden; height: 4px; }
        .progress-fill { height: 100%; border-radius: 9999px; transition: width 1s cubic-bezier(0.16,1,0.3,1); }
        .range-pill { padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; color: var(--text-dim); border: 1px solid var(--card-border); background: var(--chip-bg); cursor: pointer; transition: all 0.2s ease; }
        .range-pill:hover { color: var(--text-strong); background: var(--card-bg-hover); }
        .range-pill.active { background: rgba(249,115,22,0.12); border-color: rgba(249,115,22,0.35); color: #fb923c; }
        .cam-pill { padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 600; color: var(--text-dim); border: 1px solid var(--card-border); background: transparent; cursor: pointer; transition: all 0.2s ease; }
        .cam-pill:hover { color: var(--text-strong); }
        .cam-pill.active { background: var(--track-bg); color: var(--text-strong); border-color: var(--card-border-hover); }
        .bg-glow { position: fixed; border-radius: 9999px; filter: blur(120px); opacity: 0.05; pointer-events: none; z-index: -10; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1{animation-delay:0.05s;opacity:0}.d2{animation-delay:0.1s;opacity:0}.d3{animation-delay:0.15s;opacity:0}.d4{animation-delay:0.2s;opacity:0}
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
      `}</style>

      <div className="bg-glow" style={{ top: '-100px', left: '150px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-120px', right: '-80px', width: '400px', height: '400px', background: '#3b82f6' }} />

      <SiteHeader />

      <main className="pt-20 pb-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">

          {/* Header: title + range selector + export */}
          <div className="mb-6 anim d1">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-1.5">Prishtinë — Traffic Intelligence</p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">Traffic Analytics</h1>
                <p className="text-[11px] text-zinc-500 mt-1">Real counts from the YOLO + ByteTrack pipeline · {counts.length.toLocaleString()} cycles in range</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {RANGES.map((d) => (
                  <button key={d} onClick={() => setRange(d)} className={`range-pill ${range === d ? 'active' : ''}`}>
                    {d}d
                  </button>
                ))}
                <button
                  onClick={exportCsv}
                  disabled={counts.length === 0}
                  className="range-pill flex items-center gap-1.5 disabled:opacity-40"
                  title="Download the fetched rows as CSV"
                >
                  <iconify-icon icon="lucide:download" width="12" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* 4 live cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5 anim d2">
            {CAMERAS.map((cam) => (
              <LiveCard key={cam.id} load={loads.find((l) => l.camera_id === cam.id)} />
            ))}
          </div>

          {/* History line chart */}
          <div className="anim d3">
            <SectionCard
              icon="lucide:chart-line"
              title="Vehicle counts over time"
              subtitle={`Hourly averages per camera · last ${range} day${range > 1 ? 's' : ''}${loading ? ' · loading…' : ''}`}
              className="mb-5"
            >
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <button onClick={() => setChartCamera('all')} className={`cam-pill ${chartCamera === 'all' ? 'active' : ''}`}>All cameras</button>
                {CAMERAS.map((cam) => (
                  <button key={cam.id} onClick={() => setChartCamera(cam.id)} className={`cam-pill ${chartCamera === cam.id ? 'active' : ''}`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: CAM_COLORS[cam.id] }} />
                    {cam.label}
                  </button>
                ))}
              </div>
              {hourlySeries.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={hourlySeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} minTickGap={40} tickLine={false} axisLine={{ stroke: gridColor }} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa' }} />
                    {(chartCamera === 'all' ? CAMERAS : CAMERAS.filter((c) => c.id === chartCamera)).map((cam) => (
                      <Line
                        key={cam.id}
                        type="monotone"
                        dataKey={cam.id}
                        name={cam.label}
                        stroke={CAM_COLORS[cam.id]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* Hour-of-day profile + Camera comparison */}
          <div className="grid xl:grid-cols-2 gap-5 mb-5">
            <SectionCard
              icon="lucide:clock"
              title="Hour-of-day profile"
              subtitle={`Average vehicles per cycle by hour · when rush hour actually happens${peakProfileHour && peakProfileHour.avg > 0 ? ` · peak: ${peakProfileHour.hour}` : ''}`}
            >
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <button onClick={() => setProfileCamera('all')} className={`cam-pill ${profileCamera === 'all' ? 'active' : ''}`}>All</button>
                {CAMERAS.map((cam) => (
                  <button key={cam.id} onClick={() => setProfileCamera(cam.id)} className={`cam-pill ${profileCamera === cam.id ? 'active' : ''}`}>
                    {cam.label}
                  </button>
                ))}
              </div>
              {counts.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={profileData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 9 }} interval={2} tickLine={false} axisLine={{ stroke: gridColor }} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa' }} cursor={{ fill: cursorFill }} />
                    <Bar dataKey="avg" name="Avg vehicles" radius={[3, 3, 0, 0]}>
                      {profileData.map((entry) => (
                        <Cell
                          key={entry.hour}
                          fill={peakProfileHour && entry.hour === peakProfileHour.hour && entry.avg > 0 ? '#f97316' : 'rgba(249,115,22,0.35)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard
              icon="lucide:trophy"
              title="Camera comparison"
              subtitle="Ranked by total vehicles counted in range"
            >
              {comparison.every((c) => c.rows === 0) ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-zinc-600 text-left">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Camera</th>
                        <th className="pb-2 font-medium text-right">Total</th>
                        <th className="pb-2 font-medium text-right">Avg/cycle</th>
                        <th className="pb-2 font-medium text-right">Peak</th>
                        <th className="pb-2 font-medium text-right">% congested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((row, i) => (
                        <tr key={row.cam.id} className="border-t border-zinc-800/50">
                          <td className="py-2 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="py-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: CAM_COLORS[row.cam.id] }} />
                            <span className="text-zinc-200">{row.cam.label}</span>
                          </td>
                          <td className="py-2 text-right font-mono text-zinc-300">{row.total.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono text-zinc-400">{row.avg}</td>
                          <td className="py-2 text-right font-mono text-zinc-400">
                            {row.peakRow ? `${row.peakRow.vehicle_count} · ${fmtTs(row.peakRow.timestamp)}` : '—'}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {row.congestedPct == null ? (
                              <span className="text-zinc-600">—</span>
                            ) : (
                              <span style={{ color: row.congestedPct > 15 ? '#ef4444' : row.congestedPct > 5 ? '#f97316' : '#34d399' }}>
                                {row.congestedPct}%
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Vehicle type mix + Load distribution */}
          <div className="grid xl:grid-cols-2 gap-5 mb-5">
            <SectionCard
              icon="lucide:layers"
              title="Vehicle type mix"
              subtitle="Summed detections per camera across the range"
            >
              {typeMix.every((t) => t.car + t.truck + t.bus + t.motorcycle + t.other === 0) ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeMix} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="camera" tick={{ fill: '#71717a', fontSize: 9 }} tickLine={false} axisLine={{ stroke: gridColor }} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa' }} cursor={{ fill: cursorFill }} />
                    <Legend wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} />
                    {[...TYPE_KEYS, 'other'].map((key) => (
                      <Bar key={key} dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} stackId="mix" fill={TYPE_COLORS[key]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard
              icon="lucide:gauge"
              title="Load distribution"
              subtitle="Share of cycles in each load class (vs each camera's live percentiles)"
            >
              {loadDist.every((d) => !d.ready) ? (
                <EmptyState text="Not enough history for percentile classes yet" />
              ) : (
                <div className="space-y-4 pt-1">
                  {loadDist.map((d) => (
                    <div key={d.cam.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-zinc-300">{d.cam.label}</span>
                        {!d.ready && <span className="text-[9px] text-zinc-600">no thresholds yet</span>}
                      </div>
                      {d.ready && (
                        <>
                          <div className="flex rounded-md overflow-hidden h-3">
                            {['low', 'medium', 'high', 'congested'].map((lvl) => (
                              <div
                                key={lvl}
                                style={{
                                  width: `${(d.buckets[lvl] / d.total) * 100}%`,
                                  background: getLoadColor(lvl),
                                }}
                                title={`${getLoadLabel(lvl)}: ${Math.round((d.buckets[lvl] / d.total) * 100)}%`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
                            {['low', 'medium', 'high', 'congested'].map((lvl) => (
                              <span key={lvl} style={{ color: getLoadColor(lvl) }}>
                                {Math.round((d.buckets[lvl] / d.total) * 100)}%
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1 text-[9px] text-zinc-600">
                    {['low', 'medium', 'high', 'congested'].map((lvl) => (
                      <span key={lvl} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ background: getLoadColor(lvl) }} />
                        {getLoadLabel(lvl)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Peak cycles + Anomalies + Data coverage */}
          <div className="grid xl:grid-cols-3 gap-5 anim d4">
            <SectionCard
              icon="lucide:zap"
              title="Peak cycles"
              subtitle="Top 5 busiest single cycles in range"
            >
              {topPeaks.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {topPeaks.map((row, i) => (
                    <div key={`${row.id ?? i}`} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                      <span className={`text-[11px] font-mono w-5 text-center ${i === 0 ? 'text-orange-400' : 'text-zinc-600'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-zinc-200 truncate">
                          {(row.camera_name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-mono">{fmtTs(row.timestamp)}</p>
                      </div>
                      <span className="text-sm font-semibold text-zinc-100 font-mono">{row.vehicle_count}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon="lucide:siren"
              title="Anomalies"
              subtitle="|count − hourly mean| > 2σ (min 3 vehicles) · possible incidents or camera faults"
            >
              {anomalies.length === 0 ? (
                <EmptyState text="No anomalies detected in this range." />
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {anomalies.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.z > 0 ? 'bg-red-500' : 'bg-blue-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-zinc-200 truncate">
                          {(a.row.camera_name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-mono">{fmtTs(a.row.timestamp)}</p>
                      </div>
                      <span className={`text-[10px] font-mono whitespace-nowrap ${a.z > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {a.n} veh · {Math.abs(a.z).toFixed(1)}σ {a.z > 0 ? 'above' : 'below'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon="lucide:heart-pulse"
              title="Data coverage"
              subtitle={`Actual vs expected cycles (${CYCLES_PER_DAY}/day per camera)`}
            >
              <div className="space-y-3.5 pt-1">
                {coverage.map((c) => (
                  <div key={c.cam.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: CAM_COLORS[c.cam.id] }} />
                        {c.cam.label}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{c.actual} rows · {c.pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${c.pct}%`,
                          background: c.pct >= 90 ? '#34d399' : c.pct >= 60 ? '#facc15' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Model quality — shown only after validationResults.js is filled */}
          {VALIDATION_RESULTS.countF1 != null && (
            <div className="mt-5">
              <SectionCard
                icon="lucide:badge-check"
                title="Model quality"
                subtitle={`Measured with validate_counts.py + benchmark_detectors.py · ${VALIDATION_RESULTS.measuredAt || 'date not set'}`}
              >
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { label: 'Model', val: VALIDATION_RESULTS.model },
                    { label: 'Count F1', val: VALIDATION_RESULTS.countF1 != null ? VALIDATION_RESULTS.countF1.toFixed(2) : '—' },
                    { label: 'Precision', val: VALIDATION_RESULTS.countPrecision != null ? VALIDATION_RESULTS.countPrecision.toFixed(2) : '—' },
                    { label: 'Recall', val: VALIDATION_RESULTS.countRecall != null ? VALIDATION_RESULTS.countRecall.toFixed(2) : '—' },
                    { label: `vs ${VALIDATION_RESULTS.comparedWith}`, val: VALIDATION_RESULTS.speedup != null ? `${VALIDATION_RESULTS.speedup}× faster` : '—' },
                  ].map((chip) => (
                    <div key={chip.label} className="rounded-lg px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.06]">
                      <div className="stat-label">{chip.label}</div>
                      <div className="text-[13px] font-semibold text-zinc-100 mt-0.5">{chip.val}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default TrafficAnalytics;

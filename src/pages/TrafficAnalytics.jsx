import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

// ── Camera metadata ───────────────────────────────────────────────────────
// Hard-coded here so the frontend doesn't need to reach into the Python
// config.  These are the same four cameras configured in
// semafori-vision/cameras.py — keep them in sync.
const CAMERAS = [
  { id: 'c001', name: 'fushe-kosova', label: 'Fushë Kosova', lat: 42.643, lng: 21.089 },
  { id: 'c002', name: 'aktash', label: 'Aktash', lat: 42.664, lng: 21.161 },
  { id: 'c003', name: 'pejton', label: 'Pejton', lat: 42.665, lng: 21.166 },
  { id: 'c004', name: 'bregu-i-diellit', label: 'Bregu i Diellit', lat: 42.652, lng: 21.150 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const LOAD_COLORS = {
  low: '#10b981',       // emerald-500
  medium: '#f59e0b',    // amber-500
  high: '#f97316',      // orange-500
  congested: '#ef4444', // red-500
};

const LOAD_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  congested: 'Congested',
};

// ── LiveCountWidget ────────────────────────────────────────────────────────
function LiveCountWidget({ load }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const level = load?.load_level || 'low';
  const color = LOAD_COLORS[level] || LOAD_COLORS.low;

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors ${
        dark ? 'border-navy-600/30 bg-navy-800/40' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-serif text-lg font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>
          {load?.camera_name
            ? load.camera_name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : '—'}
        </h3>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: color + '20', color }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          {LOAD_LABELS[level] || level}
        </div>
      </div>

      {/* Count */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-3xl font-bold tabular-nums ${dark ? 'text-white' : 'text-navy-900'}`}>
          {load?.vehicle_count ?? '—'}
        </span>
        <span className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          vehicles / cycle
        </span>
      </div>

      {/* Rolling rate */}
      <div className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        Rolling rate: <span className="font-medium tabular-nums">{load?.rolling_rate ?? '—'}</span> veh/cycle
      </div>

      {/* Timestamp */}
      <div className={`mt-3 text-[11px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
        {load?.timestamp
          ? `Updated ${new Date(load.timestamp).toLocaleTimeString()}`
          : 'No data yet'}
      </div>
    </div>
  );
}

// ── ChartSection ───────────────────────────────────────────────────────────
function ChartSection({ cameraId }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [data, setData] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      const result = await supabase
        .from('traffic_counts')
        .select('vehicle_count, timestamp')
        .eq('camera_id', cameraId)
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: true })
        .limit(500);

      if (result.error) throw new Error(result.error.message);

      const rows = (result.data || []).map((row) => ({
        time: new Date(row.timestamp).toLocaleDateString('en-GB', {
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        count: row.vehicle_count,
        raw: new Date(row.timestamp),
      }));

      setData(rows);
    } catch (err) {
      console.error('Failed to fetch traffic history:', err);
      setError(err.message || 'Could not load history.');
    } finally {
      setLoading(false);
    }
  }, [cameraId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const camera = CAMERAS.find((c) => c.id === cameraId);
  const chartColor = dark ? '#93c5fd' : '#2563eb';

  return (
    <div
      className={`rounded-2xl border p-6 ${
        dark ? 'border-navy-600/30 bg-navy-800/40' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className={`font-serif text-xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>
          Vehicle history — {camera?.label || cameraId}
        </h3>

        {/* Day selector */}
        <div className="flex gap-2">
          {[1, 3, 7, 14].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? 'bg-tblue-500 text-white'
                  : dark
                    ? 'bg-navy-700 text-gray-400 hover:text-gray-200'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              {d === 1 ? '24h' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'
          }`}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" />
            <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" style={{ animationDelay: '0.1s' }} />
            <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className={`flex h-64 items-center justify-center text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          No data for this time window yet. The pipeline needs a few detection cycles before charts appear.
        </div>
      ) : (
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#111827' : '#fff',
                  border: dark ? '1px solid #1f2937' : '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: dark ? '#f3f4f6' : '#1f2937',
                }}
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value) => [`${value} vehicles`, 'Count']}
              />
              <Legend
                formatter={() => 'Vehicles'}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Vehicles"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={`mt-3 text-[11px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
        {data.length} data points · from Supabase traffic_counts
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
const TrafficAnalytics = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [loads, setLoads] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(() => {
    // Try to match the first camera from the URL hash or default to pejton
    const hash = window.location.hash?.replace('#', '');
    return CAMERAS.find((c) => c.name === hash)?.id || 'c003';
  });
  const [loadsLoading, setLoadsLoading] = useState(true);
  const [loadsError, setLoadsError] = useState('');

  // ── Fetch current load status for all cameras ──────────────────────
  const fetchLoads = useCallback(async () => {
    setLoadsLoading(true);
    setLoadsError('');
    try {
      const result = await supabase
        .from('traffic_load')
        .select('*')
        .order('camera_id', { ascending: true });

      if (result.error) throw new Error(result.error.message);
      setLoads(result.data || []);
    } catch (err) {
      console.error('Failed to fetch traffic_load:', err);
      setLoadsError(err.message || 'Could not load camera status.');
    } finally {
      setLoadsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  // Refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchLoads, 60000);
    return () => clearInterval(interval);
  }, [fetchLoads]);

  const handleCameraSelect = (cameraId) => {
    setSelectedCamera(cameraId);
    const cam = CAMERAS.find((c) => c.id === cameraId);
    if (cam) window.location.hash = cam.name;
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-500 grain ${
        dark ? 'bg-navy-950 text-gray-200' : 'bg-paper-50 text-gray-800'
      }`}
    >
      <SiteHeader />

      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6">
          {/* ── Page header ──────────────────────────────────────── */}
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="eastern-line w-8" />
              <span
                className={`text-[11px] font-medium uppercase tracking-[0.28em] ${
                  dark ? 'text-tblue-300/70' : 'text-tblue-600/70'
                }`}
              >
                Traffic Analytics
              </span>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1
                  className={`font-serif text-3xl font-bold sm:text-4xl ${
                    dark ? 'text-white' : 'text-navy-900'
                  }`}
                >
                  Live road-load{' '}
                  <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>
                    classification
                  </span>
                </h1>
                <p
                  className={`mt-3 max-w-2xl text-sm leading-7 ${
                    dark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Each camera is classified every cycle using percentile-based
                  thresholds computed from its own recent history. The coloured
                  markers on the map update in real time.
                </p>
              </div>

              {/* Refresh button */}
              <button
                onClick={fetchLoads}
                disabled={loadsLoading}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  dark
                    ? 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <iconify-icon
                  icon="lucide:refresh-cw"
                  width="14"
                  class={loadsLoading ? 'animate-spin' : ''}
                />
                Refresh
              </button>
            </div>

            {loadsError && (
              <div
                className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                  dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'
                }`}
              >
                {loadsError}
              </div>
            )}
          </div>

          {/* ── Live count widgets (4 cards) ──────────────────────── */}
          {loadsLoading && loads.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" />
                <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" style={{ animationDelay: '0.1s' }} />
                <div className="h-3 w-3 animate-bounce rounded-full bg-tblue-500" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          ) : (
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CAMERAS.map((cam) => {
                const load = loads.find((l) => l.camera_id === cam.id) || null;
                return <LiveCountWidget key={cam.id} load={load} />;
              })}
            </div>
          )}

          {/* ── Historical chart ──────────────────────────────────── */}
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                dark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Camera:
            </span>
            {CAMERAS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => handleCameraSelect(cam.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  selectedCamera === cam.id
                    ? 'bg-tblue-500 text-white'
                    : dark
                      ? 'bg-navy-800 text-gray-400 hover:text-gray-200'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <ChartSection key={selectedCamera} cameraId={selectedCamera} />

          {/* ── How it works ──────────────────────────────────────── */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: 'lucide:bar-chart-3',
                title: 'Percentile-based',
                desc: 'Thresholds come from each camera\'s own 40th/70th/90th percentile of recent vehicle counts, so "high" means high *for that road*.',
              },
              {
                icon: 'lucide:database',
                title: 'Stored in Supabase',
                desc: 'traffic_load.py updates the traffic_load table after every scheduler cycle. The dashboard reads it directly — no server-side aggregation needed.',
              },
              {
                icon: 'lucide:map-pin',
                title: 'Map colour sync',
                desc: 'Camera markers on the Leaflet map change colour automatically when the load level changes. No manual refresh required.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-2xl border p-5 ${
                  dark ? 'border-navy-600/30 bg-navy-800/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                    dark ? 'bg-tblue-500/10' : 'bg-tblue-50'
                  }`}
                >
                  <iconify-icon icon={item.icon} width="18" class="text-tblue-500" />
                </div>
                <h3 className={`font-serif text-base font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>
                  {item.title}
                </h3>
                <p className={`mt-2 text-sm leading-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default TrafficAnalytics;
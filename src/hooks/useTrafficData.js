import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const LOAD_POLL_MS = 30000;
const COUNTS_POLL_MS = 60000;
const COUNTS_WINDOW_HOURS = 48; // covers today + yesterday for comparisons
const PEAK_WINDOW_HOURS = 24;

const LOAD_TO_INDEX = { low: 15, medium: 45, high: 70, congested: 90 };

/**
 * Central real-data feed for the traffic pages.
 *
 * Polls:
 *   - `traffic_load`   every 30 s (current status row per camera)
 *   - `traffic_counts` every 60 s (last 48 h of per-cycle history)
 *
 * Returns raw rows plus derived aggregates.  Every value comes straight from
 * Supabase — nothing is simulated.  Safe when tables are empty.
 */
export function useTrafficData() {
  const [loads, setLoads] = useState([]);
  const [counts, setCounts] = useState([]);
  const [latencyMs, setLatencyMs] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLoads = async () => {
      const started = performance.now();
      try {
        const result = await supabase
          .from('traffic_load')
          .select('*')
          .order('camera_id', { ascending: true });
        if (cancelled) return;
        setLatencyMs(Math.max(1, Math.round(performance.now() - started)));
        if (!result.error) setLoads(result.data || []);
      } catch { /* keep previous data on transient errors */ }
    };

    const fetchCounts = async () => {
      const since = new Date(Date.now() - COUNTS_WINDOW_HOURS * 3600000).toISOString();
      try {
        const result = await supabase
          .from('traffic_counts')
          .select('*')
          .gte('timestamp', since)
          .order('timestamp', { ascending: true })
          .limit(10000);
        if (cancelled) return;
        if (!result.error) setCounts(result.data || []);
      } catch { /* keep previous data on transient errors */ }
    };

    fetchLoads();
    fetchCounts();
    const loadInterval = setInterval(fetchLoads, LOAD_POLL_MS);
    const countsInterval = setInterval(fetchCounts, COUNTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(loadInterval);
      clearInterval(countsInterval);
    };
  }, []);

  /* ── Derived aggregates (recomputed each render — cheap for ≤ ~2k rows) ── */
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const peakCutoff = now.getTime() - PEAK_WINDOW_HOURS * 3600000;

  const hourlyToday = new Array(24).fill(0);
  const hourlyYesterday = new Array(24).fill(0);
  const vehicleTypeTotals = {};
  let confidenceSum = 0;
  let confidenceRows = 0;
  let inToday = 0;
  let outToday = 0;
  let peaks = null;

  for (const row of counts) {
    const ts = new Date(row.timestamp);
    if (Number.isNaN(ts.getTime())) continue;
    const n = Number(row.vehicle_count) || 0;

    if (ts >= todayStart) {
      hourlyToday[ts.getHours()] += n;
      inToday += Number(row.in_count) || 0;
      outToday += Number(row.out_count) || 0;
      const breakdown = row.vehicle_type_breakdown || {};
      for (const [key, value] of Object.entries(breakdown)) {
        const v = Number(value) || 0;
        vehicleTypeTotals[key] = (vehicleTypeTotals[key] || 0) + v;
      }
    } else if (ts >= yesterdayStart) {
      hourlyYesterday[ts.getHours()] += n;
    }

    if (ts.getTime() >= peakCutoff) {
      if (!peaks || n > peaks.count) {
        peaks = { count: n, timestamp: row.timestamp, camera_name: row.camera_name };
      }
      const conf = Number(row.avg_confidence);
      if (conf > 0) {
        confidenceSum += conf;
        confidenceRows += 1;
      }
    }
  }

  const currentHour = now.getHours();
  const todaySoFar = hourlyToday.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);
  const yesterdaySoFar = hourlyYesterday.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);

  const networkCongestion = loads.length
    ? Math.round(
        loads.reduce((sum, l) => sum + (LOAD_TO_INDEX[l.load_level] ?? 15), 0) / loads.length,
      )
    : 0;

  const avgConfidence = confidenceRows ? confidenceSum / confidenceRows : null;

  const directionToday = {
    in: inToday,
    out: outToday,
    hasData: inToday + outToday > 0,
  };

  return {
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
  };
}

export default useTrafficData;

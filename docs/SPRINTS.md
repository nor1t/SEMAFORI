# SEMAFORI — Improvement Sprint Plan

This file breaks the "make it a fully convincing, real-data project" work into
6 sprints. Each sprint has: a goal, tasks, verification steps, and a
**ready-to-paste AI prompt** (in a `text` block) you can send to an AI coding
assistant to execute the sprint.

## How to use this file

1. Work through the sprints **in order** — later sprints depend on earlier ones.
2. Before each sprint, commit your current state (`git commit`) so you can roll back.
3. Copy the prompt block from the sprint and paste it to your AI assistant.
   The prompts assume the AI has access to this workspace (both `SEMAFORI/`
   and `../semafori-vision/`). If you use a chat without file access, paste
   the relevant files first.
4. After the AI finishes, run the **Verify** checklist yourself before moving on.

## Ground rules that apply to EVERY sprint

- Frontend: React 19 + Vite + Tailwind. Keep the existing dark design language
  (`#09090b` background, `glass-card` style, `iconify-icon` icons, orange accents).
- No placeholder/TODO code. Everything must be functional.
- Never display invented/simulated numbers as if they were real. If a metric
  cannot be derived from Supabase data, it must be removed or clearly labeled
  "Simulation".
- `npm run build` and `npm run lint` must pass after every frontend sprint.
- The Python service must run with `python scheduler.py` from `semafori-vision/`.

## Sprint overview

| # | Sprint | Goal | Est. time |
|---|--------|------|-----------|
| 1 | Backend: real flow counting | Count vehicles crossing the line (flow), not just visible in a snapshot; store in/out; health endpoint; disk cleanup | 0.5–1 day |
| 2 | Deploy pipeline 24/7 + snapshot URLs | Backend always-on with HTTPS snapshots; frontend LIVE/STALE badges | 0.5 day |
| 3 | CamerasPage: 100% real data | Kill all simulated numbers on the main page | 1 day |
| 4 | Analytics page | Route + build the real traffic-analysis page (charts, peaks, anomalies, CSV) | 1–1.5 days |
| 5 | AI Chat + Live Map real data | AI answers with live numbers; map shows only real markers | 1 day |
| 6 | Polish + thesis extras | Validation badge, docs sync, dependency cleanup, final QA | 0.5–1 day |

---

## Sprint 1 — Backend: real flow counting + health + retention

**Goal:** The scheduler currently counts vehicles *visible in one snapshot*
(`capture_frame()` + `detect_vehicles()`). Switch it to the already-built
tracked pipeline (`capture_sequence()` + `detect_with_tracker()`) so every
cycle stores **vehicles that actually crossed the counting line** — real flow
data with **in/out direction split**. Also fix the unbounded `frames/` and
`output/` disk growth and add a machine-readable health file.

**Why it matters:** "Vehicles crossing per 5 minutes" is defensible traffic
data. "Vehicles in a random snapshot" is not. In/out counts also unlock a
real direction chart later.

### Tasks

- [ ] Add migration to `schema.sql`: `ALTER TABLE traffic_counts` adding
      `in_count INTEGER DEFAULT 0` and `out_count INTEGER DEFAULT 0`
      (run it in the Supabase SQL Editor).
- [ ] `supabase_db.py`: extend `write_count()` with optional `in_count` /
      `out_count` fields.
- [ ] `scheduler.py`: add `PIPELINE_MODE` env (`tracked` default, `snapshot`
      fallback). In tracked mode: `capture_sequence()` → `detect_with_tracker()`
      with the camera's `line_start`/`line_end` → write `total_crossed` as
      `vehicle_count`, plus `in_count`/`out_count` and `crossed_by_type`.
- [ ] Keep per-camera failure isolation (try/except per camera). If sequence
      capture fails, fall back to single-frame mode for that camera that cycle.
- [ ] Add retention cleanup: keep only the newest ~40 files in `frames/` and
      `output/` (delete older by modification time) after each cycle.
- [ ] After each cycle, write `output/health.json` with per-camera
      `last_success_utc`, `last_error_utc`, `last_count`, and `pipeline_mode`.
      The existing port-8001 server already serves `output/`, so
      `/health.json` works with no extra code.
- [ ] HTTP server binds to `PORT` env if set (Render requirement), else
      `SNAPSHOT_PORT` (default 8001).
- [ ] Update `semafori-vision/README.md` pipeline-mode paragraph.

### Verify

- [ ] Run the SQL migration in Supabase; `traffic_counts` shows the 2 new columns.
- [ ] `python scheduler.py` runs one full cycle; new rows in `traffic_counts`
      have `in_count`/`out_count` populated.
- [ ] `http://localhost:8001/health.json` returns JSON after a cycle.
- [ ] `frames/` file count stays bounded across 2+ cycles.

### AI prompt — Sprint 1

```text
You are working in the SEMAFORI workspace. The Python service lives in
`../semafori-vision/` relative to the React repo root. It captures frames from
Gjirafa HLS streams, detects vehicles with YOLOv8n, and writes counts to
Supabase tables `traffic_counts` (history) and `traffic_load` (current).

CONTEXT: `scheduler.py` currently uses single-frame mode:
`capture_frame()` → `detect_vehicles()`. The better tracked pipeline already
exists but is unused: `capture.py::capture_sequence()` (8s × 3fps = 24 BGR
numpy frames) and `detect.py::detect_with_tracker(frames, line_start,
line_end, camera_name=..., save_annotated=True)` which returns
{total_crossed, crossed_by_type, avg_confidence, annotated_path, in_counts,
out_counts}. Each camera in `cameras.py` has line_start/line_end.

IMPLEMENT ALL OF THE FOLLOWING:

1. `schema.sql` — append a migration block:
   ALTER TABLE public.traffic_counts ADD COLUMN IF NOT EXISTS in_count INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE public.traffic_counts ADD COLUMN IF NOT EXISTS out_count INTEGER NOT NULL DEFAULT 0;
   with a comment telling the user to run it once in the Supabase SQL Editor.

2. `supabase_db.py` — extend `write_count()` with optional keyword args
   `in_count: int = 0` and `out_count: int = 0`, included in the inserted
   record. Keep backward compatibility.

3. `scheduler.py`:
   - Add `PIPELINE_MODE = os.getenv("PIPELINE_MODE", "tracked")`.
   - In `process_camera()`, when mode is "tracked": call
     `capture_sequence(cam_name, stream_url)`, then
     `detect_with_tracker(frames, line_start, line_end, camera_name=cam_name)`.
     Write to Supabase with vehicle_count=result["total_crossed"],
     type_breakdown=result["crossed_by_type"], in_count=result["in_counts"],
     out_count=result["out_counts"]. Keep copying `annotated_path` to
     `output/latest_<cam_name>.jpg`.
   - If `capture_sequence()` raises or returns an empty list, fall back for
     that camera only to the old single-frame path (capture_frame +
     detect_vehicles), and log a warning. A camera failure must never affect
     other cameras.
   - Add `_cleanup_dirs()` called after each camera: keep only the newest 40
     files (by mtime) in `frames/` and newest 40 in `output/`; never delete
     files matching `latest_*.jpg`.
   - Add `_write_health()` called at the end of each cycle: writes
     `output/health.json` like
     {"updated_utc": "...", "pipeline_mode": "...", "cameras": {"c001":
     {"name": "...", "last_success_utc": "...", "last_error_utc": null,
     "last_count": 12}, ...}}. Track success/error per camera in a dict.
   - The snapshot HTTP server must bind port from `os.getenv("PORT")` first,
     then `SNAPSHOT_PORT`, then 8001 (Render.com injects PORT).

4. Update `semafori-vision/README.md`: document PIPELINE_MODE, the new
   in_count/out_count columns, and health.json.

CONSTRAINTS: Python 3.10+, no new pip dependencies (APScheduler, ultralytics,
supervision, supabase, opencv, numpy already present). Do not change
traffic_load.py. Keep the existing log/print style.

ACCEPTANCE: `python scheduler.py` completes one full cycle locally; new
traffic_counts rows include in_count/out_count; GET /health.json on the
snapshot port returns valid JSON; frames/ stays bounded.
```

---

## Sprint 2 — Deploy pipeline 24/7 + snapshot URLs + LIVE/STALE badges

**Goal:** The dashboard on Vercel must show live data during the demo — so the
Python pipeline runs continuously on a public host, snapshots are served over
**HTTPS** (browsers block HTTP images on HTTPS pages), and the frontend shows
honest freshness indicators instead of pretending everything is always live.

**Do this sprint right after Sprint 1** so real flow data starts accumulating
while you build the frontend sprints.

### Tasks

- [ ] Deploy `semafori-vision/` to Render (Docker Web Service, root dir
      `semafori-vision`, env: `SUPABASE_URL`, `SUPABASE_KEY`,
      `INTERVAL_MINUTES=5`). Free tier spins down without HTTP traffic → add an
      UptimeRobot/cron-job.org ping to `https://<app>.onrender.com/health.json`
      every 10 min.
- [ ] Frontend: add `src/shared/snapshots.js` with
      `SNAPSHOT_BASE = import.meta.env.VITE_SNAPSHOT_BASE_URL || 'http://localhost:8001'`
      and a `snapshotUrl(camName, tick)` helper.
- [ ] Replace the hardcoded `http://localhost:8001/latest_*.jpg` in
      `CamerasPage.jsx` (and `TrafficCommandCenter.jsx` if still used) with the helper.
- [ ] Add `usePipelineHealth()` hook fetching `${SNAPSHOT_BASE}/health.json`
      every 60s; show a LIVE (green) / STALE (amber, with minutes) badge per
      camera on the Cameras page snapshot grid. If fetch fails → "OFFLINE".
- [ ] Add `VITE_SNAPSHOT_BASE_URL=https://<app>.onrender.com` to Vercel env vars
      and to `.env.local`; document in README.

### Verify

- [ ] Render logs show successful cycles; new rows appear in Supabase every 5 min.
- [ ] `https://<app>.onrender.com/latest_pejton.jpg` loads in a browser.
- [ ] Deployed Vercel site shows annotated snapshots (no mixed-content errors
      in DevTools console).
- [ ] Badges change to STALE/OFFLINE when the backend is stopped.

### AI prompt — Sprint 2

```text
You are working in the SEMAFORI React repo (Vite + React 19 + Tailwind).
The companion Python service (../semafori-vision) runs scheduler.py which
serves annotated snapshots and health.json over HTTP from its `output/`
directory. The frontend currently hardcodes
`http://localhost:8001/latest_<camera>.jpg` inside `src/pages/CamerasPage.jsx`
in the 2×2 snapshot grid (and `src/pages/TrafficCommandCenter.jsx` may also
contain it — check).

IMPLEMENT:

1. Create `src/shared/snapshots.js`:
   - `export const SNAPSHOT_BASE = (import.meta.env.VITE_SNAPSHOT_BASE_URL || 'http://localhost:8001').replace(/\/$/, '');`
   - `export function snapshotUrl(camName, tick) { return `${SNAPSHOT_BASE}/latest_${camName}.jpg?t=${tick ?? ''}`; }`
   - `export async function fetchPipelineHealth(signal) { /* GETs SNAPSHOT_BASE + '/health.json', returns parsed JSON or null on any error */ }`

2. Create `src/hooks/usePipelineHealth.js`: polls fetchPipelineHealth every
   60s, returns { health, online } where online is true if the last fetch
   succeeded. Must clean up intervals and ignore stale responses after unmount.

3. Update `src/pages/CamerasPage.jsx`:
   - Replace the hardcoded img src with snapshotUrl(cam.name, snapTick).
   - In the snapshot grid, add a small status badge per camera using
     usePipelineHealth: green "LIVE" if health.cameras[cam.id].last_success_utc
     is < 10 minutes old, amber "STALE Xm" otherwise, gray "OFFLINE" if the
     health fetch failed. Match the existing dark HUD style (tiny font-mono
     badges on black/50 background like the existing name label).

4. README.md: document `VITE_SNAPSHOT_BASE_URL` (local default
   http://localhost:8001; production value is the Render HTTPS URL) in the
   `.env.local` example and in the "Lidhja me semafori-vision" section.

CONSTRAINTS: Do not change any other page. Keep the existing design language
(dark #09090b, glass-card, iconify-icon). No new npm dependencies.
`npm run build` and `npm run lint` must pass.

NOTE FOR ME (not code): I will deploy the backend to Render myself (Docker,
root dir semafori-vision, env SUPABASE_URL/SUPABASE_KEY/INTERVAL_MINUTES) and
set VITE_SNAPSHOT_BASE_URL in Vercel. Also remind me to add an UptimeRobot
ping to https://<render-app>.onrender.com/health.json every 10 minutes so the
free tier stays awake.
```

---

## Sprint 3 — CamerasPage: 100% real data

**Goal:** The main page currently shows random-walk numbers (`rng()`) for
vehicles/speed/congestion/wait/directions, a hardcoded throughput chart,
hardcoded vehicle-type percentages, and a hardcoded incident log. Replace
every one of them with values computed from Supabase — or remove what cannot
be measured honestly.

**Data available** (Supabase): `traffic_load` (per camera: vehicle_count,
rolling_rate, load_level, percentiles, timestamp) and `traffic_counts`
(history: vehicle_count, vehicle_type_breakdown JSONB, in_count/out_count
after Sprint 1, avg_confidence, timestamp).

### Tasks

- [ ] Create `src/hooks/useTrafficData.js`: polls `traffic_load` (30s) and
      `traffic_counts` for the last 24h (60s); returns loads, counts, and
      derived aggregates (network totals, vehicle-type totals from JSONB,
      hourly histogram for today, per-camera recent series).
- [ ] **Vehicles metric** → sum of latest counts (or selected camera's count);
      sparkline from the camera's last ~18 real cycles.
- [ ] **Congestion index** → derived from `load_level` values
      (low=15 / medium=45 / high=70 / congested=90, averaged across cameras).
- [ ] **Vehicle Types** → aggregate `vehicle_type_breakdown` over today's
      rows (real car/truck/bus/motorcycle percentages).
- [ ] **Hourly Throughput chart** → today's counts grouped by hour; second
      series = same hours yesterday (label honestly: "Today" vs "Yesterday").
- [ ] **Incident Log** → real rows via `fetchIncidentReports(user.id)`.
- [ ] **Direction card** → if `in_count`/`out_count` columns have data: show
      real In/Out split for the selected camera; otherwise remove the card.
- [ ] **Remove**: Avg Speed, Avg Wait Time, Signal Phase simulation
      (unmeasurable with one camera). Replace with real cards: "Peak today"
      (max count + time + camera) and "Detection confidence"
      (avg of `avg_confidence`).
- [ ] Delete the `rng()` stats interval, `THROUGHPUT_DATA`,
      `INITIAL_INCIDENTS`, and the fake phase timer. Keep clock and latency
      (measure latency as the real fetch round-trip to Supabase).
- [ ] Keep the Gjirafa iframes, snapshot grid, LIVE/STALE badges, and all
      styling exactly as-is.

### Verify

- [ ] Every number on `/cameras` traces back to a Supabase column.
- [ ] No `Math.random()` remains for displayed data in `CamerasPage.jsx`.
- [ ] `npm run build` + `npm run lint` pass; page works with an empty
      `traffic_counts` table (graceful zeros, no crashes).

### AI prompt — Sprint 3

```text
You are working in the SEMAFORI React repo (Vite + React 19 + Tailwind,
Supabase JS client in src/services/supabaseClient.js).

MISSION: `src/pages/CamerasPage.jsx` currently fakes most of its telemetry.
Make every displayed number real, sourced from Supabase. Golden rule: if a
metric cannot be computed from the database, delete it — never simulate.

CURRENT FAKES TO ELIMINATE in CamerasPage.jsx:
- `rng()`-driven interval updating vehicles/speed/congestion/waitTime/dirN/
  dirS/dirE/dirW every 3s
- hardcoded `THROUGHPUT_DATA` and `INITIAL_INCIDENTS`
- hardcoded Vehicle Types percentages (78/12/6/4)
- the Signal Phase card (PHASES/PHASE_DURATIONS) and Avg Wait Time card
- Sparkline component using Math.random

REAL DATA AVAILABLE (Supabase):
- `traffic_load`: one row per camera — camera_id, camera_name, vehicle_count,
  rolling_rate, load_level ('low'|'medium'|'high'|'congested'),
  percentile_40/70/90, timestamp. Already fetched on this page every 30s.
- `traffic_counts`: history — camera_id, vehicle_count,
  vehicle_type_breakdown (JSONB e.g. {"car":5,"truck":2}), in_count,
  out_count, avg_confidence, timestamp.
- `src/shared/trafficData.js` exports CAMERA_LOCATIONS, getLoadColor.
- `src/services/reportService.js` exports fetchIncidentReports(userId)
  returning real user incident reports (title, status, severity, createdAt).
- `src/hooks/useAuth.js` exposes the current user.

IMPLEMENT:

1. New hook `src/hooks/useTrafficData.js`:
   - Fetches traffic_load every 30s and traffic_counts (last 24h, ordered by
     timestamp) every 60s via the shared supabase client.
   - Returns { loads, counts, hourlyToday, hourlyYesterday,
     vehicleTypeTotals, networkCongestion, peaks }:
     * hourlyToday/hourlyYesterday: arrays of 24 sums grouped by hour (local
       time) for today / yesterday.
     * vehicleTypeTotals: summed JSONB breakdown across today's rows.
     * networkCongestion: average of load_level mapped low=15, medium=45,
       high=70, congested=90 (rounded).
     * peaks: {count, timestamp, camera_name} of the max row in the last 24h.
   - Cleans up intervals; safe when tables are empty.

2. Rewrite CamerasPage.jsx metrics (KEEP the layout, glass-card style,
   iconify icons, iframe player, snapshot grid, and badges untouched):
   - "Vehicles / hr" card → sum of traffic_load vehicle_count (label it
     "Vehicles last cycle"); trend chip compares today's total so far vs
     yesterday's same-hours total (hide chip if no yesterday data).
   - Sparklines → last 18 vehicle_count values for the relevant camera (or
     network sum), real data only.
   - "Avg Speed" card → REPLACE with "Detection confidence": average of
     avg_confidence over the last 24h as a percentage.
   - "Congestion Index" card → networkCongestion from the hook.
   - "Incidents" card → real count of user's reports with status 'active';
     list the latest real report title.
   - Hourly Throughput chart → hourlyToday (orange) vs hourlyYesterday
     (zinc); relabel legend "Today" / "Yesterday".
   - "By Direction" card → if any traffic_counts row has in_count or
     out_count > 0, show real summed In vs Out for today (two bars);
     otherwise DELETE the card.
   - Vehicle Types card → real percentages from vehicleTypeTotals
     (car/truck/bus/motorcycle; anything else grouped as "Other").
   - Incident Log card → latest real reports (title, time from createdAt,
     status).
   - Avg Wait Time + Signal Phase cards → DELETE. In their place: "Peak
     today" card (count, HH:MM, camera name) and keep the layout balanced.
   - Latency indicator → measure the real Supabase fetch round-trip time in
     the hook and display it in ms.
   - Remove the rng interval, THROUGHPUT_DATA, INITIAL_INCIDENTS, PHASES,
     and all now-unused state/imports.

3. Empty-state handling: with zero data, cards show 0 or "—" and charts
   render without crashing.

CONSTRAINTS: No new npm dependencies. No Math.random affecting rendered
numbers in this file. Don't touch other pages. `npm run build` and
`npm run lint` must pass.
```

---

## Sprint 4 — Analytics page (the "analyze traffic" core)

**Goal:** Turn the orphaned `TrafficAnalytics.jsx` into a routed, real
analytics page. This is what transforms the project from "live monitor" into
a **traffic analysis tool** — the thing you demo when someone asks "so what
can you learn from the data?"

**Note:** `TrafficAnalytics.jsx` imports `recharts`, which is **not** in
`package.json` — install it first. The page is currently not routed.

### Tasks

- [ ] `npm install recharts`
- [ ] Route `/analytics` (ProtectedRoute) in `App.jsx`; add "Analytics" links
      in `SiteHeader.jsx` and `SiteFooter.jsx`.
- [ ] Keep the existing live-count cards + history line charts; add:
- [ ] **Hour-of-day profile** — average count per hour over the selected
      range, per camera → shows when rush hour actually happens.
- [ ] **Camera comparison** — ranking table/cards: total vehicles, avg/cycle,
      peak, % time congested, per camera over the range.
- [ ] **Vehicle type mix** — stacked bar/area from `vehicle_type_breakdown`.
- [ ] **Load-level distribution** — stacked 100% bar: share of time each
      camera spent low/medium/high/congested (recompute levels from counts
      using each camera's percentile thresholds in `traffic_load`, or add a
      `load_level` snapshot column later — simplest: classify counts against
      the current percentile values).
- [ ] **Peak table** — top 5 cycles in range (count, camera, timestamp).
- [ ] **Anomaly list** — cycles whose count deviates > 2σ from that camera's
      same-hour-of-day mean over the range (with "possible incident or
      camera fault" framing).
- [ ] **Uptime card** — actual rows vs expected cycles
      (range_minutes / INTERVAL_MINUTES=5) per camera → data-coverage %.
- [ ] **CSV export** — download the fetched rows (timestamp, camera, count,
      in, out, breakdown, confidence) as a real CSV via Blob.
- [ ] Range selector 1/3/7/14 days drives ALL widgets.

### Verify

- [ ] `/analytics` loads behind auth; all widgets react to the range selector.
- [ ] Every widget shows real Supabase-derived numbers; empty state is clean.
- [ ] CSV downloads and opens correctly in Excel.
- [ ] `npm run build` + `npm run lint` pass.

### AI prompt — Sprint 4

```text
You are working in the SEMAFORI React repo (Vite + React 19 + Tailwind,
Supabase client in src/services/supabaseClient.js).

MISSION: Build the traffic Analytics page. `src/pages/TrafficAnalytics.jsx`
already exists (live-count cards from `traffic_load` + Recharts line charts
from `traffic_counts` with 1/3/7/14-day ranges) but it is NOT routed and
`recharts` is NOT installed. Finish it into a full analysis page.

DATA (Supabase):
- `traffic_load` (one row/camera): camera_id, camera_name, vehicle_count,
  rolling_rate, load_level, percentile_40/70/90, timestamp.
- `traffic_counts` (history): camera_id, camera_name, timestamp,
  vehicle_count, vehicle_type_breakdown (JSONB), in_count, out_count,
  avg_confidence.
- Cameras: c001 Fushë Kosova, c002 Aktash, c003 Pejton, c004 Bregu i Diellit
  (see CAMERAS const at the top of TrafficAnalytics.jsx).
- Scheduler interval is 5 minutes → expected cycles per camera per day = 288.

IMPLEMENT:

1. Run `npm install recharts` (add to package.json dependencies).

2. `src/App.jsx`: add route `/analytics` wrapped in ProtectedRoute rendering
   TrafficAnalytics. Add an "Analytics" link in
   `src/components/SiteHeader.jsx` (navigationLinks) and in the Platform
   column of `src/components/SiteFooter.jsx`.

3. Rework `src/pages/TrafficAnalytics.jsx` (keep existing live-count cards,
   line charts, range selector, and dark theme; match the design language of
   the other pages: glass-card style, iconify-icon, orange accents, compact
   stat-label/stat-value typography). Fetch traffic_counts once per range
   change (select *, gte timestamp = now - range, order asc, limit 10000)
   and derive ALL widgets from that single dataset with useMemo:
   a. KEEP: 4 live-count cards + per-camera line chart with camera picker.
   b. NEW "Hour-of-day profile": BarChart of average vehicle_count per hour
      of day across the range, with per-camera toggle. Highlights when rush
      hour actually happens.
   c. NEW "Camera comparison": table ranking cameras by total vehicles in
      range, with avg/cycle, peak (max + timestamp), and % of cycles above
      that camera's percentile_90 (from traffic_load) — i.e. % time
      congested.
   d. NEW "Vehicle type mix": stacked BarChart per camera (or per day for
      7/14d) using summed JSONB breakdown keys car/truck/bus/motorcycle.
   e. NEW "Load distribution": 100% stacked horizontal bar per camera —
      share of cycles classified low/medium/high/congested by comparing each
      row's vehicle_count against the camera's percentile_40/70/90 values
      from traffic_load (use getLoadColor from src/shared/trafficData.js).
   f. NEW "Peak cycles": table of the top 5 rows in range (camera, count,
      formatted timestamp).
   g. NEW "Anomalies": list rows where |count − mean_same_hour_same_camera|
      > 2·stddev (computed over the range). Show camera, timestamp, count,
      and "×σ above/below typical" — framed as possible incidents or camera
      faults. Empty state: "No anomalies detected in this range."
   h. NEW "Data coverage": per camera, actual rows vs expected
      (range_minutes / 5) as a percentage progress bar — operational uptime.
   i. NEW "Export CSV" button in the header: builds a CSV of the fetched
      rows (timestamp, camera_id, camera_name, vehicle_count, in_count,
      out_count, vehicle_type_breakdown JSON-stringified, avg_confidence)
      and downloads it via Blob/URL.createObjectURL, filename
      `semafori_counts_<range>d.csv`.

4. All widgets must react to the 1/3/7/14-day selector and handle empty
   data gracefully ("No data for this range" placeholders, no crashes).

CONSTRAINTS: Keep the page consistent with existing styling (SiteHeader/
SiteFooter already used). No other new dependencies. No simulated values.
`npm run build` and `npm run lint` must pass.
```

---

## Sprint 5 — AI Chat + Live Map: real data integration

**Goal:** The AI assistant currently reasons over the hardcoded
`baseTrafficMarkers` (fake "CBD Gridlock", 847 vehicles, etc.), and its
sidebar stats are random. The map shows those same fake incidents. Wire both
to live data so the AI answers with **real current numbers** — the most
impressive demo moment.

### Tasks

- [ ] `AIChatPage.jsx`: build a live network summary from `traffic_load` +
      last-24h `traffic_counts` (per camera: current count, load level,
      rolling rate, today's peak) and inject it into the Groq prompt instead
      of the fake-marker summary. Sidebar metrics become real (reuse
      `useTrafficData` from Sprint 3); direction card shows real In/Out or
      is removed.
- [ ] Update `buildTrafficSummary` usage (or add `buildLiveNetworkSummary` in
      `trafficData.js`) so the model gets: per-camera count/level/rate,
      network total, busiest camera right now, and today's peak cycle.
- [ ] Quick prompts reference real cameras ("How is traffic near Pejton?").
- [ ] `LiveMapPage.jsx`: remove `baseTrafficMarkers` from the map and the
      Incidents tab (keep camera load markers + user-persisted markers).
      Keep the report form (already real).
- [ ] LiveMap stats tab: when a **camera** marker is selected, show real
      stats from `traffic_counts` (last-24h sparkline, avg/cycle, peak),
      not `vehicles * 12` math. For user markers keep the report details.
- [ ] Legend: add the camera load colors (low/medium/high/congested).

### Verify

- [ ] Ask the AI "How is traffic near Aktash?" → the answer contains the
      same numbers as the `traffic_load` table.
- [ ] Map shows only camera markers + real user markers; no "CBD Gridlock".
- [ ] Camera marker stats match Supabase data.
- [ ] `npm run build` + `npm run lint` pass.

### AI prompt — Sprint 5

```text
You are working in the SEMAFORI React repo (Vite + React 19 + Tailwind,
Supabase client in src/services/supabaseClient.js).

MISSION: Wire the AI chat and the Live Map to real traffic data. Today both
run on the hardcoded `baseTrafficMarkers` array (fake incidents like "CBD
Gridlock", 847 vehicles) in `src/shared/trafficData.js`, plus random sidebar
stats in `src/pages/AIChatPage.jsx`.

REAL DATA (Supabase): `traffic_load` (per camera: vehicle_count, rolling_rate,
load_level, timestamp) and `traffic_counts` (24h history incl.
vehicle_type_breakdown, in_count, out_count, avg_confidence). A hook
`src/hooks/useTrafficData.js` already exists (from a previous sprint) that
polls traffic_load (30s) and traffic_counts last-24h (60s) and returns
aggregates — use it; extend it if a small extra aggregate is needed.

IMPLEMENT:

1. `src/shared/trafficData.js`: add `buildLiveNetworkSummary(loads, counts)`
   returning a plain-English summary: per-camera current count, load_level,
   rolling_rate; network total; busiest camera; today's peak cycle
   (count + time + camera). Keep the existing buildTrafficSummary export
   (used elsewhere) but it becomes unused on these pages.

2. `src/pages/AIChatPage.jsx`:
   - Replace the random `rng()` sidebar stats with real values from
     useTrafficData: Vehicles/cycle (sum of loads), Congestion
     (networkCongestion), Avg Wait Time card → replace with "Detection
     confidence" (avg avg_confidence 24h) or remove; Direction card → real
     summed In/Out today, or delete if no in/out data.
   - getAssistantReply: replace the markers-based context with
     buildLiveNetworkSummary(loads, counts) in the user prompt to Groq, and
     make buildRouteFallback's non-route branch use the live summary (real
     busiest camera, real counts) instead of baseTrafficMarkers.
   - Keep route detection (Nominatim/OSRM/Google) and map links unchanged.
   - Update quickPrompts to reference real cameras, e.g. "How is traffic
     near Pejton right now?", "Which intersection is busiest today?",
     "Route from Prishtine to Ferizaj".
   - The right-panel "Camera Load" list already reads traffic_load — keep,
     and add rolling_rate next to the count.

3. `src/pages/LiveMapPage.jsx`:
   - Remove baseTrafficMarkers from combinedMarkers and from the Incidents
     tab — the map shows only camera load markers (real) + persisted user
     markers (real). Keep the report form untouched (already saves real
     reports).
   - Stats tab: if the selected marker is a camera marker, fetch that
     camera's last-24h traffic_counts and render real stats: last-24h
     sparkline (real values, not random), avg vehicles/cycle, peak
     (count + HH:MM), and current load_level. If it's a user marker, keep
     showing its report details. Remove the `vehicles * 12` "Daily Traffic"
     math and random sparkline data.
   - Legend panel: add the four camera load colors
     (low #10b981, medium #f59e0b, high #f97316, congested #ef4444 — already
     in getLoadColor).

CONSTRAINTS: No new npm dependencies. No Math.random for rendered numbers on
these two pages. Keep Groq model + prompt style. `npm run build` and
`npm run lint` must pass.
```

---

## Sprint 6 — Polish + thesis extras

**Goal:** Finish with a clean, consistent, defensible codebase and surface
your validation work (which examiners love and nobody shows).

### Tasks

- [ ] Run `validate_counts.py` (manual ground truth) and
      `benchmark_detectors.py`; store results in `docs/VALIDATION.md`; add a
      small "Model accuracy" card on the Analytics page showing the measured
      accuracy (honest, measured number — e.g. "92% count accuracy vs manual
      ground truth").
- [ ] Remove unused npm deps: `@tensorflow/tfjs`, `@tensorflow-models/coco-ssd`,
      `hls.js` (verify zero imports first) → smaller bundle, cleaner review.
- [ ] Archive or delete unrouted legacy files: `src/pages/Dashboard.jsx`,
      `src/pages/TrafficCommandCenter.jsx`, `src/components/AIAssistant.jsx`,
      `src/components/Settings.jsx`, `src/components/TrafficMap.jsx` (verify
      zero imports first; prefer moving to `src/legacy/` over deleting).
- [ ] Sync README: routes are `/cameras`, `/ai-chat`, `/live-map`,
      `/analytics`, `/profile` — not `/dashboard`/`/traffic-analytics`;
      document `VITE_SNAPSHOT_BASE_URL`, `PIPELINE_MODE`, in/out columns.
- [ ] Optional: `semafori-vision/backfill_counts.py` — clearly-labeled demo
      seeding script that inserts synthetic-but-realistic historical rows
      (morning/evening rush curves) into `traffic_counts` for a past date
      range, with `--camera`, `--days`, and a loud printed warning that this
      is demo data. Only for filling 7/14-day charts before enough real
      history exists; disclose it in the thesis.
- [ ] Final QA: `npm run build`, `npm run lint`, full click-through
      (login → cameras → analytics → ai-chat → live-map → profile), verify
      the deployed site end-to-end against the deployed backend.

### AI prompt — Sprint 6

```text
You are working in the SEMAFORI workspace (React repo + ../semafori-vision
Python service). Final polish sprint. Do ALL of:

1. `grep`-verify these npm packages have zero imports in src/, then remove
   them from package.json and run npm install: @tensorflow/tfjs,
   @tensorflow-models/coco-ssd, hls.js.

2. Verify these files are not imported anywhere in src/ (check App.jsx and
   all pages/components), then MOVE them into a new `src/legacy/` folder
   (keep them in the repo, out of the app): src/pages/Dashboard.jsx,
   src/pages/TrafficCommandCenter.jsx, src/components/AIAssistant.jsx,
   src/components/Settings.jsx, src/components/TrafficMap.jsx. If any IS
   imported, report it instead of moving.

3. Update README.md: correct the routed pages list (/, /login, /signup,
   /cameras, /ai-chat, /live-map, /analytics, /profile), add
   VITE_SNAPSHOT_BASE_URL to the .env.local example, and add one paragraph
   describing the tracked pipeline (PIPELINE_MODE) and the in_count/
   out_count columns in traffic_counts.

4. Create `docs/VALIDATION.md` with a template I will fill after running
   `python validate_counts.py` and `python benchmark_detectors.py` in
   semafori-vision (sections: ground-truth method, per-camera precision/
   recall/F1, YOLOv8n vs YOLO11n speed/accuracy table, conclusion). Then add
   a small "Model quality" card at the bottom of
   `src/pages/TrafficAnalytics.jsx` that reads the headline numbers from a
   new `src/shared/validationResults.js` constants file (clearly marked as
   measured values with the measurement date) and shows them as stat chips
   (e.g. "Count F1: —", "Model: YOLOv8n", "Benchmarked: —"). Default values
   are null → card hides itself until I fill the file.

5. Create `semafori-vision/backfill_counts.py`: CLI script (argparse
   --camera --days --interval-minutes 5) that inserts synthetic historical
   rows into traffic_counts using the same write_count() from supabase_db.
   Shape: daily curve with morning (07:30–09:00) and evening (16:30–18:30)
   rush peaks, low night values, ±20% noise, random in/out split,
   vehicle_type_breakdown ~ {car 78%, truck 12%, bus 6%, motorcycle 4%},
   avg_confidence ~0.55±0.1. Print a loud warning that this is DEMO data and
   require a `--i-understand-demo-data` flag to run. Document it in
   semafori-vision/README.md as explicitly demo-only.

CONSTRAINTS: `npm run build` and `npm run lint` must pass at the end. The
Python script needs no new pip deps. Report every file moved/removed.
```

---

## Definition of Done (whole project)

When all 6 sprints are complete, you should be able to say — truthfully:

- [ ] Every number in the UI comes from Supabase or is clearly labeled.
- [ ] Counts mean "vehicles crossing the counting line per cycle", with
      in/out direction split, stored in PostgreSQL.
- [ ] The pipeline runs 24/7 on a public host; the dashboard shows
      LIVE/STALE per camera.
- [ ] `/analytics` answers: When is rush hour? Which intersection is busiest?
      What's the vehicle mix? How often is each road congested? Were there
      anomalies? Is the system healthy? — and exports CSV.
- [ ] The AI assistant quotes live camera numbers in its answers.
- [ ] Measured counting accuracy (from `validate_counts.py`) is visible in
      the UI and documented in `docs/VALIDATION.md`.
- [ ] `npm run build` + `npm run lint` pass; the Vercel site works
      end-to-end with no localhost dependencies.

## Tips for running the prompts

- Paste each prompt as the **first message of a fresh AI session** for best
  focus, and attach/point it to this workspace.
- If the AI's output fails verification, paste the failing command output
  back to the same session and ask it to fix before moving on.
- Sprint 1 needs you to run the SQL migration manually in Supabase — the AI
  can't do that part for you.
- Sprint 2 needs your Render/Vercel dashboards — the AI only prepares the code.









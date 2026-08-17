# SEMAFORI

Sistem për menaxhimin e incidenteve në trafik dhe monitorim të trafikut në kohë
reale, i ndërtuar me React, Python, Supabase, Leaflet, dhe Groq.

Përbëhet nga dy shërbime të ndara:

| Shërbimi            | Përshkrimi                                    | Teknologjitë              |
| ------------------- | --------------------------------------------- | ------------------------- |
| **SEMAFORI** (ky repo) | React dashboard – frontend SPA             | React + Vite + Tailwind   |
| **semafori-vision** | Python pipeline – kapje → detektim → numërim  | YOLOv8n + ByteTrack + FFmpeg |

**Live URL:** https://semafori.vercel.app  
**Statusi:** URL u verifikua më 5 maj 2026  

---

## System Architecture 


```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SEMAFORI SYSTEM ARCHITECTURE                       │
│                                                                            │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  GJIRAFA │    │  FFMPEG  │    │   YOLOv8n    │    │   BYTETRACK    │  │
│  │ Slow TV  │───▶│  capture │───▶│  detection   │───▶│   + LineZone   │  │
│  │  (HLS)   │    │  .py     │    │  detect.py   │    │   counting     │  │
│  └──────────┘    └──────────┘    └──────────────┘    └───────┬────────┘  │
│                                                              │           │
│                            ┌─────────────────────────────────┘           │
│                            ▼                                              │
│                      ┌──────────┐    ┌──────────────┐                    │
│                      │ SUPABASE │◀───│ supabase_db  │                    │
│                      │ PostgreSQL│   │ .py          │                    │
│                      └────┬─────┘    └──────────────┘                    │
│                           │                                               │
│              ┌────────────┼────────────┐                                  │
│              ▼            ▼            ▼                                  │
│       ┌──────────┐ ┌──────────┐ ┌───────────┐                            │
│       │traffic_  │ │traffic_  │ │ React     │                            │
│       │counts    │ │load      │ │ Dashboard │                            │
│       │(history) │ │(current  │ │ (this)    │                            │
│       │          │ │ status)  │ │           │                            │
│       └──────────┘ └──────────┘ └───────────┘                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Layer-by-layer walkthrough

#### 1. Camera → Capture (semafori-vision/capture.py)

Four Gjirafa Slow TV cameras in Prishtina serve **HLS (.m3u8) live streams**
over HTTPS.  The Python service uses `ffmpeg` to pull frames from these
streams every 5 minutes.  Two capture modes exist:

- **Single frame** (`capture_frame()`) — grabs one JPEG for quick checks and
  the current production scheduler.
- **Frame sequence** (`capture_sequence()`) — grabs 8 seconds × 3 fps = 24
  frames of raw video for the ByteTrack tracking pipeline.

#### 2. Detection (semafori-vision/detect.py)

**Model:** YOLOv8n ("nano") — ~6 MB, runs on CPU at ~30–80 ms per frame.
Only four COCO vehicle classes are kept: car (2), motorcycle (3), bus (5),
truck (7).  All other classes are discarded.

Two pipelines exist:
- **`detect_vehicles()`** — single-frame detection (used by the current scheduler).
- **`detect_with_tracker()`** — multi-frame detection with ByteTrack + LineZone
  (available for higher-accuracy deployment).

#### 3. Tracking & Counting (ByteTrack + LineZone)

**ByteTrack** (Zhang et al., ECCV 2022) assigns a persistent integer ID to
each vehicle across consecutive frames using IoU matching + Kalman filtering.
**LineZone** (Supervision library) tracks which IDs have crossed a user-defined
counting line — each vehicle is counted exactly once regardless of how many
frames it appears in.

#### 4. Supabase — the data layer

Two PostgreSQL tables store the pipeline output (see `semafori-vision/schema.sql`):

| Table            | Purpose                         | Updated by         |
| ---------------- | ------------------------------- | ------------------ |
| `traffic_counts` | Historical record (one row per camera per cycle) | `supabase_db.py` |
| `traffic_load`   | Current road-load status (one row per camera, upserted) | `traffic_load.py` |

**How load classification works:**
The `traffic_load.py` script fetches the last 6 hours of counts for a camera,
computes the 40th, 70th, and 90th percentiles, and classifies the most recent
cycle's count as **low**, **medium**, **high**, or **congested**.  Fewer than
12 cycles use fixed fallback thresholds (3 / 8 / 18 vehicles per cycle).

Row Level Security allows the `anon` key to INSERT and SELECT — the Python
service and the React dashboard both use the same anon key.  No server-side
API middleman needed.

#### 5. React Dashboard (`TrafficCommandCenter.jsx`, `TrafficAnalytics.jsx`)

This frontend (deployed on Vercel) reads directly from Supabase:

- **TrafficCommandCenter** (`/dashboard`):
  - Embeds four Gjirafa Slow TV iframes for live video monitoring.
  - Fetches `traffic_load` every 15 seconds to show colour-coded load badges
    (green = low, amber = medium, orange = high, red = congested) on the
    video overlay and in the 4-card snapshot grid.
  - Displays annotated detection snapshots served from the Python scheduler's
    lightweight HTTP server on port 8001.
  - AI chat assistant powered by **Groq Llama 3.1 8B** that can estimate
    routes between two places (via OpenStreetMap Nominatim + OSRM / Google
    Maps Directions) and provide traffic advice.
  - Interactive **Leaflet map** with colour-coded traffic markers (high =
    red, medium = amber, low = green) and the ability to create custom
    markers that persist to Supabase.

- **TrafficAnalytics** (`/traffic-analytics`):
  - Four live-count cards showing each camera's current vehicle count and
    load level from `traffic_load`.
  - **Recharts line charts** with 1/3/7/14-day windows showing vehicle count
    history from `traffic_counts`.
  - Explanation cards describing the percentile-based classification method.

#### 6. Scheduler — the conductor (semafori-vision/scheduler.py)

An **APScheduler BackgroundScheduler** runs every `INTERVAL_MINUTES` (default 5):

```
for each camera in cameras.CAMERAS:
    1. capture_frame()           → grab a single JPEG from the HLS stream
    2. detect_vehicles()         → YOLOv8n on that frame
    3. write_count()             → INSERT into traffic_counts
    4. classify_and_write()      → classify load → upsert traffic_load
    5. Copy annotated image      → output/latest_<camera>.jpg
```

Each camera is wrapped in try/except — a failure on one camera does not
affect the others.  The scheduler also spawns a lightweight HTTP server on
port 8001 so the frontend can display annotated snapshots via `<img>` tags.

### Camera locations (Kosova)

| ID   | Emri               | Koordinatat      |
| ---- | ------------------ | ---------------- |
| c001 | Fushë Kosova       | 42.643, 21.089   |
| c002 | Aktash             | 42.664, 21.161   |
| c003 | Pejton             | 42.665, 21.166   |
| c004 | Bregu i Diellit    | 42.652, 21.150   |

Camera feeds are provided by **Gjirafa Slow TV** (video.gjirafa.com).

---

## What does the project do (this part is frontend)

SEMAFORI serves traffic operators and monitoring centers for:

- creating incident reports
- updating and deleting them
- displaying statistics on the dashboard
- selecting a location on the map
- using an AI assistant for analysis and recommendations
- monitoring traffic cameras in real time (Gjirafa Slow TV) with
classifying road load (low / medium / high / congested)
- displaying vehicle count history in graphs
- changing language and theme

## Technologies

| Technology     | Purpose                                     |
| -------------- | ------------------------------------------- |
| React + Vite   | Frontend SPA framework and build tool       |
| Tailwind CSS   | Utility-first CSS for styling               |
| Supabase Auth  | User authentication                         |
| Supabase DB    | Incident, traffic, and load storage         |
| Leaflet        | Interactive map with traffic markers        |
| Groq API       | AI Assistant (Llama 3.1 8B) for analysis    |
| Recharts       | Traffic history graphs                      |
| Vercel         | Front end deployment                        |

## Project Structure

```
SEMAFORI/
├── README.md                       
├── index.html                      # HTML entry point
├── package.json                    # NPM dependencies and scripts
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── postcss.config.js               # PostCSS plugin config
├── eslint.config.js                # ESLint rules
├── vercel.json                     # Vercel deployment config
├── public/                         # Static assets (favicon, logo, icons)
├── docs/                           # Extra documents
│   ├── demo-plan.md                # Demo plan for presentation
│   ├── FINAL_PROJECT_DOCUMENTATION.md
│   └── screenshots/
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Router + context providers
│   ├── index.css                   # Global styles
│   ├── assets/                     # Images and icons
│   ├── components/
│   │   ├── ProtectedRoute.jsx      # Route guard 
│   │   ├── SiteHeader.jsx          # Header 
│   │   └── SiteFooter.jsx          # Footer 
│   ├── context/
│   │   ├── AuthContext.jsx         # Supabase auth state
│   │   ├── ThemeContext.jsx        # Light/dark theme
│   │   └── LanguageContext.jsx     # Shqip/English
│   ├── hooks/
│   │   └── useAuth.js             # Auth hook
│   ├── pages/
│   │   ├── Login.jsx               
│   │   ├── Signup.jsx             
│   │   ├── Profile.jsx             
│   │   ├── CamerasPage.jsx         # Cameras Centre (live, 100% real)
│   │   ├── AIChatPage.jsx          # AI Assistant with live updates
│   │   ├── LiveMapPage.jsx         # Google Maps + traffic layer
│   │   └── TrafficAnalytics.jsx    # Analytics (rush hour, anomalies, CSV)
│   ├── legacy/                     
│   └── services/
│       ├── supabaseClient.js       # Supabase JS client
│       ├── groqService.js          # Groq AI API client
│       └── reportService.js        # CRUD for incident reports
└── semafori-vision/                # Python pipeline 
    ├── README.md
    ├── scheduler.py                # Main entry point — APScheduler loop
    ├── capture.py                  # FFmpeg frame capture
    ├── detect.py                   # YOLOv8n + ByteTrack + LineZone
    ├── supabase_db.py             # Supabase insert
    ├── traffic_load.py            # Road-load classification
    ├── benchmark_detectors.py     # Detector comparison 
    ├── validate_counts.py         # Manual-vs-auto validation 
    └── ...
```

## Main Pages

Application Routes (`src/App.jsx`):

| Route | Page | Description |
| ----- | ----- | ---------- |
| `/` | — | Redirect to `/cameras` |
| `/login` | `Login` | Login with Supabase Auth |
| `/signup` | `Signup` | Account Registration |
| `/cameras` | `CamerasPage` | Camera Hub: 4 Gjirafa live streams, pipeline annotated snapshots, LIVE/STALE badges, and 100% real metrics from Supabase (nothing simulated) |
| `/ai-chat` | `AIChatPage` | Groq Assistant that responds with real live camera numbers + road rating (Nominations + OSRM/Google) with links to Google Maps / Waze / Apple Maps |
| `/live-map` | `LiveMapPage` | Google Maps (dark, Road/Satellite/Hybrid) with real-time Google Traffic layer, colored camera markers by load and user report markers |
| `/analytics` | `TrafficAnalytics` | Full analytics: rush hour profile, camera comparison, vehicle type mix, load distribution, points, anomalies (2σ), data coverage, CSV export |
| `/profile` | `Profile` | User profile, avatar, report statistics |

Old unused files are located in `src/legacy/` (outside the application, stored for reference).

### Detection pipeline (tracked mode)

The Python service (`semafori-vision/scheduler.py`) uses `PIPELINE_MODE=tracked`

(default): for each camera, every 5 minutes, it captures a 32-frame feed

(8 s × 4 fps), runs YOLOv8n-ONNX on each frame, tracks vehicles with
ByteTrack and counts line crossings with LineZone. Each row in
`traffic_counts` contains `vehicle_count` (visible vehicles — median of the feed), `in_count` / `out_count` (line crossings by direction),
`vehicle_type_breakdown` (JSONB) and `avg_confidence`. If feed capture
fails, the camera automatically falls into single-frame mode for that cycle
without affecting other cameras.




## Connecting to semafori-vision

The frontend communicates with the Python pipeline via two routes:

1. **Supabase** — both services read/write to the same tables
(`traffic_counts`, `traffic_load`) using the same anonymous key.
2. **HTTP snapshots** — scheduler.py spawns an HTTP server on port
8001 (or `$PORT` in Render) that serves annotated snapshots
(`output/latest_<camera>.jpg`) and `output/health.json`.
The frontend loads snapshots via the `snapshotUrl()` helper from
`src/shared/snapshots.js`, which uses `VITE_SNAPSHOT_BASE_URL`
(local default: `http://localhost:8001`; in production: HTTPS URL of
Render, e.g. `https://<render-app>.onrender.com` — set as an env var
in Vercel). `health.json` is used by the `usePipelineHealth` hook to
display LIVE / STALE / OFFLINE badges on each camera.


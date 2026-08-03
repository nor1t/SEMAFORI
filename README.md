# SEMAFORI

Sistem për menaxhimin e incidenteve në trafik dhe monitorim të trafikut në kohë
reale, i ndërtuar me React, Supabase, Leaflet, dhe Groq.

Përbëhet nga dy shërbime të ndara:

| Shërbimi            | Përshkrimi                                    | Teknologjitë              |
| ------------------- | --------------------------------------------- | ------------------------- |
| **SEMAFORI** (ky repo) | React dashboard – frontend SPA             | React + Vite + Tailwind   |
| **semafori-vision** | Python pipeline – kapje → detektim → numërim  | YOLOv8n + ByteTrack + FFmpeg |

**Live URL:** https://semafori.vercel.app  
**Statusi:** URL u verifikua më 5 maj 2026  
**Dokumenti i prezantimit:** [docs/demo-plan.md](./docs/demo-plan.md)  
**Dokumentimi final i projektit:** [docs/FINAL_PROJECT_DOCUMENTATION.md](./docs/FINAL_PROJECT_DOCUMENTATION.md)

---

## System Architecture (Thesis Defence Walkthrough)

> This section is written so you can walk someone through the entire data flow
> cold, from camera to dashboard, in under 5 minutes.

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

## Çfarë bën projekti (kjo pjesë frontend)

SEMAFORI u shërben operatorëve të trafikut dhe qendrave të monitorimit për:

- krijimin e raporteve të incidenteve
- përditësimin dhe fshirjen e tyre
- shfaqjen e statistikave në dashboard
- zgjedhjen e lokacionit në hartë
- përdorimin e një asistenti AI për analizë dhe rekomandime
- monitorimin e kamerave të trafikut në kohë reale (Gjirafa Slow TV) me
  klasifikimin e ngarkesës së rrugës (low / medium / high / congested)
- paraqitjen e historikut të numërimit të automjeteve në grafikë
- ndërrimin e gjuhës dhe theme

## Teknologjitë

| Teknologji     | Qëllimi                                     |
| -------------- | ------------------------------------------- |
| React + Vite   | Frontend SPA framework dhe build tool       |
| Tailwind CSS   | Utility-first CSS për stilim                |
| Supabase Auth  | Autentikim i përdoruesve                    |
| Supabase DB    | Ruajtja e incidenteve, trafikut, dhe load   |
| Leaflet        | Hartë interaktive me markerë trafiku        |
| Groq API       | Asistent AI (Llama 3.1 8B) për analizë     |
| Recharts       | Grafikët e historikut të trafikut           |
| Vercel         | Deployment i frontend-it                    |

## Struktura e projektit

```
SEMAFORI/
├── README.md                       # Ky dokument
├── index.html                      # HTML entry point
├── package.json                    # NPM dependencies dhe scripts
├── vite.config.js                  # Vite konfigurimi
├── tailwind.config.js              # Tailwind konfigurimi
├── postcss.config.js               # PostCSS plugin config
├── eslint.config.js                # ESLint rules
├── vercel.json                     # Vercel deployment config
├── public/                         # Static assets (favicon, logo, icons)
├── docs/                           # Dokumentacioni shtesë
│   ├── demo-plan.md                # Plani i demos për prezantim
│   ├── FINAL_PROJECT_DOCUMENTATION.md
│   └── screenshots/
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Router + context providers
│   ├── index.css                   # Global styles
│   ├── assets/                     # Imazhe dhe ikona
│   ├── components/
│   │   ├── ProtectedRoute.jsx      # Route guard (kërkon auth)
│   │   ├── SiteHeader.jsx          # Header i përbashkët
│   │   └── SiteFooter.jsx          # Footer i përbashkët
│   ├── context/
│   │   ├── AuthContext.jsx         # Supabase auth state
│   │   ├── ThemeContext.jsx        # Light/dark theme
│   │   └── LanguageContext.jsx     # Shqip/English
│   ├── hooks/
│   │   └── useAuth.js             # Auth hook
│   ├── pages/
│   │   ├── Login.jsx               # Faqja e hyrjes
│   │   ├── Signup.jsx              # Faqja e regjistrimit
│   │   ├── Profile.jsx             # Profili i përdoruesit
│   │   ├── Dashboard.jsx           # (e ridrejtuar te TrafficCommandCenter)
│   │   ├── TrafficCommandCenter.jsx # Komanda qendrore e trafikut (live)
│   │   └── TrafficAnalytics.jsx    # Analytics & grafikët e trafikut
│   └── services/
│       ├── supabaseClient.js       # Supabase JS client
│       ├── groqService.js          # Groq AI API client
│       └── reportService.js        # CRUD për raportet e incidenteve
└── semafori-vision/                # Python pipeline (shih README-në atje)
    ├── README.md
    ├── scheduler.py                # Main entry point — APScheduler loop
    ├── capture.py                  # FFmpeg frame capture
    ├── detect.py                   # YOLOv8n + ByteTrack + LineZone
    ├── supabase_db.py             # Supabase insert
    ├── traffic_load.py            # Road-load classification
    ├── benchmark_detectors.py     # Detector comparison (thesis)
    ├── validate_counts.py         # Manual-vs-auto validation (thesis)
    └── ...
```

## Faqet kryesore

### 1. TrafficCommandCenter (`/dashboard`)

Faqja kryesore e operatorit të trafikut.  Përmban:

- **Video monitoring** — katër kamera live nga Gjirafa Slow TV me overlay
  që tregon nivelin e ngarkesës (low/medium/high/congested) dhe numrin e
  automjeteve për cikël.
- **Snapshot grid** — katër pamje të fundit të anotuara nga pipeline i
  detektimit, të përditësuara çdo 30 sekonda.
- **AI chat assistant** — Groq Llama 3.1 8B që mund të:
  - Vlerësojë rrugën midis dy vendeve (p.sh. "from Prishtine to Ferizaj")
  - Këshillojë për pikat e kongjestionit
  - Krijimi i linqeve për Google Maps, Waze, dhe Apple Maps
- **Harta interaktive Leaflet** — markerë me ngjyrë për nivelin e trafikut,
  aftësia për të krijuar markerë të rinj që ruhen në Supabase.

### 2. TrafficAnalytics (`/traffic-analytics`)

Faqja e analitikës së trafikut.  Përmban:

- **Katër karta live** — secila kamerë me numrin aktual të automjeteve,
  nivelin e ngarkesës, dhe rolling rate.
- **Grafikët Recharts** — historiku i numërimit të automjeteve për
  1, 3, 7, ose 14 ditë, me mundësi për të zgjedh kamerën.
- **Shpjegimi i metodës** — karta që shpjegojnë klasifikimin me
  percentile, ruajtjen në Supabase, dhe sinkronizimin me hartën.

## Nisja lokale

Krijo `.env.local` me këto vlera:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key    # opsionale
VITE_SNAPSHOT_BASE_URL=http://localhost:8001         # prod: https://<render-app>.onrender.com
```

Pastaj:

```bash
npm install
npm run dev
```

## Komandat kryesore

```bash
npm run dev        # Nis serverin lokal të zhvillimit
npm run build      # Ndërton për production
npm run preview    # Shfaq build-in e production-it lokal
npm run lint       # Kontrollon kodin me ESLint
```

## Lidhja me semafori-vision

Frontend-i komunikon me pipeline-in Python përmes dy rrugëve:

1. **Supabase** — të dy shërbimet lexojnë/shkruajnë në të njëjtat tabela
   (`traffic_counts`, `traffic_load`) duke përdorur të njëjtin anon key.
2. **HTTP snapshots** — scheduler.py spawn-on një HTTP server në portin
   8001 (ose `$PORT` në Render) që shërben pamjet e anotuara
   (`output/latest_<camera>.jpg`) dhe `output/health.json`.
   Frontend-i i ngarkon snapshot-et përmes helper-it `snapshotUrl()` nga
   `src/shared/snapshots.js`, i cili përdor `VITE_SNAPSHOT_BASE_URL`
   (default lokal: `http://localhost:8001`; në production: URL HTTPS e
   Render, p.sh. `https://<render-app>.onrender.com` — vendoset si env var
   në Vercel). `health.json` përdoret nga hook-u `usePipelineHealth` për
   të shfaqur badge-a LIVE / STALE / OFFLINE mbi çdo kamerë.

Për të parë të dhënat reale në frontend, duhet të kesh:

- `semafori-vision/scheduler.py` duke u ekzekutuar
- Supabase të konfiguruar me tabelat nga `schema.sql`
- Frontend-in të lidhur me të njëjtin Supabase project

## Deployment

Ky projekt deploy-ohet në Vercel. `vercel.json` tashmë është i konfiguruar për Vite dhe SPA routing.

Për një deploy të ri:

1. bëj `git push` në branch-in kryesor
2. sigurohu që projekti në Vercel është i lidhur me këtë repo
3. kontrollo që environment variables në Vercel janë të sakta
4. Vercel do të nisë deploy automatikisht

## Kontrolli para prezantimit

Para demos kontrollo:

- `npm run build`
- `npm run lint`
- login/signup
- krijimin e një incidenti
- edit/delete
- hartën
- AI Assistant
- Kamerat live dhe snapshot-et (kërkon `semafori-vision/scheduler.py` aktiv)
- Grafikët në TrafficAnalytics
- `https://semafori.vercel.app`

## Referencat

- Zhang, Y., Sun, P., Jiang, Y., et al. (2022). *ByteTrack: Multi-Object Tracking by Associating Every Detection Box*. ECCV 2022.
- Jocher, G., Chaurasia, A., & Qiu, J. (2023). *Ultralytics YOLO*. https://github.com/ultralytics/ultralytics
- Supervision by Roboflow. https://github.com/roboflow/supervision
- Gjirafa Slow TV — live traffic cameras in Kosova. https://video.gjirafa.com/
- Supabase — open-source Firebase alternative. https://supabase.com/
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { groq } from '../services/groqService';
import { createIncidentReport, fetchIncidentReports } from '../services/reportService';
import { supabase } from '../services/supabaseClient';
import { snapshotUrl } from '../shared/snapshots';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const MAP_CENTER = [42.6629, 21.1655];

// Camera locations for the traffic-load colour-coded markers on the map.
// Must match the lat/lng values in semafori-vision/cameras.py.
const CAMERA_LOCATIONS = [
  { id: 'c001', name: 'fushe-kosova', lat: 42.643, lng: 21.089 },
  { id: 'c002', name: 'aktash', lat: 42.664, lng: 21.161 },
  { id: 'c003', name: 'pejton', lat: 42.665, lng: 21.166 },
  { id: 'c004', name: 'bregu-i-diellit', lat: 42.652, lng: 21.150 },
];

const CAMERA_FEEDS = [
  { id: 'c001', name: 'Fushë Kosova', url: 'https://video.gjirafa.com/embed/slow-tv-fushe-kosova?autoplay=true&am=true' },
  { id: 'c002', name: 'Aktash', url: 'https://video.gjirafa.com/embed/slow-tv-ick-aktash?autoplay=true&am=true' },
  { id: 'c003', name: 'Pejton', url: 'https://video.gjirafa.com/embed/slow-tv-pejton?autoplay=true&am=true' },
  { id: 'c004', name: 'Bregu i Diellit', url: 'https://video.gjirafa.com/embed/slow-tv-bregu-i-diellit-1?autoplay=true&am=true' },
];
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MARKER_DESCRIPTION_PREFIX = '[SEMAFORI_MAP_MARKER]';

const baseTrafficMarkers = [
  {
    id: 'cbd-gridlock',
    lat: 42.6629,
    lng: 21.1655,
    type: 'congestion',
    label: 'CBD Gridlock',
    severity: 'high',
    vehicles: 847,
    avgSpeed: 12,
    road: 'Mother Teresa Blvd',
    note: 'Heavy inbound queue detected across the central intersection.',
  },
  {
    id: 'bill-clinton-delay',
    lat: 42.655,
    lng: 21.17,
    type: 'congestion',
    label: 'Bill Clinton Delay',
    severity: 'medium',
    vehicles: 390,
    avgSpeed: 24,
    road: 'Bill Clinton Blvd',
    note: 'Signal timing is forcing two short spillback cycles.',
  },
  {
    id: 'agim-flow',
    lat: 42.67,
    lng: 21.18,
    type: 'flow',
    label: 'Agim Ramadani Flow',
    severity: 'low',
    vehicles: 238,
    avgSpeed: 41,
    road: 'Agim Ramadani St',
    note: 'Northbound movement is stable with no major queue.',
  },
  {
    id: 'durresit-works',
    lat: 42.645,
    lng: 21.155,
    type: 'construction',
    label: 'Road Work Zone',
    severity: 'medium',
    vehicles: 95,
    avgSpeed: 20,
    road: 'Rruga e Durresit',
    note: 'Temporary lane narrowing near the work area.',
  },
  {
    id: 'm9-incident',
    lat: 42.675,
    lng: 21.185,
    type: 'accident',
    label: 'M-9 Incident',
    severity: 'high',
    vehicles: 45,
    avgSpeed: 0,
    road: 'Highway M-9',
    note: 'Emergency services are clearing a stopped-vehicle crash.',
  },
];

const quickPrompts = [
  'How bad is traffic near Bill Clinton Boulevard right now?',
  'Give me a route from Prishtine to Ferizaj.',
  'Which intersection should be prioritized for signal tuning?',
];

const marqueeItems = [
  'Pejton camera active - 4 lane guide enabled',
  'AI assistant can estimate routes between places and create navigation links',
  'Markers added from the live map are now stored in raportet',
];

const philosophyCards = [
  {
    title: 'Real-time surveillance',
    description: 'Live camera monitoring, compact counting overlays, and junction context for quick decisions.',
  },
  {
    title: 'Predictive route support',
    description: 'The assistant mixes corridor status with place-to-place drive estimates for practical guidance.',
  },
  {
    title: 'Operator-first flow',
    description: 'Video first, route chat second, live map third, with supporting sections kept lower on the page.',
  },
];

const trafficPulse = [52, 46, 40, 38, 44, 59, 92, 138, 174, 188, 176, 162, 154, 160, 172, 184, 208, 224, 219, 190, 152, 114, 82, 60];

const approachDefinitions = [
  {
    id: 'lane-1',
    label: 'Lane 1',
    line: { x1: 16, y1: 68, x2: 31, y2: 68, labelX: 23.5, labelY: 73.5 },
  },
  {
    id: 'lane-2',
    label: 'Lane 2',
    line: { x1: 34, y1: 68, x2: 48, y2: 68, labelX: 41, labelY: 73.5 },
  },
  {
    id: 'lane-3',
    label: 'Lane 3',
    line: { x1: 51, y1: 68, x2: 66, y2: 68, labelX: 58.5, labelY: 73.5 },
  },
  {
    id: 'lane-4',
    label: 'Lane 4',
    line: { x1: 69, y1: 68, x2: 84, y2: 68, labelX: 76.5, labelY: 73.5 },
  },
];

const severityMeta = {
  high: {
    label: 'High',
    badge: 'bg-red-500/15 text-red-300 border border-red-500/20',
    dot: 'bg-red-500',
    color: '#ef4444',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
    dot: 'bg-amber-500',
    color: '#f59e0b',
  },
  low: {
    label: 'Low',
    badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
    dot: 'bg-emerald-500',
    color: '#10b981',
  },
  custom: {
    label: 'Custom',
    badge: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20',
    dot: 'bg-cyan-500',
    color: '#06b6d4',
  },
};

const typeIcons = {
  congestion: 'lucide:alert-triangle',
  accident: 'lucide:siren',
  flow: 'lucide:wind',
  construction: 'lucide:hard-hat',
  custom: 'lucide:map-pin',
};

function createMarkerIcon(color, size = 18) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 3px rgba(15,23,42,0.28);"></div>`,
    className: 'traffic-command-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const baseMarkerIcons = {
  high: createMarkerIcon(severityMeta.high.color),
  medium: createMarkerIcon(severityMeta.medium.color),
  low: createMarkerIcon(severityMeta.low.color),
  custom: createMarkerIcon(severityMeta.custom.color),
};

function formatTravelTime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'not available';
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDistance(distanceKm) {
  return `${distanceKm.toFixed(1)} km`;
}

function buildTrafficSummary(markers) {
  const severeCount = markers.filter((marker) => marker.severity === 'high').length;
  const averageSpeed = Math.round(
    markers.reduce((sum, marker) => sum + marker.avgSpeed, 0) / Math.max(markers.length, 1),
  );
  const busiest = [...markers].sort((left, right) => right.vehicles - left.vehicles)[0];

  return `Current monitored network summary: ${markers.length} tracked corridors, ${severeCount} high-severity points, average measured speed ${averageSpeed} km/h, busiest location "${busiest.label}" on ${busiest.road} with ${busiest.vehicles} vehicles and ${busiest.avgSpeed} km/h average speed.`;
}

function detectRouteRequest(message) {
  const patterns = [
    /from\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i,
    /route\s+from\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i,
    /go(?:ing)?\s+from\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i,
    /nga\s+(.+?)\s+ne\s+(.+?)(?:[.!?]|$)/i,
    /nga\s+(.+?)\s+te\s+(.+?)(?:[.!?]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        origin: match[1].trim(),
        destination: match[2].trim(),
      };
    }
  }

  return null;
}

async function geocodePlace(query, signal) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    signal,
    headers: {
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error('The geocoding service did not respond.');
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`I could not find "${query}" on the map.`);
  }

  return {
    query,
    name: data[0].display_name,
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
  };
}

function buildExternalMapLinks(origin, destination) {
  const google = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.name)}&destination=${encodeURIComponent(destination.name)}&travelmode=driving`;
  const waze = `https://www.waze.com/ul?ll=${destination.lat}%2C${destination.lng}&navigate=yes`;
  const apple = `https://maps.apple.com/?saddr=${encodeURIComponent(origin.name)}&daddr=${encodeURIComponent(destination.name)}&dirflg=d`;

  return [
    { label: 'Google Maps', href: google },
    { label: 'Waze', href: waze },
    { label: 'Apple Maps', href: apple },
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
  if (!response.ok) {
    throw new Error('Google Maps routing service failed.');
  }

  const payload = await response.json();
  if (payload.status !== 'OK' || !Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw new Error(payload.error_message || payload.status || 'No route returned from Google Maps.');
  }

  const primaryRoute = payload.routes[0];
  const leg = primaryRoute.legs?.[0];
  if (!leg) {
    throw new Error('No route leg was returned from Google Maps.');
  }

  const alternatives = payload.routes
    .slice(1, 3)
    .map((route, index) => {
      const altLeg = route.legs?.[0];
      return altLeg
        ? `${index + 1}. ${formatTravelTime(altLeg.duration.value / 60)} for ${formatDistance(altLeg.distance.value / 1000)}`
        : `Alternative ${index + 1}`;
    });

  return {
    source: 'Google Maps Directions',
    distanceKm: leg.distance.value / 1000,
    durationMin: leg.duration.value / 60,
    alternatives,
  };
}

async function fetchOsmRoute(origin, destination, signal) {
  const routeUrl = new URL(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`);
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('alternatives', 'true');
  routeUrl.searchParams.set('steps', 'false');

  const response = await fetch(routeUrl, { signal });
  if (!response.ok) {
    throw new Error('The routing service is temporarily unavailable.');
  }

  const payload = await response.json();
  if (!Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw new Error('No drivable route was returned.');
  }

  const primaryRoute = payload.routes[0];
  const alternatives = payload.routes
    .slice(1, 3)
    .map((route, index) => `${index + 1}. ${formatTravelTime(route.duration / 60)} for ${formatDistance(route.distance / 1000)}`);

  return {
    source: 'OpenStreetMap + OSRM',
    distanceKm: primaryRoute.distance / 1000,
    durationMin: primaryRoute.duration / 60,
    alternatives,
  };
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
      try {
        routeData = await fetchGoogleRoute(routeRequest, controller.signal);
      } catch (googleError) {
        console.warn('Google Maps route failed, falling back to OSRM.', googleError);
      }
    }

    if (!routeData) {
      routeData = await fetchOsmRoute(origin, destination, controller.signal);
    }

    return {
      ok: true,
      source: routeData.source,
      origin,
      destination,
      distanceKm: routeData.distanceKm,
      durationMin: routeData.durationMin,
      alternatives: routeData.alternatives,
      links: buildExternalMapLinks(origin, destination),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'I could not resolve that route right now.',
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildRouteFallback(routeContext, markers) {
  if (routeContext?.ok) {
    const alternatives = routeContext.alternatives.length
      ? ` Alternate options: ${routeContext.alternatives.join(' | ')}.`
      : '';

    return `Using ${routeContext.source}, the drive from ${routeContext.origin.query} to ${routeContext.destination.query} is about ${formatDistance(routeContext.distanceKm)} and ${formatTravelTime(routeContext.durationMin)}.${alternatives} You can open the same destination in Google Maps, Waze, or Apple Maps with the shortcut buttons below.`;
  }

  if (routeContext?.error) {
    return `${routeContext.error} Try asking again in the format "from Prishtine to Ferizaj" so I can build the route preview and map links.`;
  }

  const busiest = [...markers].sort((left, right) => right.vehicles - left.vehicles)[0];
  return `The busiest monitored point right now is ${busiest.label} on ${busiest.road}. It is carrying about ${busiest.vehicles} vehicles with an average speed of ${busiest.avgSpeed} km/h. If you give me a route in the format "from A to B", I can also estimate the drive and prepare map links.`;
}

async function getAssistantReply({ message, history, markers, routeContext }) {
  const fallbackContent = buildRouteFallback(routeContext, markers);

  if (!groq) {
    return {
      content: fallbackContent,
      links: routeContext?.ok ? routeContext.links : [],
      source: routeContext?.ok ? routeContext.source : 'Local fallback',
    };
  }

  const conversation = history
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content }));

  const routeSummary = routeContext?.ok
    ? `Route estimate source: ${routeContext.source}. Origin: ${routeContext.origin.name}. Destination: ${routeContext.destination.name}. Distance: ${formatDistance(routeContext.distanceKm)}. Duration: ${formatTravelTime(routeContext.durationMin)}. Alternatives: ${routeContext.alternatives.join(' | ') || 'none'}.`
    : routeContext?.error
      ? `Route lookup failed: ${routeContext.error}`
      : 'No explicit place-to-place route request detected.';

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.35,
      max_completion_tokens: 420,
      messages: [
        {
          role: 'system',
          content: 'You are the SEMAFORI traffic command assistant. Give practical traffic advice. If route data is provided, use it directly. Keep answers concise, mention the route source when route data exists, and never claim live data from Google Maps, Waze, or Apple Maps unless you only provide launch links for them.',
        },
        {
          role: 'user',
          content: `${buildTrafficSummary(markers)}\n${routeSummary}\nUser request: ${message}`,
        },
        ...conversation,
      ],
    });

    return {
      content: completion.choices[0]?.message?.content?.trim() || fallbackContent,
      links: routeContext?.ok ? routeContext.links : [],
      source: routeContext?.ok ? routeContext.source : 'Groq',
    };
  } catch (error) {
    console.error('Traffic AI error:', error);
    return {
      content: fallbackContent,
      links: routeContext?.ok ? routeContext.links : [],
      source: routeContext?.ok ? routeContext.source : 'Local fallback',
    };
  }
}

function buildMarkerDescription(notes) {
  return `${MARKER_DESCRIPTION_PREFIX}\n${notes?.trim() || 'Operator-created marker'}`;
}

function extractMarkerNotes(description) {
  if (!description) {
    return 'Operator-created marker';
  }

  return description.replace(MARKER_DESCRIPTION_PREFIX, '').trim() || 'Operator-created marker';
}

function isPersistedMapMarker(report) {
  const description = `${report.description || ''}`;
  return description.startsWith(MARKER_DESCRIPTION_PREFIX);
}

function reportToMapMarker(report) {
  return {
    id: `db-${report.id || Date.now()}`,
    reportId: report.id,
    sourceTable: report.sourceTable,
    lat: Number(report.location?.lat),
    lng: Number(report.location?.lng),
    type: 'custom',
    label: report.title || 'Saved marker',
    severity: 'custom',
    vehicles: 0,
    avgSpeed: 0,
    road: 'Saved marker',
    note: extractMarkerNotes(report.description),
    createdAt: report.createdAt,
  };
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });

  return null;
}

// ---------------------------------------------------------------------------
// Vehicle count simulation
// ---------------------------------------------------------------------------

/**
 * Returns a base vehicles-per-cycle rate driven by the current hour.
 * Rush hours (07–09, 16–19) produce higher values; night is quiet.
 */
function getHourlyBaseRate() {
  const hour = new Date().getHours();
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 22;
  if (hour >= 10 && hour <= 15) return 12;
  if (hour >= 20 || hour <= 5) return 3;
  return 8;
}

/**
 * Per-lane multipliers add natural asymmetry: inner lanes carry more traffic
 * on most urban roads, outer lanes are lighter.
 */
const LANE_MULTIPLIERS = {
  'lane-1': 0.75,
  'lane-2': 1.10,
  'lane-3': 1.05,
  'lane-4': 0.80,
};

/**
 * Returns a fresh set of per-lane vehicle counts for one detection cycle.
 * Jitter (±30 %) keeps each update visually alive.
 */
function sampleLaneCounts() {
  const base = getHourlyBaseRate();
  const counts = {};
  for (const laneId of Object.keys(LANE_MULTIPLIERS)) {
    const jitter = 0.70 + Math.random() * 0.60; // 0.70 – 1.30
    counts[laneId] = Math.max(0, Math.round(base * LANE_MULTIPLIERS[laneId] * jitter));
  }
  return counts;
}

/**
 * Custom hook that owns the detection lifecycle.
 * - Starts automatically when `active` is true.
 * - Resets totals and flashes the detection pulse on every interval tick.
 * - Exposes per-lane counts, a running total (vehicles / min), a "flash"
 *   flag per lane (for the detection-line animation), and a session total.
 *
 * @param {boolean} active  Whether counting should be running.
 * @param {number}  intervalMs  How often to emit a new sample (default 2 500 ms).
 */
function useVehicleCountSimulation(active, intervalMs = 2500) {
  const [laneCounts, setLaneCounts] = useState(() =>
    Object.fromEntries(approachDefinitions.map((a) => [a.id, 0])),
  );
  const [sessionTotals, setSessionTotals] = useState(() =>
    Object.fromEntries(approachDefinitions.map((a) => [a.id, 0])),
  );
  const [flashLanes, setFlashLanes] = useState(() =>
    Object.fromEntries(approachDefinitions.map((a) => [a.id, false])),
  );
  const [totalPerMinute, setTotalPerMinute] = useState(0);
  const [detecting, setDetecting] = useState(false);

  // Stable ref so the interval callback always sees the latest `active` value.
  const activeRef = useRef(active);
  activeRef.current = active;

  const tick = useCallback(() => {
    const counts = sampleLaneCounts();
    setLaneCounts(counts);
    setSessionTotals((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(counts)) next[id] = (next[id] || 0) + counts[id];
      return next;
    });

    // Extrapolate to vehicles / minute (one sample covers ~intervalMs ms).
    const samplesPerMinute = 60000 / intervalMs;
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    setTotalPerMinute(Math.round(total * samplesPerMinute));

    // Flash all lanes that registered at least one vehicle.
    const flash = Object.fromEntries(
      Object.entries(counts).map(([id, v]) => [id, v > 0]),
    );
    setFlashLanes(flash);
    const flashDuration = 400;
    setTimeout(() => {
      setFlashLanes(Object.fromEntries(approachDefinitions.map((a) => [a.id, false])));
    }, flashDuration);
  }, [intervalMs]);

  useEffect(() => {
    if (!active) {
      setDetecting(false);
      return;
    }

    setDetecting(true);
    // Emit an initial sample immediately so the UI shows numbers right away.
    tick();

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, tick]);

  // Reset session totals when the camera changes (caller should re-mount or
  // pass a key, but we expose a reset helper just in case).
  const resetSession = useCallback(() => {
    setSessionTotals(Object.fromEntries(approachDefinitions.map((a) => [a.id, 0])));
    setTotalPerMinute(0);
  }, []);

  return { laneCounts, sessionTotals, flashLanes, totalPerMinute, detecting, resetSession };
}

// ---------------------------------------------------------------------------
// CameraSection
// ---------------------------------------------------------------------------

function CameraSection() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [selectedCamera, setSelectedCamera] = useState(
    CAMERA_FEEDS.find((c) => c.id === 'c003') || CAMERA_FEEDS[0],
  );
  const [cameraLoad, setCameraLoad] = useState(null);

  const fetchCameraLoad = useCallback(async (cameraId) => {
    try {
      const result = await supabase
        .from('traffic_load')
        .select('*')
        .eq('camera_id', cameraId)
        .maybeSingle();
      if (!result.error) setCameraLoad(result.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCameraLoad(selectedCamera.id);
    const interval = setInterval(() => fetchCameraLoad(selectedCamera.id), 15000);
    return () => clearInterval(interval);
  }, [selectedCamera.id, fetchCameraLoad]);

  const handleCameraChange = (e) => {
    const camera = CAMERA_FEEDS.find((c) => c.id === e.target.value);
    if (!camera) return;
    setCameraStatus('loading');
    setSelectedCamera(camera);
  };

  const currentCameraFeed = selectedCamera.url;
  const loadLevel = cameraLoad?.load_level || 'low';
  const loadColors = { low: '#10b981', medium: '#f59e0b', high: '#f97316', congested: '#ef4444' };
  const loadColor = loadColors[loadLevel] || '#10b981';
  const loadLabels = { low: 'Low', medium: 'Medium', high: 'High', congested: 'Congested' };

  return (
    <section id="video" className={`py-16 lg:py-20 ${dark ? 'bg-navy-950' : 'bg-paper-50'}`}>
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="eastern-line w-6" />
              <span
                className={`text-[10px] font-medium uppercase tracking-[0.28em] ${
                  dark ? 'text-tblue-300/70' : 'text-tblue-600/70'
                }`}
              >
                Video Monitoring
              </span>
              <div className="eastern-line w-6" />
            </div>
            <h2
              className={`font-serif text-2xl font-bold sm:text-3xl ${
                dark ? 'text-white' : 'text-navy-900'
              }`}
            >
              Live Traffic Cameras
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`text-xs font-semibold uppercase tracking-wide ${
                dark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Camera:
            </label>
            <select
              value={selectedCamera.id}
              onChange={handleCameraChange}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 ${
                dark
                  ? 'border-navy-600 bg-navy-800 text-white focus:ring-tblue-400'
                  : 'border-gray-300 bg-white text-navy-900 focus:ring-tblue-500'
              }`}
            >
              {CAMERA_FEEDS.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main video card */}
        <div
          className={`overflow-hidden rounded-2xl border shadow-xl ${
            dark ? 'border-navy-600/20 bg-navy-900/80' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="relative aspect-video overflow-hidden bg-black">
            {/* ── iframe ── */}
            <div className="absolute inset-0 flex items-center justify-center">
              <iframe
                key={selectedCamera.id}
                title={`Gjirafa ${selectedCamera.name} live camera`}
                src={currentCameraFeed}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setCameraStatus('ready')}
                onError={() => setCameraStatus('error')}
              />
            </div>

            {/* ── HUD overlay ── */}
            <div className="pointer-events-none absolute inset-0">

              {/* Top-left status badge */}
              <div className="absolute left-4 top-4 rounded-xl bg-black/55 px-4 py-2.5 text-left backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-slow" />
                  SEMAFORI Camera
                </div>
                <p className="mt-1 text-[11px] text-gray-200">
                  {cameraStatus === 'ready'
                    ? `Gjirafa ${selectedCamera.name} feed loaded`
                    : cameraStatus === 'loading'
                    ? `Loading Gjirafa ${selectedCamera.name} feed…`
                    : `${selectedCamera.name} feed could not be displayed`}
                </p>
              </div>

              {/* Top-right camera label */}
              <div className="absolute right-4 top-4 rounded-xl bg-black/55 px-4 py-2.5 text-right backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  {selectedCamera.name}
                </div>
                <p className="mt-1 text-[11px] text-gray-200">Gjirafa Slow TV</p>
              </div>

              {/* ── Real-time road-load badge (top-centre) ── */}
              {cameraStatus === 'ready' && (
                <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-xl bg-black/65 px-5 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 flex-shrink-0 items-center justify-center">
                      <span className="block h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: loadColor }} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: loadColor }}>
                      {loadLabels[loadLevel]} Traffic
                    </span>
                    <span className="text-[10px] text-gray-400">|</span>
                    <span className="text-[10px] text-gray-300">
                      <span className="text-white font-semibold">{cameraLoad?.vehicle_count ?? '—'}</span> veh/cycle
                    </span>
                  </div>
                  {cameraLoad?.rolling_rate != null && (
                    <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-gray-400 text-center">
                      Rolling: {cameraLoad.rolling_rate.toFixed(1)} veh/cycle · Updated {cameraLoad.timestamp ? new Date(cameraLoad.timestamp).toLocaleTimeString() : '—'}
                    </div>
                  )}
                </div>
              )}

              {/* Loading / error overlay */}
              {cameraStatus !== 'ready' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                  <div className="rounded-2xl bg-black/65 px-5 py-4 text-center text-white">
                    <div className="text-sm font-semibold">
                      {cameraStatus === 'loading'
                        ? `Connecting to ${selectedCamera.name}…`
                        : `The ${selectedCamera.name} camera could not be shown`}
                    </div>
                    <div className="mt-1 text-xs text-gray-300">
                      {cameraStatus === 'loading'
                        ? 'The Gjirafa embed is being loaded into the page.'
                        : 'The embed source responded unexpectedly in this browser session.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom github-like status bar */}
              <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white backdrop-blur-sm">
                <span className="text-emerald-300">Roboflow rfdetr-small</span> · {loadLabels[loadLevel]} traffic
              </div>
            </div>
          </div>

          {/* ── Footer strip ── */}
          <div
            className={`border-t px-5 py-4 ${
              dark ? 'border-navy-600/20 bg-black/25' : 'border-gray-200 bg-slate-50/85'
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: camera & session stats */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    dark ? 'bg-navy-800 text-white' : 'bg-white text-slate-800'
                  }`}
                >
                  Camera: <span className="text-emerald-400">{selectedCamera.name}</span>
                </div>
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    dark ? 'bg-navy-800 text-white' : 'bg-white text-slate-800'
                  }`}
                >
                  Source: <span className="text-emerald-400">Gjirafa</span>
                </div>

                <div className={`rounded-full px-3 py-1.5 text-[11px] ${dark ? 'bg-black/35 text-gray-400' : 'bg-white text-slate-500'}`}>
                  Detection: Roboflow rfdetr-small · real vehicle counts
                </div>
              </div>

              {/* Right: attribution */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`rounded-full px-3 py-1.5 text-[11px] ${
                    dark ? 'bg-black/35 text-gray-300' : 'bg-white text-slate-600'
                  }`}
                >
                  Live feed provided by Gjirafa Slow TV
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SnapshotGrid — 4 latest annotated detection images ─────────────────────
function SnapshotGrid() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [snapshots, setSnapshots] = useState([]);
  const [tick, setTick] = useState(0);

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
    const interval = setInterval(() => { fetchAll(); setTick(Math.random()); }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className={`py-10 pb-16 ${dark ? 'bg-navy-950' : 'bg-paper-50'}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="eastern-line w-6" />
          <span className={`text-[10px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
            Detection Snapshots
          </span>
          <span className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            · updated every 1 minute
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMERA_LOCATIONS.map((cam) => {
            const load = snapshots.find((s) => s.camera_id === cam.id) || {};
            const level = load.load_level || 'low';
            const loadColors = { low: '#10b981', medium: '#f59e0b', high: '#f97316', congested: '#ef4444' };
            const color = loadColors[level] || '#10b981';
            const name = (cam.name || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            return (
              <div key={cam.id} className={`rounded-2xl overflow-hidden border ${dark ? 'border-navy-600/30 bg-navy-800/40' : 'border-gray-200 bg-white'}`}>
                <div className="aspect-video bg-black relative">
                  <img
                    key={`${cam.name}-${tick}`}
                    src={snapshotUrl(cam.name, tick)}
                    alt={`Snapshot for ${name}`}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="absolute inset-0 items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-600 hidden">
                    (no snapshot)
                  </div>
                  {load.vehicle_count != null && (
                    <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2.5 py-1.5 backdrop-blur-sm">
                      <span className="text-sm font-bold text-white tabular-nums">{load.vehicle_count}</span>
                      <span className="ml-1 text-[9px] text-gray-300">veh</span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{level}</span>
                  </div>
                  <div className={`mt-1 text-[11px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {load.vehicle_count != null ? `Rate: ${(load.rolling_rate || 0).toFixed(1)} veh/cycle` : 'No data yet'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AIChatSection({ markers }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const scrollRef = useRef(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content: 'Ask me about congestion, junction priorities, or a route in the format "from A to B". I can estimate the drive and add launch links for Google Maps, Waze, and Apple Maps.',
      links: [],
      source: 'SEMAFORI AI',
    },
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const handleSend = async (presetValue) => {
    const nextInput = (presetValue ?? input).trim();
    if (!nextInput || typing) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: nextInput,
      links: [],
    };

    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setTyping(true);

    try {
      const routeRequest = detectRouteRequest(nextInput);
      const routeContext = routeRequest ? await fetchRouteContext(routeRequest) : null;
      const reply = await getAssistantReply({
        message: nextInput,
        history,
        markers,
        routeContext,
      });

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply.content,
          links: reply.links,
          source: reply.source,
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const formatContent = (content) => {
    const lines = content.split('\n');
    return lines.map((line, index) => (
      <React.Fragment key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <section id="ai" className={`py-20 lg:py-24 ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="eastern-line w-8" />
            <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              AI Chat
            </span>
          </div>
          <h2 className={`font-serif text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-navy-900'}`}>
            Route-aware assistant
            <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}> before the map</span>
          </h2>
          <p className={`mt-5 text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            This section stays before the live map and can answer regular traffic questions, estimate place-to-place routes, and create launch links for the main navigation apps.
          </p>

          <div className="mt-8 space-y-4">
            {[
              {
                icon: 'lucide:route',
                title: 'Place-to-place route estimates',
                description: 'Ask "from Prishtine to Ferizaj" and the assistant will calculate distance and drive time.',
              },
              {
                icon: 'lucide:navigation',
                title: 'Map handoff links',
                description: 'When a route is found, buttons appear for Google Maps, Waze, and Apple Maps.',
              },
              {
                icon: 'lucide:traffic-cone',
                title: 'Traffic context included',
                description: 'The assistant still sees the monitored junction and corridor data from the dashboard.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-2xl border p-4 ${dark ? 'border-navy-600/20 bg-navy-800/50' : 'border-gray-200 bg-slate-50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dark ? 'bg-tblue-500/10' : 'bg-tblue-50'}`}>
                    <iconify-icon icon={item.icon} width="18" class="text-tblue-500" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.title}</h3>
                    <p className={`mt-1 text-xs leading-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className={`rounded-full px-4 py-2 text-xs transition ${dark ? 'bg-navy-800 text-gray-300 hover:bg-navy-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-3 flex h-[620px] flex-col overflow-hidden rounded-[28px] border ${dark ? 'border-navy-600/20 bg-navy-800/60' : 'border-gray-200 bg-paper-50'}`}>
          <div className={`flex items-center justify-between border-b px-5 py-4 ${dark ? 'border-navy-600/20' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-tblue-500/15">
                <iconify-icon icon="lucide:bot" width="18" class="text-tblue-400" />
                <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-navy-900" />
              </div>
              <div>
                <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>SEMAFORI AI</div>
                <div className={`text-[10px] uppercase tracking-[0.22em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Traffic + route guidance</div>
              </div>
            </div>
            <div className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${dark ? 'bg-navy-700 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
              Route source: OSM / OSRM
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-7 ${
                    message.role === 'user'
                      ? 'bg-tblue-500 text-white'
                      : dark
                        ? 'bg-navy-700/70 text-gray-200'
                        : 'border border-gray-200 bg-white text-slate-700'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
                      <iconify-icon icon="lucide:sparkles" width="11" />
                      {message.source || 'SEMAFORI AI'}
                    </div>
                  )}
                  {formatContent(message.content)}

                  {message.links?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.links.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={`rounded-full px-3 py-2 text-xs font-medium transition ${message.role === 'user'
                            ? 'bg-white/15 text-white hover:bg-white/20'
                            : dark
                              ? 'bg-navy-900 text-tblue-200 hover:bg-navy-950'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          Open in {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className={`rounded-3xl px-4 py-3 ${dark ? 'bg-navy-700/70' : 'border border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-tblue-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-tblue-400" style={{ animationDelay: '0.1s' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-tblue-400" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`border-t p-5 ${dark ? 'border-navy-600/20' : 'border-gray-200'}`}>
            <div className={`rounded-[22px] border p-2 ${dark ? 'border-navy-600/20 bg-navy-900/60' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSend();
                    }
                  }}
                  placeholder='Ask about traffic, or type a route like "from Prishtine to Ferizaj"'
                  className={`flex-1 bg-transparent px-3 py-3 text-sm outline-none ${dark ? 'text-white placeholder:text-gray-500' : 'text-slate-700 placeholder:text-slate-400'}`}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || typing}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-tblue-500 text-white transition hover:bg-tblue-600 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  <iconify-icon icon="lucide:send" width="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveMapSection({ markers }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';
  const [savedMarkers, setSavedMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [markerError, setMarkerError] = useState('');
  const [savingMarker, setSavingMarker] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(markers[0]);
  const [draftMarker, setDraftMarker] = useState({
    label: '',
    notes: '',
    lat: MAP_CENTER[0].toFixed(6),
    lng: MAP_CENTER[1].toFixed(6),
  });
  const [trafficLoads, setTrafficLoads] = useState([]);

  const combinedMarkers = useMemo(() => [...markers, ...savedMarkers], [markers, savedMarkers]);

  // ── Fetch traffic_load for camera colour-coded markers ────────────
  useEffect(() => {
    const fetchTrafficLoads = async () => {
      try {
        const result = await supabase
          .from('traffic_load')
          .select('*')
          .order('camera_id', { ascending: true });
        if (result.error) throw new Error(result.error.message);
        setTrafficLoads(result.data || []);
      } catch (err) {
        console.error('Failed to fetch traffic_load:', err);
      }
    };
    fetchTrafficLoads();
    const interval = setInterval(fetchTrafficLoads, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMarkers = async () => {
      if (!user?.id) {
        setSavedMarkers([]);
        setMarkersLoading(false);
        return;
      }

      setMarkersLoading(true);
      setMarkerError('');

      try {
        const reports = await fetchIncidentReports(user.id);
        if (cancelled) {
          return;
        }

        const persistedMarkers = reports
          .filter((report) => isPersistedMapMarker(report) && Number.isFinite(Number(report.location?.lat)) && Number.isFinite(Number(report.location?.lng)))
          .map(reportToMapMarker);

        setSavedMarkers(persistedMarkers);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load map markers:', error);
          setMarkerError(error?.message || 'Could not load saved markers.');
        }
      } finally {
        if (!cancelled) {
          setMarkersLoading(false);
        }
      }
    };

    loadMarkers();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handlePrefillFromMap = (latlng) => {
    setDraftMarker((previous) => ({
      ...previous,
      lat: latlng.lat.toFixed(6),
      lng: latlng.lng.toFixed(6),
    }));
  };

  const handleAddMarker = async () => {
    const lat = Number(draftMarker.lat);
    const lng = Number(draftMarker.lng);
    const label = draftMarker.label.trim();

    if (!user?.id) {
      setMarkerError('You need to be signed in to save a map marker.');
      return;
    }

    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMarkerError('Enter a marker name and valid coordinates.');
      return;
    }

    setSavingMarker(true);
    setMarkerError('');

    try {
      const savedReport = await createIncidentReport(user.id, {
        title: label,
        description: buildMarkerDescription(draftMarker.notes),
        type: 'construction',
        severity: 'minor',
        status: 'active',
        location: { lat, lng },
      });

      const savedMarker = reportToMapMarker(savedReport);
      setSavedMarkers((previous) => [savedMarker, ...previous]);
      setSelectedMarker(savedMarker);
      setDraftMarker((previous) => ({
        ...previous,
        label: '',
        notes: '',
      }));
    } catch (error) {
      console.error('Failed to save map marker:', error);
      setMarkerError(error?.message || 'Could not save this marker to raportet.');
    } finally {
      setSavingMarker(false);
    }
  };

  return (
    <section id="map" className={`py-20 lg:py-24 ${dark ? 'bg-navy-950' : 'bg-paper-50'}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="eastern-line w-8" />
            <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              Live Map
            </span>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className={`font-serif text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-navy-900'}`}>
                Map view with
                <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}> saved custom markers</span>
              </h2>
              <p className={`mt-3 text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Click anywhere on the map to prefill coordinates, then save a marker. New markers are written to the `raportet` table and loaded again on refresh.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(severityMeta).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${value.dot}`} />
                  <span className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{value.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className={`lg:col-span-2 overflow-hidden rounded-[28px] border ${dark ? 'border-navy-600/20' : 'border-gray-200'}`}>
            <div className="relative h-[560px]">
              <MapContainer center={MAP_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} className="h-full w-full">
                <TileLayer
                  url={dark
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                  attribution={dark
                    ? '&copy; OpenStreetMap contributors &copy; CARTO'
                    : '&copy; OpenStreetMap contributors'}
                />
                <MapClickHandler onPick={handlePrefillFromMap} />

                {combinedMarkers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={[marker.lat, marker.lng]}
                    icon={baseMarkerIcons[marker.severity] || baseMarkerIcons.low}
                    eventHandlers={{
                      click: () => setSelectedMarker(marker),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[180px] p-1 text-sm">
                        <div className="font-semibold">{marker.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{marker.road}</div>
                        <div className="mt-3 space-y-1 text-xs text-slate-700">
                          <div>Severity: {severityMeta[marker.severity]?.label || marker.severity}</div>
                          <div>Vehicles: {marker.vehicles || 0}</div>
                          <div>Average speed: {marker.avgSpeed || 0} km/h</div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* ── Traffic-load camera markers (colour-coded by load_level) ── */}
                {(trafficLoads || []).map((tl) => {
                  const meta = CAMERA_LOCATIONS.find((c) => c.id === tl.camera_id);
                  if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return null;

                  const level = tl.load_level || 'low';
                  const loadColors = {
                    low: '#10b981',
                    medium: '#f59e0b',
                    high: '#f97316',
                    congested: '#ef4444',
                  };
                  const color = loadColors[level] || loadColors.low;
                  const icon = createMarkerIcon(color, 22);

                  const name = (tl.camera_name || meta.name || '').replace(/-/g, ' ');
                  const popupLabel = name.charAt(0).toUpperCase() + name.slice(1);

                  return (
                    <Marker
                      key={`cam-${tl.camera_id}`}
                      position={[meta.lat, meta.lng]}
                      icon={icon}
                      eventHandlers={{
                        click: () =>
                          window.location.assign(`/traffic-analytics#${meta.name}`),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[180px] p-1 text-sm">
                          <div className="font-semibold">{popupLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Road load: <span style={{ color, fontWeight: 'bold' }}>{level.toUpperCase()}</span>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-slate-700">
                            <div>Vehicles: {tl.vehicle_count || 0}</div>
                            <div>Rolling rate: {tl.rolling_rate?.toFixed(1) || '0.0'} veh/cycle</div>
                            <div>Updated: {tl.timestamp ? new Date(tl.timestamp).toLocaleTimeString() : '—'}</div>
                          </div>
                          <div className="mt-2 text-xs text-tblue-500 underline cursor-pointer">
                            View analytics →
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              <div className="absolute left-4 top-4 rounded-2xl bg-black/55 px-4 py-3 text-xs text-white backdrop-blur-sm">
                Click the map to grab coordinates for your new marker.
              </div>
              <div className="absolute bottom-4 left-4 rounded-full bg-tblue-500/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-lg">
                Live map - markers saved to raportet
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`rounded-[28px] border p-6 ${dark ? 'border-navy-600/20 bg-navy-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-serif text-2xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>Create marker</h3>
                  <p className={`mt-2 text-xs leading-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Save your point directly into Supabase through the existing `raportet` service.
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${dark ? 'bg-navy-800 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                  Persistent
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className={`mb-2 block text-xs font-medium uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Marker name
                  </label>
                  <input
                    value={draftMarker.label}
                    onChange={(event) => setDraftMarker((previous) => ({ ...previous, label: event.target.value }))}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${dark ? 'border-navy-600/20 bg-navy-800 text-white placeholder:text-gray-500' : 'border-gray-200 bg-slate-50 text-slate-700 placeholder:text-slate-400'}`}
                    placeholder="School crossing queue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`mb-2 block text-xs font-medium uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Latitude
                    </label>
                    <input
                      value={draftMarker.lat}
                      onChange={(event) => setDraftMarker((previous) => ({ ...previous, lat: event.target.value }))}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${dark ? 'border-navy-600/20 bg-navy-800 text-white' : 'border-gray-200 bg-slate-50 text-slate-700'}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-2 block text-xs font-medium uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Longitude
                    </label>
                    <input
                      value={draftMarker.lng}
                      onChange={(event) => setDraftMarker((previous) => ({ ...previous, lng: event.target.value }))}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${dark ? 'border-navy-600/20 bg-navy-800 text-white' : 'border-gray-200 bg-slate-50 text-slate-700'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`mb-2 block text-xs font-medium uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Notes
                  </label>
                  <textarea
                    value={draftMarker.notes}
                    onChange={(event) => setDraftMarker((previous) => ({ ...previous, notes: event.target.value }))}
                    className={`min-h-[110px] w-full rounded-2xl border px-4 py-3 text-sm outline-none ${dark ? 'border-navy-600/20 bg-navy-800 text-white placeholder:text-gray-500' : 'border-gray-200 bg-slate-50 text-slate-700 placeholder:text-slate-400'}`}
                    placeholder="Why this marker matters, what drivers should know, or what the operator is monitoring."
                  />
                </div>

                {markerError && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>
                    {markerError}
                  </div>
                )}

                <button
                  onClick={handleAddMarker}
                  disabled={savingMarker}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tblue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-tblue-600 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  <iconify-icon icon={savingMarker ? 'lucide:loader-circle' : 'lucide:plus'} width="16" class={savingMarker ? 'animate-spin' : ''} />
                  {savingMarker ? 'Saving marker...' : 'Add marker to live map'}
                </button>
              </div>
            </div>

            <div className={`rounded-[28px] border p-6 ${dark ? 'border-navy-600/20 bg-navy-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={`font-serif text-2xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>Marker details</h3>
                {markersLoading && (
                  <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Loading saved markers...</span>
                )}
              </div>

              {selectedMarker ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${severityMeta[selectedMarker.severity]?.badge || severityMeta.low.badge}`}>
                        <iconify-icon icon={typeIcons[selectedMarker.type] || typeIcons.flow} width="12" />
                        {severityMeta[selectedMarker.severity]?.label || selectedMarker.severity}
                      </div>
                      <h3 className={`mt-4 font-serif text-2xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{selectedMarker.label}</h3>
                      <p className={`mt-2 text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedMarker.road}</p>
                    </div>
                    <button
                      onClick={() => setSelectedMarker(null)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${dark ? 'bg-navy-800 text-gray-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
                    >
                      <iconify-icon icon="lucide:x" width="16" />
                    </button>
                  </div>

                  <div className="my-5 eastern-line w-full" />

                  <div className="space-y-3">
                    {[
                      { label: 'Coordinates', value: `${selectedMarker.lat.toFixed(4)}, ${selectedMarker.lng.toFixed(4)}` },
                      { label: 'Vehicles', value: selectedMarker.vehicles || 'Saved marker' },
                      { label: 'Average speed', value: `${selectedMarker.avgSpeed || 0} km/h` },
                      { label: 'Notes', value: selectedMarker.note },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-2xl p-4 ${dark ? 'bg-navy-800/70' : 'bg-slate-50'}`}
                      >
                        <div className={`text-[11px] uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{item.label}</div>
                        <div className={`mt-2 text-sm leading-6 ${dark ? 'text-white' : 'text-slate-700'}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedMarker.createdAt && (
                    <p className={`mt-4 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Saved at {new Date(selectedMarker.createdAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${dark ? 'bg-navy-800 text-gray-500' : 'bg-slate-100 text-slate-400'}`}>
                    <iconify-icon icon="lucide:map-pin" width="28" />
                  </div>
                  <h3 className={`mt-5 font-serif text-xl ${dark ? 'text-white' : 'text-navy-900'}`}>Select a marker</h3>
                  <p className={`mt-2 max-w-[220px] text-sm leading-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Click any built-in or saved marker to inspect the point details here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusStrip() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <section className={`border-y py-4 ${dark ? 'border-navy-600/15 bg-navy-900/60' : 'border-gray-200 bg-white/70'}`}>
      <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-6">
        {marqueeItems.map((item) => (
          <div key={item} className="flex items-center gap-3 whitespace-nowrap">
            <div className="h-2 w-2 rounded-full bg-tblue-500" />
            <span className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowSection() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const peak = Math.max(...trafficPulse);

  return (
    <section className={`py-20 lg:py-24 ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="eastern-line w-8" />
              <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
                Analytics
              </span>
            </div>
            <h2 className={`font-serif text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-navy-900'}`}>
              24-hour traffic pulse
            </h2>
          </div>
          <p className={`max-w-xl text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Supporting analytics stay below the main operator tools so the camera, AI chat, and map remain the first things on the page.
          </p>
        </div>

        <div className={`rounded-[28px] border p-6 ${dark ? 'border-navy-600/20 bg-navy-800/40' : 'border-gray-200 bg-paper-50'}`}>
          <div className="flex h-56 items-end gap-2">
            {trafficPulse.map((value, index) => {
              const isRush = (index >= 7 && index <= 9) || (index >= 16 && index <= 19);
              return (
                <div key={index} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-44 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[24px] rounded-t-md transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        height: `${(value / peak) * 100}%`,
                        opacity: 0.78,
                        background: isRush
                          ? 'linear-gradient(to top, #ef4444, #f59e0b)'
                          : 'linear-gradient(to top, #1d4ed8, #38bdf8)',
                      }}
                    />
                    <div className={`absolute -top-8 rounded-md px-2 py-1 text-[10px] opacity-0 transition group-hover:opacity-100 ${dark ? 'bg-navy-700 text-white' : 'bg-slate-900 text-white'}`}>
                      {value} vehicles
                    </div>
                  </div>
                  <span className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{index.toString().padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PhilosophySection() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <section id="overview" className={`py-20 lg:py-24 ${dark ? 'bg-navy-950' : 'bg-paper-50'}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="eastern-line w-8" />
            <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              Philosophy
            </span>
            <div className="eastern-line w-8" />
          </div>
          <h2 className={`font-serif text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-navy-900'}`}>
            Support sections now come after the core tools
          </h2>
          <p className={`mx-auto mt-4 max-w-2xl text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            The main workflow lives at the top of the page. These cards stay available lower down as supporting context.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {philosophyCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-[24px] border p-6 ${dark ? 'border-navy-600/20 bg-navy-800/40' : 'border-gray-200 bg-white'}`}
            >
              <h3 className={`font-serif text-xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{card.title}</h3>
              <p className={`mt-3 text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <section id="about" className={`py-20 lg:py-24 ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="eastern-line w-8" />
            <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              About
            </span>
          </div>
          <h2 className={`font-serif text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-navy-900'}`}>
            Built around faster traffic decisions
          </h2>
          <div className={`mt-6 space-y-5 text-sm leading-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>
              SEMAFORI opens with the video monitoring experience, then keeps the route-aware assistant and the live map directly below it.
              That order better matches how an operator usually works during congestion or incidents.
            </p>
            <p>
              The camera section focuses attention on the junction first. The AI chat handles route and corridor questions next. The map then
              gives you spatial context and a working way to add your own saved points.
            </p>
          </div>
        </div>

        <div className={`rounded-[28px] border p-6 ${dark ? 'border-navy-600/20 bg-navy-800/40' : 'border-gray-200 bg-paper-50'}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Camera section', value: '4 count lines' },
              { label: 'Overlay style', value: 'More compact HUD' },
              { label: 'AI route help', value: 'OSM routing + app links' },
              { label: 'Custom markers', value: 'Saved in raportet' },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl p-4 ${dark ? 'bg-navy-900/70' : 'bg-white'}`}>
                <div className={`text-[11px] uppercase tracking-[0.2em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{item.label}</div>
                <div className={`mt-2 text-lg font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const TrafficCommandCenter = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const allTrafficMarkers = useMemo(() => baseTrafficMarkers, []);

  useEffect(() => {
    document.body.style.background = dark ? '#040810' : '#faf9f5';
    document.body.style.color = dark ? '#e5e5e5' : '#1a1a1a';
  }, [dark]);

  return (
    <div className={`min-h-screen transition-colors duration-500 grain ${dark ? 'bg-navy-950 text-gray-200' : 'bg-paper-50 text-gray-800'}`}>
      <SiteHeader />
      <CameraSection />
      <SnapshotGrid />
      <AIChatSection markers={allTrafficMarkers} />
      <LiveMapSection markers={allTrafficMarkers} />
      <StatusStrip />
      <FlowSection />
      <PhilosophySection />
      <AboutSection />
      <SiteFooter />
    </div>
  );
};

export default TrafficCommandCenter;
// ── Shared traffic data, constants, and utilities used across all pages ──

export const MAP_CENTER = [42.6629, 21.1655];

// Camera locations for the traffic-load colour-coded markers on the map.
// Must match the lat/lng values in semafori-vision/cameras.py.
export const CAMERA_LOCATIONS = [
  { id: 'c001', name: 'fushe-kosova', lat: 42.643, lng: 21.089 },
  { id: 'c002', name: 'aktash', lat: 42.664, lng: 21.161 },
  { id: 'c003', name: 'pejton', lat: 42.665, lng: 21.166 },
  { id: 'c004', name: 'bregu-i-diellit', lat: 42.652, lng: 21.150 },
];

export const CAMERA_FEEDS = [
  { id: 'c001', name: 'Fushë Kosova', url: 'https://video.gjirafa.com/embed/slow-tv-fushe-kosova?autoplay=true&am=true' },
  { id: 'c002', name: 'Aktash', url: 'https://video.gjirafa.com/embed/slow-tv-ick-aktash?autoplay=true&am=true' },
  { id: 'c003', name: 'Pejton', url: 'https://video.gjirafa.com/embed/slow-tv-pejton?autoplay=true&am=true' },
  { id: 'c004', name: 'Bregu i Diellit', url: 'https://video.gjirafa.com/embed/slow-tv-bregu-i-diellit-1?autoplay=true&am=true' },
];

export const GROQ_MODEL = 'llama-3.1-8b-instant';
export const MARKER_DESCRIPTION_PREFIX = '[SEMAFORI_MAP_MARKER]';

export const baseTrafficMarkers = [
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

export const severityMeta = {
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

export const typeIcons = {
  congestion: 'lucide:alert-triangle',
  accident: 'lucide:siren',
  flow: 'lucide:wind',
  construction: 'lucide:hard-hat',
  custom: 'lucide:map-pin',
};

const loadColors = { low: '#10b981', medium: '#f59e0b', high: '#f97316', congested: '#ef4444' };

export function getLoadColor(level) {
  return loadColors[level] || loadColors.low;
}

export function getLoadLabel(level) {
  const labels = { low: 'Low', medium: 'Medium', high: 'High', congested: 'Congested' };
  return labels[level] || 'Low';
}

export function formatTravelTime(minutes) {
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

export function formatDistance(distanceKm) {
  return `${distanceKm.toFixed(1)} km`;
}

export function buildTrafficSummary(markers) {
  const severeCount = markers.filter((marker) => marker.severity === 'high').length;
  const averageSpeed = Math.round(
    markers.reduce((sum, marker) => sum + marker.avgSpeed, 0) / Math.max(markers.length, 1),
  );
  const busiest = [...markers].sort((left, right) => right.vehicles - left.vehicles)[0];
  return `Current monitored network summary: ${markers.length} tracked corridors, ${severeCount} high-severity points, average measured speed ${averageSpeed} km/h, busiest location "${busiest.label}" on ${busiest.road} with ${busiest.vehicles} vehicles and ${busiest.avgSpeed} km/h average speed.`;
}

export function detectRouteRequest(message) {
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
      return { origin: match[1].trim(), destination: match[2].trim() };
    }
  }
  return null;
}

export function isPersistedMapMarker(report) {
  const description = `${report.description || ''}`;
  return description.startsWith(MARKER_DESCRIPTION_PREFIX);
}

export function extractMarkerNotes(description) {
  if (!description) return 'Operator-created marker';
  return description.replace(MARKER_DESCRIPTION_PREFIX, '').trim() || 'Operator-created marker';
}

export function buildMarkerDescription(notes) {
  return `${MARKER_DESCRIPTION_PREFIX}\n${notes?.trim() || 'Operator-created marker'}`;
}

export function reportToMapMarker(report) {
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

export function buildLiveNetworkSummary(loads, counts) {
  const pretty = (slug) => (slug || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (!Array.isArray(loads) || loads.length === 0) {
    return 'Live camera network: no data yet — the detection pipeline may be warming up or offline. Do not invent numbers; say the data is unavailable.';
  }

  const perCam = loads
    .map((l) => `${pretty(l.camera_name)}: ${Number(l.vehicle_count) || 0} vehicles visible, load ${l.load_level || 'low'}, rolling rate ${Number(l.rolling_rate) || 0}/cycle`)
    .join(' | ');
  const total = loads.reduce((s, l) => s + (Number(l.vehicle_count) || 0), 0);
  const busiest = [...loads].sort(
    (a, b) => (Number(b.vehicle_count) || 0) - (Number(a.vehicle_count) || 0),
  )[0];

  let peakLine = '';
  if (Array.isArray(counts) && counts.length > 0) {
    const peak = counts.reduce(
      (best, row) => ((Number(row.vehicle_count) || 0) > (Number(best.vehicle_count) || 0) ? row : best),
      counts[0],
    );
    const peakTime = new Date(peak.timestamp);
    const hhmm = Number.isNaN(peakTime.getTime())
      ? ''
      : peakTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    peakLine = ` Busiest single cycle in the last 24h: ${Number(peak.vehicle_count) || 0} vehicles at ${pretty(peak.camera_name)} around ${hhmm}.`;
  }

  const lastUpdate = loads[0]?.timestamp
    ? new Date(loads[0].timestamp).toLocaleTimeString('en-GB', { hour12: false })
    : 'unknown time';

  return `LIVE camera network state (updated ${lastUpdate}): ${perCam}. Network total: ${total} vehicles currently visible across ${loads.length} cameras in Prishtina. Busiest right now: ${pretty(busiest.camera_name)} with ${Number(busiest.vehicle_count) || 0} vehicles (${busiest.load_level || 'low'} load).${peakLine} These are real counts from the YOLO + ByteTrack detection pipeline (cycles every 5 minutes) — quote them directly when answering.`;
}

export function buildRouteFallback(routeContext, liveSummary) {
  if (routeContext?.ok) {
    const alternatives = routeContext.alternatives.length
      ? ` Alternate options: ${routeContext.alternatives.join(' | ')}.`
      : '';
    return `Using ${routeContext.source}, the drive from ${routeContext.origin.query} to ${routeContext.destination.query} is about ${formatDistance(routeContext.distanceKm)} and ${formatTravelTime(routeContext.durationMin)}.${alternatives} You can open the same destination in Google Maps, Waze, or Apple Maps with the shortcut buttons below.`;
  }
  if (routeContext?.error) {
    return `${routeContext.error} Try asking again in the format "from Prishtine to Ferizaj" so I can build the route preview and map links.`;
  }
  const summaryText = typeof liveSummary === 'string' && liveSummary
    ? liveSummary
    : 'Live camera data is unavailable right now.';
  return `${summaryText} If you give me a route in the format "from A to B", I can also estimate the drive and prepare map links.`;
}
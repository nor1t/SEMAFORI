import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { createIncidentReport, fetchIncidentReports } from '../services/reportService';
import { supabase } from '../services/supabaseClient';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  baseTrafficMarkers,
  buildMarkerDescription,
  CAMERA_LOCATIONS,
  severityMeta,
  typeIcons,
  MAP_CENTER,
  isPersistedMapMarker,
  reportToMapMarker,
  getLoadColor,
} from '../shared/trafficData';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

function rng(min, max) { return min + Math.random() * (max - min); }

/* ── Marker icon factories ── */
function createSeverityIcon(severity, emergency) {
  const colors = { severe: '#ef4444', high: '#f97316', moderate: '#facc15', low: '#4ade80', custom: '#06b6d4' };
  const color = colors[severity] || '#a1a1aa';
  return L.divIcon({
    html: `<div class="custom-marker" style="position:relative;cursor:pointer">
      <div style="position:absolute;inset:-6px;border-radius:9999px;opacity:0.4;background:${color};animation:pulseRing 2s cubic-bezier(0.215,0.61,0.355,1) infinite"></div>
      <div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.9);position:relative;z-index:2;${emergency ? 'box-shadow:0 0 12px ' + color : ''}"></div>
    </div>`,
    className: severity === 'severe' || emergency ? 'marker-active' : '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createCameraIcon(color) {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 8px ${color}"></div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/* ── MapClickHandler ── */
function MapClickHandler({ onPick, enabled }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick(event.latlng);
    },
  });
  return null;
}

/* ── MapController: fly to marker ── */
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 15, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

/* ── CoordsDisplay ── */
function CoordsDisplay() {
  const [coords, setCoords] = useState('0° N, 0° E');
  useMapEvents({
    mousemove(e) {
      const lat = e.latlng.lat.toFixed(4);
      const lng = Math.abs(e.latlng.lng).toFixed(4);
      const dir = e.latlng.lng < 0 ? 'W' : 'E';
      setCoords(`${lat}° N, ${lng}° ${dir}`);
    },
  });
  return (
    <div className="absolute bottom-5 right-[380px] z-[500] glass-panel rounded-lg px-3 py-1.5">
      <span className="text-[10px] font-mono text-zinc-500">{coords}</span>
    </div>
  );
}

/* ── Sparkline ── */
function Sparkline({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-16">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: Math.max(4, (v / max * 100)) + '%', background: 'rgba(249,115,22,0.35)', transition: 'height 0.5s ease' }} />
      ))}
    </div>
  );
}

const LiveMapPage = () => {
  const { user } = useAuth();
  const savedMarkersRef = useRef([]);
  const [savedMarkers, setSavedMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [markerError, setMarkerError] = useState('');
  const [savingMarker, setSavingMarker] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [trafficLoads, setTrafficLoads] = useState([]);
  const [navClock, setNavClock] = useState('');

  // Form state
  const [activeTab, setActiveTab] = useState('report');
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState(null);
  const [pickLat, setPickLat] = useState(null);
  const [pickLng, setPickLng] = useState(null);
  const [pickLoc, setPickLoc] = useState('');
  const [desc, setDesc] = useState('');
  const [lanes, setLanes] = useState('2');
  const [duration, setDuration] = useState('30-60min');
  const [emergency, setEmergency] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);

  // Stats
  const [footSevere, setFootSevere] = useState(2);
  const [footActive, setFootActive] = useState(7);
  const [footResolved, setFootResolved] = useState(23);

  const combinedMarkers = useMemo(() => [...baseTrafficMarkers, ...savedMarkers], [savedMarkers]);

  /* ── Clock ── */
  useEffect(() => {
    const id = setInterval(() => setNavClock(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Traffic loads ── */
  useEffect(() => {
    const fetchTL = async () => {
      try {
        const r = await supabase.from('traffic_load').select('*').order('camera_id');
        if (!r.error) setTrafficLoads(r.data || []);
      } catch {}
    };
    fetchTL();
    const id = setInterval(fetchTL, 30000);
    return () => clearInterval(id);
  }, []);

  /* ── Load persisted markers ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) { setSavedMarkers([]); setMarkersLoading(false); return; }
      setMarkersLoading(true);
      setMarkerError('');
      try {
        const reports = await fetchIncidentReports(user.id);
        if (cancelled) return;
        const persisted = reports
          .filter(r => isPersistedMapMarker(r) && Number.isFinite(Number(r.location?.lat)) && Number.isFinite(Number(r.location?.lng)))
          .map(reportToMapMarker);
        setSavedMarkers(persisted);
        savedMarkersRef.current = persisted;
      } catch (err) {
        if (!cancelled) { console.error(err); setMarkerError(err?.message || 'Failed to load markers.'); }
      } finally { if (!cancelled) setMarkersLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Submit report ── */
  const handleSubmit = async () => {
    if (!incidentType) { setMarkerError('Select an incident type'); return; }
    if (!severity) { setMarkerError('Select severity level'); return; }
    if (!pickLat || !pickLng) { setMarkerError('Click the map to set location'); return; }
    if (!desc.trim()) { setMarkerError('Add a description'); return; }
    if (!user?.id) { setMarkerError('Sign in to save markers'); return; }

    setSavingMarker(true);
    setMarkerError('');

    try {
      const report = await createIncidentReport(user.id, {
        title: incidentType.charAt(0).toUpperCase() + incidentType.slice(1),
        description: buildMarkerDescription(desc),
        type: incidentType === 'accident' ? 'accident' : incidentType === 'construction' ? 'construction' : 'congestion',
        severity: severity === 'severe' ? 'critical' : severity === 'high' ? 'major' : severity === 'moderate' ? 'minor' : 'minor',
        status: 'active',
        location: { lat: pickLat, lng: pickLng },
      });

      const saved = reportToMapMarker(report);
      setSavedMarkers(prev => [saved, ...prev]);
      setSelectedMarker(saved);
      setFootActive(prev => prev + 1);

      // Reset form
      setIncidentType(''); setSeverity(null); setPickLat(null); setPickLng(null);
      setPickLoc(''); setDesc(''); setLanes('2'); setDuration('30-60min'); setEmergency(false);
      setMapPickMode(false);
    } catch (err) {
      console.error(err);
      setMarkerError(err?.message || 'Failed to save marker');
    } finally {
      setSavingMarker(false);
    }
  };

  const handleMapPick = (latlng) => {
    setPickLat(latlng.lat);
    setPickLng(latlng.lng);
    setPickLoc(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    setMapPickMode(false);
    document.querySelector('.leaflet-container')?.style.setProperty('cursor', '');
  };

  const enableMapPick = () => {
    setMapPickMode(true);
    document.querySelector('.leaflet-container')?.style.setProperty('cursor', 'crosshair');
  };

  const ci = selectedMarker ? (selectedMarker.avgSpeed ? Math.round(80 - selectedMarker.avgSpeed * 1.5) : 50) : 0;

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        .glass-panel { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); }
        .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .glass-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
        .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
        .progress-track { background: rgba(255,255,255,0.06); border-radius: 9999px; overflow: hidden; height: 4px; }
        .progress-fill { height: 100%; border-radius: 9999px; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
        .bg-glow { position: fixed; border-radius: 9999px; filter: blur(120px); opacity: 0.04; pointer-events: none; z-index: -10; }
        .leaflet-tile-pane { filter: saturate(0.3) brightness(0.35) contrast(1.2); }
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a { background: rgba(24,24,27,0.9) !important; color: #a1a1aa !important; border: 1px solid rgba(255,255,255,0.08) !important; backdrop-filter: blur(10px); width: 32px !important; height: 32px !important; line-height: 32px !important; font-size: 14px !important; }
        .leaflet-control-zoom a:hover { background: rgba(39,39,42,0.95) !important; color: #fff !important; }
        .leaflet-control-attribution { display: none !important; }
        .form-input { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 12px; font-size: 12px; color: #fff; outline: none; width: 100%; transition: border-color 0.3s ease, box-shadow 0.3s ease; }
        .form-input:focus { border-color: rgba(249,115,22,0.3); box-shadow: 0 0 0 3px rgba(249,115,22,0.08); }
        .form-input::placeholder { color: #3f3f46; }
        .severity-btn { flex: 1; padding: 6px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: #71717a; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s ease; text-align: center; }
        .severity-btn:hover { background: rgba(255,255,255,0.05); color: #a1a1aa; }
        .severity-btn.active-low { background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.3); color: #4ade80; }
        .severity-btn.active-mod { background: rgba(250,204,21,0.1); border-color: rgba(250,204,21,0.3); color: #facc15; }
        .severity-btn.active-high { background: rgba(249,115,22,0.1); border-color: rgba(249,115,22,0.3); color: #f97316; }
        .severity-btn.active-severe { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #ef4444; }
        .right-scroll::-webkit-scrollbar { width: 4px; } .right-scroll::-webkit-scrollbar-track { background: transparent; } .right-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1{animation-delay:0.05s;opacity:0}.d2{animation-delay:0.1s;opacity:0}.d3{animation-delay:0.15s;opacity:0}.d4{animation-delay:0.2s;opacity:0}.d5{animation-delay:0.25s;opacity:0}
        .incident-item { transition: all 0.3s ease; cursor: pointer; }
        .incident-item:hover { background: rgba(255,255,255,0.03); }
      `}</style>

      <div className="bg-glow" style={{ top: '-100px', left: '200px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-150px', right: '-50px', width: '400px', height: '400px', background: '#ef4444' }} />

      <SiteHeader />

      <main className="pt-14 h-screen flex">
        {/* ══════════ Map Area ══════════ */}
        <div className="flex-1 relative anim d1">
          <MapContainer center={MAP_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapClickHandler onPick={handleMapPick} enabled={mapPickMode} />
            <MapController center={selectedMarker ? [selectedMarker.lat, selectedMarker.lng] : null} zoom={selectedMarker ? 15 : null} />
            <CoordsDisplay />

            {/* Built-in markers */}
            {combinedMarkers.map(m => (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={createSeverityIcon(m.severity, false)}
                eventHandlers={{ click: () => setSelectedMarker(m) }}
              >
                <Popup><div className="text-sm p-1 min-w-[160px]"><div className="font-semibold text-zinc-200">{m.label}</div><div className="text-xs text-zinc-500 mt-1">{m.road}</div><div className="mt-2 text-xs text-zinc-400">Vehicles: {m.vehicles} | Speed: {m.avgSpeed} km/h</div></div></Popup>
              </Marker>
            ))}

            {/* Camera markers */}
            {trafficLoads.map(tl => {
              const meta = CAMERA_LOCATIONS.find(c => c.id === tl.camera_id);
              if (!meta || !Number.isFinite(meta.lat)) return null;
              const color = getLoadColor(tl.load_level || 'low');
              return (
                <Marker key={`cam-${tl.camera_id}`} position={[meta.lat, meta.lng]} icon={createCameraIcon(color)}>
                  <Popup><div className="text-sm p-1"><div className="font-semibold text-zinc-200">{meta.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div><div className="text-xs text-zinc-500 mt-1">Load: {tl.load_level || 'low'} · {tl.vehicle_count || 0} veh</div></div></Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-5 left-5 z-[500] glass-panel rounded-xl p-3.5" style={{ minWidth: 160 }}>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-2.5">Severity Legend</div>
            {[
              { label: 'Severe', color: '#ef4444' },
              { label: 'High', color: '#f97316' },
              { label: 'Moderate', color: '#facc15' },
              { label: 'Low', color: '#4ade80' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5 mb-2">
                <div className="w-3 h-3 rounded-full border border-white/40" style={{ background: s.color }} />
                <span className="text-[11px] text-zinc-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ Right Panel ══════════ */}
        <div className="w-[360px] xl:w-[380px] border-l border-zinc-800/50 flex flex-col h-full bg-[#09090b]">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <iconify-icon icon="lucide:alert-circle" width="16" className="text-orange-400" />
              <span className="text-sm font-semibold tracking-tight">Command Panel</span>
            </div>
            <div className="flex items-center gap-1">
              {['Report', 'Incidents', 'Stats'].map(t => (
                <button key={t} onClick={() => setActiveTab(t.toLowerCase())} className={`px-3 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${activeTab === t.toLowerCase() ? 'bg-white/5 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto right-scroll">
            {/* ═══ Report Tab ═══ */}
            {activeTab === 'report' && (
              <div className="p-4 space-y-4 anim d2">
                <div>
                  <label className="stat-label block mb-1.5">Incident Type</label>
                  <select className="form-input" value={incidentType} onChange={e => setIncidentType(e.target.value)}>
                    <option value="">Select type...</option>
                    <option value="accident">Traffic Accident</option>
                    <option value="construction">Construction Zone</option>
                    <option value="hazard">Road Hazard</option>
                    <option value="signal">Signal Malfunction</option>
                    <option value="congestion">Congestion Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="stat-label block mb-1.5">Severity</label>
                  <div className="flex gap-2">
                    {['low', 'moderate', 'high', 'severe'].map(s => (
                      <button key={s} onClick={() => setSeverity(s)} className={`severity-btn ${severity === s ? 'active-' + (s === 'moderate' ? 'mod' : s) : ''}`}>
                        {s === 'moderate' ? 'Mod' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="stat-label block mb-1.5">Location</label>
                  <input type="text" className="form-input" value={pickLoc} readOnly placeholder="Click map or tap crosshair..." />
                  <button onClick={enableMapPick} className="mt-1 text-[10px] text-zinc-500 hover:text-orange-400 flex items-center gap-1">
                    <iconify-icon icon="lucide:crosshair" width="12" /> {mapPickMode ? 'Click anywhere on the map...' : 'Pick from map'}
                  </button>
                </div>

                <div>
                  <label className="stat-label block mb-1.5">Description</label>
                  <textarea className="form-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the incident..." style={{ resize: 'none', lineHeight: 1.5 }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="stat-label block mb-1.5">Lanes Affected</label>
                    <select className="form-input" value={lanes} onChange={e => setLanes(e.target.value)}>
                      <option value="1">1 Lane</option>
                      <option value="2">2 Lanes</option>
                      <option value="3">3 Lanes</option>
                      <option value="all">All Lanes</option>
                    </select>
                  </div>
                  <div>
                    <label className="stat-label block mb-1.5">Est. Duration</label>
                    <select className="form-input" value={duration} onChange={e => setDuration(e.target.value)}>
                      <option value="< 30min">Less than 30min</option>
                      <option value="30-60min">30 – 60 min</option>
                      <option value="1-2hrs">1 – 2 hours</option>
                      <option value="2-4hrs">2 – 4 hours</option>
                      <option value="> 4hrs">More than 4 hours</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={emergency} onChange={e => setEmergency(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5 rounded" />
                  <label className="text-[11px] text-zinc-400 cursor-pointer">Mark as emergency</label>
                </div>

                {markerError && (
                  <div className="rounded-xl px-3 py-2 text-[11px] bg-red-500/10 border border-red-500/20 text-red-400">{markerError}</div>
                )}

                <button onClick={handleSubmit} disabled={savingMarker} className="w-full py-2.5 rounded-xl bg-white text-black text-[12px] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50" style={{ boxShadow: '0 0 20px -5px rgba(255,255,255,0.3)' }}>
                  <iconify-icon icon="lucide:send" width="14" />
                  {savingMarker ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            )}

            {/* ═══ Incidents Tab ═══ */}
            {activeTab === 'incidents' && (
              <div>
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <span className="stat-label">Active Incidents</span>
                  <span className="text-[10px] font-mono text-zinc-500">{combinedMarkers.length} total</span>
                </div>
                <div className="px-2 pb-4 space-y-1">
                  {[...baseTrafficMarkers, ...savedMarkers].map(m => {
                    const sevColor = { severe: 'red', high: 'orange', moderate: 'yellow', low: 'emerald', custom: 'cyan' }[m.severity] || 'zinc';
                    return (
                      <div key={m.id} onClick={() => { setSelectedMarker(m); setActiveTab('stats'); }} className="incident-item rounded-xl p-3 mx-1">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full bg-${sevColor}-500 mt-1.5 flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-medium text-zinc-200 truncate">{m.label}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{m.road}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[9px] text-zinc-600">{m.vehicles} veh</span>
                              <span className="text-[9px] text-zinc-600">{m.avgSpeed} km/h</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {savedMarkers.length === 0 && <p className="text-center text-zinc-600 text-[11px] py-4">No saved markers yet</p>}
                </div>
              </div>
            )}

            {/* ═══ Stats Tab ═══ */}
            {activeTab === 'stats' && (
              <div>
                {!selectedMarker ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                      <iconify-icon icon="lucide:mouse-pointer-click" width="20" className="text-zinc-600" />
                    </div>
                    <p className="text-[12px] text-zinc-500 font-light">Click a marker on the map to view location statistics</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="anim d1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-sm font-semibold tracking-tight">{selectedMarker.label}</h3>
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/30 text-zinc-400">
                          {selectedMarker.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1">
                        <iconify-icon icon="lucide:map-pin" width="12" />
                        {selectedMarker.road}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="glass-card rounded-xl p-3.5 anim d2">
                      <p className="text-[12px] text-zinc-400 font-light leading-relaxed">{selectedMarker.note}</p>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/60">
                        <div><div className="stat-label">Vehicles</div><div className="text-[12px] font-mono text-zinc-300">{selectedMarker.vehicles || 0}</div></div>
                        <div><div className="stat-label">Speed</div><div className="text-[12px] text-zinc-300">{selectedMarker.avgSpeed || 0} km/h</div></div>
                        <div><div className="stat-label">Coords</div><div className="text-[12px] text-zinc-300">{selectedMarker.lat?.toFixed(4)}, {selectedMarker.lng?.toFixed(4)}</div></div>
                      </div>
                    </div>

                    {/* Location stats */}
                    <div className="anim d3">
                      <div className="flex items-center gap-2 mb-3">
                        <iconify-icon icon="lucide:bar-chart-3" width="14" className="text-zinc-500" />
                        <span className="stat-label">Location Statistics</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: 'Daily Traffic', val: (selectedMarker.vehicles * 12).toLocaleString(), color: '' },
                          { label: 'Avg Speed', val: `${selectedMarker.avgSpeed || 0} km/h`, color: '' },
                          { label: 'Congestion', val: `${Math.max(25, Math.min(95, ci))}%`, color: ci > 80 ? 'text-red-400' : ci > 50 ? 'text-orange-400' : 'text-emerald-400' },
                          { label: 'Peak Hour', val: '5–6 PM', color: '' },
                        ].map(s => (
                          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
                            <div className={`text-lg font-semibold ${s.color}`}>{s.val}</div>
                            <div className="stat-label mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Congestion bar */}
                    <div className="glass-card rounded-xl p-4 anim d4">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Congestion Level</span>
                          <span className="text-[11px] font-mono text-zinc-300">{ci}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${ci}%`, background: ci > 80 ? '#ef4444' : ci > 50 ? '#f97316' : '#4ade80' }} />
                        </div>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="glass-card rounded-xl p-4 anim d5">
                      <div className="flex items-center gap-2 mb-3">
                        <iconify-icon icon="lucide:activity" width="14" className="text-zinc-500" />
                        <span className="stat-label">Hourly Traffic Pattern</span>
                      </div>
                      <Sparkline data={Array.from({ length: 16 }, () => (selectedMarker.vehicles || 100) * (0.3 + Math.random() * 1.0) * (ci / 50))} />
                      <div className="flex justify-between mt-1.5 text-[8px] text-zinc-600 font-mono">
                        <span>6AM</span><span>9AM</span><span>12PM</span><span>3PM</span><span>6PM</span><span>9PM</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Footer */}
          <div className="flex-shrink-0 border-t border-zinc-800/50 px-4 py-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-400">{footSevere}</div>
                <div className="text-[8px] font-medium uppercase tracking-wide text-zinc-500">Severe</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-400">{footActive}</div>
                <div className="text-[8px] font-medium uppercase tracking-wide text-zinc-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-emerald-400">{footResolved}</div>
                <div className="text-[8px] font-medium uppercase tracking-wide text-zinc-500">Resolved</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default LiveMapPage;
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import useTrafficData from '../hooks/useTrafficData';
import { createIncidentReport, fetchIncidentReports } from '../services/reportService';
import { APIProvider, Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import {
  buildMarkerDescription,
  CAMERA_LOCATIONS,
  MAP_CENTER,
  isPersistedMapMarker,
  reportToMapMarker,
  getLoadColor,
  getLoadLabel,
} from '../shared/trafficData';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/* ── Dark style for the Google base map (matches the #09090b theme) ── */
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

/* ── Colored circle marker icon (load level / severity) ── */
const circleIcon = (color, scale = 8) => ({
  path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: 'rgba(255,255,255,0.9)',
  strokeWeight: 2,
  scale,
});

/* ── MapController: pan to the selected marker ── */
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center || !map) return;
    map.panTo(center);
    if (zoom) map.moveCamera({ zoom });
  }, [center, zoom, map]);
  return null;
}

/* ── Sparkline: last N real cycle counts ── */
function Sparkline({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-16">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: Math.max(4, (v / max) * 100) + '%', background: 'rgba(249,115,22,0.35)', transition: 'height 0.5s ease' }} />
      ))}
      {data.length === 0 && <span className="text-[10px] text-zinc-600">no data yet</span>}
    </div>
  );
}

const prettyCamName = (slug) =>
  (slug || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const LiveMapPage = () => {
  const { user } = useAuth();
  const { loads, counts } = useTrafficData();
  const [reports, setReports] = useState([]);
  const [savedMarkers, setSavedMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [markerError, setMarkerError] = useState('');
  const [savingMarker, setSavingMarker] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [coords, setCoords] = useState('');

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

  /* ── Load persisted user markers + reports (real data) ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) { setSavedMarkers([]); setReports([]); setMarkersLoading(false); return; }
      setMarkersLoading(true);
      setMarkerError('');
      try {
        const rows = await fetchIncidentReports(user.id);
        if (cancelled) return;
        setReports(rows || []);
        const persisted = (rows || [])
          .filter((r) => isPersistedMapMarker(r) && Number.isFinite(Number(r.location?.lat)) && Number.isFinite(Number(r.location?.lng)))
          .map(reportToMapMarker);
        setSavedMarkers(persisted);
      } catch (err) {
        if (!cancelled) { console.error(err); setMarkerError(err?.message || 'Failed to load markers.'); }
      } finally { if (!cancelled) setMarkersLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Camera markers from live traffic_load (real) ── */
  const cameraMarkers = CAMERA_LOCATIONS.map((cam) => {
    const load = loads.find((l) => l.camera_id === cam.id) || {};
    return {
      id: `cam-${cam.id}`,
      cameraId: cam.id,
      isCamera: true,
      lat: cam.lat,
      lng: cam.lng,
      label: prettyCamName(cam.name),
      load_level: load.load_level || 'low',
      vehicle_count: Number(load.vehicle_count) || 0,
      rolling_rate: Number(load.rolling_rate) || 0,
      updated: load.timestamp || null,
    };
  });

  /* ── Footer counters — real, from the user's reports ── */
  const severeCount = reports.filter((r) => r.severity === 'major').length;
  const activeCount = reports.filter((r) => r.status === 'active').length;
  const resolvedCount = reports.filter((r) => r.status === 'cleared').length;

  /* ── Submit report (persists a real marker to Supabase) ── */
  const handleSubmit = async () => {
    if (!incidentType) { setMarkerError('Select an incident type'); return; }
    if (!severity) { setMarkerError('Select severity level'); return; }
    if (!pickLat || !pickLng) { setMarkerError('Click the map to set location'); return; }
    if (!desc.trim()) { setMarkerError('Add a description'); return; }
    if (!user?.id) { setMarkerError('Sign in to save markers'); return; }

    setSavingMarker(true);
    setMarkerError('');

    const detailLines = [
      desc.trim(),
      `Lanes affected: ${lanes} · Est. duration: ${duration}${emergency ? ' · EMERGENCY' : ''}`,
    ].join('\n');

    try {
      const report = await createIncidentReport(user.id, {
        title: incidentType.charAt(0).toUpperCase() + incidentType.slice(1),
        description: buildMarkerDescription(detailLines),
        type: incidentType === 'accident' ? 'accident' : incidentType === 'construction' ? 'construction' : 'congestion',
        severity: severity === 'severe' ? 'critical' : severity === 'high' ? 'major' : 'minor',
        status: 'active',
        location: { lat: pickLat, lng: pickLng },
      });

      const saved = reportToMapMarker(report);
      setSavedMarkers((prev) => [saved, ...prev]);
      setReports((prev) => [report, ...prev]);
      setSelectedMarker(saved);

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
    if (!latlng) return;
    setPickLat(latlng.lat);
    setPickLng(latlng.lng);
    setPickLoc(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    setMapPickMode(false);
  };

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
        .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1{animation-delay:0.05s;opacity:0}.d2{animation-delay:0.1s;opacity:0}.d3{animation-delay:0.15s;opacity:0}.d4{animation-delay:0.2s;opacity:0}.d5{animation-delay:0.25s;opacity:0}
        .incident-item { transition: all 0.3s ease; cursor: pointer; }
        .incident-item:hover { background: rgba(255,255,255,0.03); }
      `}</style>

      <div className="bg-glow" style={{ top: '-100px', left: '200px', width: '500px', height: '400px', background: '#f97316' }} />
      <div className="bg-glow" style={{ bottom: '-150px', right: '-50px', width: '400px', height: '400px', background: '#ef4444' }} />

      <SiteHeader />

      <main className="pt-14 h-screen flex">

        {/* ══════════ Map Area (Google Maps) ══════════ */}
        <div className="flex-1 relative anim d1">
          {!GOOGLE_MAPS_API_KEY ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <iconify-icon icon="lucide:map-pin-off" width="28" className="text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-400 font-medium">Google Maps API key missing</p>
              <p className="mt-1 text-[11px] text-zinc-600 max-w-xs">Set VITE_GOOGLE_MAPS_API_KEY in .env.local (and in Vercel env vars for production), then restart/redeploy.</p>
            </div>
          ) : (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <Map
                defaultCenter={{ lat: MAP_CENTER[0], lng: MAP_CENTER[1] }}
                defaultZoom={13}
                mapTypeId="roadmap"
                styles={DARK_MAP_STYLES}
                disableDefaultUI
                zoomControl
                gestureHandling="greedy"
                draggableCursor={mapPickMode ? 'crosshair' : ''}
                onClick={(e) => { if (mapPickMode) handleMapPick(e.detail?.latLng); }}
                onMousemove={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) setCoords(`${ll.lat.toFixed(4)}° N, ${ll.lng.toFixed(4)}° E`);
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <MapController
                  center={selectedMarker ? { lat: selectedMarker.lat, lng: selectedMarker.lng } : null}
                  zoom={selectedMarker ? 15 : null}
                />

                {/* Camera markers — live load colors (real data) */}
                {cameraMarkers.map((m) => (
                  <Marker
                    key={m.id}
                    position={{ lat: m.lat, lng: m.lng }}
                    icon={circleIcon(getLoadColor(m.load_level), 9)}
                    onClick={() => setSelectedMarker(m)}
                  />
                ))}

                {/* User-persisted report markers (real data) */}
                {savedMarkers.map((m) => (
                  <Marker
                    key={m.id}
                    position={{ lat: m.lat, lng: m.lng }}
                    icon={circleIcon('#06b6d4', 7)}
                    onClick={() => setSelectedMarker(m)}
                  />
                ))}

                {/* Picked location preview */}
                {pickLat && pickLng && (
                  <Marker position={{ lat: pickLat, lng: pickLng }} icon={circleIcon('#f97316', 7)} />
                )}

                {selectedMarker && (
                  <InfoWindow
                    position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div style={{ color: '#18181b', fontSize: '12px', minWidth: '170px', fontFamily: 'DM Sans, sans-serif' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{selectedMarker.label}</div>
                      {selectedMarker.isCamera ? (
                        <div style={{ marginTop: '4px', color: '#52525b' }}>
                          Load: <b>{getLoadLabel(selectedMarker.load_level)}</b> · {selectedMarker.vehicle_count} vehicles now
                          <br />Rolling rate: {selectedMarker.rolling_rate}/cycle
                        </div>
                      ) : (
                        <div style={{ marginTop: '4px', color: '#52525b', whiteSpace: 'pre-line' }}>{selectedMarker.note}</div>
                      )}
                      <div style={{ marginTop: '6px', fontSize: '10px', color: '#a1a1aa' }}>Open the Stats tab for full details →</div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          )}

          {/* Coordinates readout */}
          {coords && (
            <div className="absolute bottom-5 right-[380px] z-[500] glass-panel rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-mono text-zinc-500">{coords}</span>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-5 left-5 z-[500] glass-panel rounded-xl p-3.5" style={{ minWidth: 170 }}>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-2.5">Camera Load</div>
            {[
              { label: 'Low', color: getLoadColor('low') },
              { label: 'Medium', color: getLoadColor('medium') },
              { label: 'High', color: getLoadColor('high') },
              { label: 'Congested', color: getLoadColor('congested') },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 mb-2">
                <div className="w-3 h-3 rounded-full border border-white/40" style={{ background: s.color }} />
                <span className="text-[11px] text-zinc-400">{s.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 pt-1 border-t border-zinc-800/50">
              <div className="w-3 h-3 rounded-full border border-white/40" style={{ background: '#06b6d4' }} />
              <span className="text-[11px] text-zinc-400">Your reports</span>
            </div>
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
              {['Report', 'Incidents', 'Stats'].map((t) => (
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
                  <select className="form-input" value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
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
                    {['low', 'moderate', 'high', 'severe'].map((s) => (
                      <button key={s} onClick={() => setSeverity(s)} className={`severity-btn ${severity === s ? 'active-' + (s === 'moderate' ? 'mod' : s) : ''}`}>
                        {s === 'moderate' ? 'Mod' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="stat-label block mb-1.5">Location</label>
                  <input type="text" className="form-input" value={pickLoc} readOnly placeholder="Click map or tap crosshair..." />
                  <button onClick={() => setMapPickMode(true)} className="mt-1 text-[10px] text-zinc-500 hover:text-orange-400 flex items-center gap-1">
                    <iconify-icon icon="lucide:crosshair" width="12" /> {mapPickMode ? 'Click anywhere on the map...' : 'Pick from map'}
                  </button>
                </div>

                <div>
                  <label className="stat-label block mb-1.5">Description</label>
                  <textarea className="form-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe the incident..." style={{ resize: 'none', lineHeight: 1.5 }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="stat-label block mb-1.5">Lanes Affected</label>
                    <select className="form-input" value={lanes} onChange={(e) => setLanes(e.target.value)}>
                      <option value="1">1 Lane</option>
                      <option value="2">2 Lanes</option>
                      <option value="3">3 Lanes</option>
                      <option value="all">All Lanes</option>
                    </select>
                  </div>
                  <div>
                    <label className="stat-label block mb-1.5">Est. Duration</label>
                    <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="< 30min">Less than 30min</option>
                      <option value="30-60min">30 – 60 min</option>
                      <option value="1-2hrs">1 – 2 hours</option>
                      <option value="2-4hrs">2 – 4 hours</option>
                      <option value="> 4hrs">More than 4 hours</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5 rounded" />
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
                  <span className="stat-label">Cameras (live)</span>
                  <span className="text-[10px] font-mono text-zinc-500">{cameraMarkers.length}</span>
                </div>
                <div className="px-2 pb-2 space-y-1">
                  {cameraMarkers.map((m) => (
                    <div key={m.id} onClick={() => { setSelectedMarker(m); setActiveTab('stats'); }} className="incident-item rounded-xl p-3 mx-1">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: getLoadColor(m.load_level) }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-zinc-200 truncate">{m.label}</span>
                            <span className="text-[9px] font-mono text-zinc-500 uppercase">{m.load_level}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{m.vehicle_count} vehicles · {m.rolling_rate}/cycle</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 pt-2 pb-2 flex items-center justify-between border-t border-zinc-800/50">
                  <span className="stat-label">Your reports</span>
                  <span className="text-[10px] font-mono text-zinc-500">{savedMarkers.length} total</span>
                </div>
                <div className="px-2 pb-4 space-y-1">
                  {savedMarkers.map((m) => (
                    <div key={m.id} onClick={() => { setSelectedMarker(m); setActiveTab('stats'); }} className="incident-item rounded-xl p-3 mx-1">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium text-zinc-200 truncate">{m.label}</span>
                          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{m.note}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {savedMarkers.length === 0 && !markersLoading && (
                    <p className="text-center text-zinc-600 text-[11px] py-4">No saved markers yet — submit a report.</p>
                  )}
                  {markersLoading && (
                    <p className="text-center text-zinc-600 text-[11px] py-4">Loading…</p>
                  )}
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
                    <p className="text-[12px] text-zinc-500 font-light">Click a camera or report marker on the map to view real statistics</p>
                  </div>
                ) : selectedMarker.isCamera ? (
                  <CameraStats marker={selectedMarker} counts={counts} />
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="anim d1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-sm font-semibold tracking-tight">{selectedMarker.label}</h3>
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          your report
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1">
                        <iconify-icon icon="lucide:map-pin" width="12" />
                        {selectedMarker.lat?.toFixed(4)}, {selectedMarker.lng?.toFixed(4)}
                      </p>
                    </div>
                    <div className="glass-card rounded-xl p-3.5 anim d2">
                      <p className="text-[12px] text-zinc-400 font-light leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{selectedMarker.note}</p>
                      {selectedMarker.createdAt && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/60 text-[10px] text-zinc-600">
                          Reported {new Date(selectedMarker.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Footer — real counters from user reports */}
          <div className="flex-shrink-0 border-t border-zinc-800/50 px-4 py-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-400">{severeCount}</div>
                <div className="text-[8px] font-medium uppercase tracking-wide text-zinc-500">Severe</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-400">{activeCount}</div>
                <div className="text-[8px] font-medium uppercase tracking-wide text-zinc-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-emerald-400">{resolvedCount}</div>
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

/* ── Camera stats panel (real 24h data from traffic_counts) ── */
function CameraStats({ marker, counts }) {
  const camCounts = counts.filter((r) => r.camera_id === marker.cameraId);
  const series = camCounts.slice(-24).map((r) => Number(r.vehicle_count) || 0);
  const avgRate = camCounts.length
    ? (camCounts.reduce((s, r) => s + (Number(r.vehicle_count) || 0), 0) / camCounts.length).toFixed(1)
    : '—';
  const peakRow = camCounts.reduce(
    (best, r) => ((Number(r.vehicle_count) || 0) > (Number(best?.vehicle_count) || -1) ? r : best),
    null,
  );
  const peakLabel = peakRow
    ? `${peakRow.vehicle_count} at ${new Date(peakRow.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '—';
  const updatedLabel = marker.updated
    ? new Date(marker.updated).toLocaleTimeString('en-GB', { hour12: false })
    : '—';

  return (
    <div className="p-4 space-y-4">
      <div className="anim d1">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold tracking-tight">{marker.label}</h3>
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border"
            style={{
              color: getLoadColor(marker.load_level),
              background: getLoadColor(marker.load_level) + '1a',
              borderColor: getLoadColor(marker.load_level) + '33',
            }}
          >
            {getLoadLabel(marker.load_level)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1">
          <iconify-icon icon="lucide:video" width="12" />
          Live camera · updated {updatedLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 anim d2">
        {[
          { label: 'Vehicles now', val: marker.vehicle_count },
          { label: 'Rolling rate', val: `${marker.rolling_rate}/cyc` },
          { label: 'Avg / cycle (24h)', val: avgRate },
          { label: 'Peak (24h)', val: peakLabel },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <div className="text-base font-semibold">{s.val}</div>
            <div className="stat-label mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-4 anim d3">
        <div className="flex items-center gap-2 mb-3">
          <iconify-icon icon="lucide:activity" width="14" className="text-zinc-500" />
          <span className="stat-label">Last cycles (real counts)</span>
        </div>
        <Sparkline data={series} />
        <div className="flex justify-between mt-1.5 text-[8px] text-zinc-600 font-mono">
          <span>older</span><span>latest</span>
        </div>
      </div>
    </div>
  );
}

export default LiveMapPage;

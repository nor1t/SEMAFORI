import React, { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_CENTER = [42.6026, 20.903];
const DEFAULT_ZOOM = 9;

const TrafficMap = ({ reports, selectedLocation, onLocationSelect }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const locationMarkerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const { t } = useLanguage();
  const { theme } = useTheme();

  const createTileLayer = useCallback(() => (
    theme === 'dark'
      ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 19,
        })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
  ), [theme]);

  const getReportCoordinates = useCallback((report) => {
    if (report.location?.lat && report.location?.lng) {
      return [report.location.lat, report.location.lng];
    }

    const offsetLat = (Math.random() - 0.5) * 0.05;
    const offsetLng = (Math.random() - 0.5) * 0.05;
    return [DEFAULT_CENTER[0] + offsetLat, DEFAULT_CENTER[1] + offsetLng];
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainer.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      tileLayerRef.current = createTileLayer();
      tileLayerRef.current.addTo(mapRef.current);

      if (onLocationSelect) {
        mapRef.current.on('click', (event) => {
          onLocationSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }
      return;
    }

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = createTileLayer();
    tileLayerRef.current.addTo(mapRef.current);
  }, [createTileLayer, onLocationSelect]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => mapRef.current.removeLayer(marker));
    markersRef.current = [];

    reports.forEach((report) => {
      const [lat, lng] = getReportCoordinates(report);
      const fillColor = report.status === 'cleared'
        ? '#10b981'
        : report.status === 'under_control'
          ? '#f59e0b'
          : '#06b6d4';

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.bindPopup(
        `<div style="font-family: sans-serif; font-size: 13px;">
          <strong>${report.title || 'Report'}</strong><br/>
          <span style="font-size: 11px; color: #4b5563;">${t(report.type) || ''}</span><br/>
          <span style="font-size: 11px; color: #4b5563;">${report.description || ''}</span>
        </div>`
      );

      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, [getReportCoordinates, reports, t]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (locationMarkerRef.current) {
      mapRef.current.removeLayer(locationMarkerRef.current);
      locationMarkerRef.current = null;
    }

    if (selectedLocation?.lat && selectedLocation?.lng) {
      locationMarkerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: L.divIcon({
          className: 'selected-location-marker',
          html: '<div class="h-6 w-6 rounded-full border-2 border-white bg-cyan-500 shadow-lg"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(mapRef.current);

      mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 13, { animate: true });
    }
  }, [selectedLocation]);

  return (
    <div className={`relative h-72 w-full overflow-hidden rounded-3xl border shadow-lg ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'}`}>
      <div
        ref={mapContainer}
        className={`h-full w-full ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'}`}
        style={{ zIndex: 1 }}
      />

      {reports.length === 0 && !selectedLocation && (
        <div className={`absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm ${theme === 'light' ? 'bg-white/60' : 'bg-black/40'}`}>
          <div className="text-center">
            <p className={`font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{t('noIncidentsOnMap')}</p>
            <p className={`mt-1 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('createReportToSeeIt')}</p>
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className={`absolute left-4 top-4 rounded-2xl px-3 py-2 text-sm shadow-lg ${theme === 'light' ? 'bg-white/90 text-slate-900' : 'bg-slate-950/80 text-slate-100'}`}>
          {t('locationSelected')}: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
        </div>
      )}

      {onLocationSelect && (
        <div className="absolute right-4 top-4 rounded-2xl bg-cyan-500/90 px-3 py-2 text-sm text-slate-950 shadow-lg">
          {t('mapClickHint')}
        </div>
      )}
    </div>
  );
};

export default TrafficMap;

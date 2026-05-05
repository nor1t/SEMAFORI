import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';

// Fix for default Leaflet markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const TrafficMap = ({ reports }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const { theme } = useTheme();

  // Default center (Kosovo)
  const defaultCenter = [42.6026, 20.9030];
  const defaultZoom = 9;

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView(defaultCenter, defaultZoom);

      // Use different tile layer based on theme
      const tileLayer = theme === 'dark'
        ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
          })
        : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          });

      tileLayer.addTo(map.current);
    } else {
      // Change tile layer based on theme
      map.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.current.removeLayer(layer);
        }
      });

      const tileLayer = theme === 'dark'
        ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
          })
        : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          });

      tileLayer.addTo(map.current);
    }
  }, [theme]);

  // Update markers based on reports
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => map.current.removeLayer(marker));
    markersRef.current = [];

    // Add markers for reports (with random offsets for demo)
    reports.forEach((report, index) => {
      const offsetLat = (Math.random() - 0.5) * 0.05;
      const offsetLng = (Math.random() - 0.5) * 0.05;
      const lat = defaultCenter[0] + offsetLat;
      const lng = defaultCenter[1] + offsetLng;

      // Color based on status
      const getColor = (status) => {
        switch (status) {
          case 'active':
            return '#ec4899'; // pink
          case 'under_control':
            return '#f59e0b'; // amber
          case 'cleared':
            return '#10b981'; // emerald
          default:
            return '#06b6d4'; // cyan
        }
      };

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: getColor(report['Statusi']),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(
        `<div class="font-semibold text-sm">
          <p class="font-bold">${report['Titulli i incidentit']}</p>
          <p class="text-xs text-gray-600">${report['Kategoria']}</p>
          <p class="text-xs mt-1">${report['Përshkrimi']}</p>
        </div>`
      );

      marker.addTo(map.current);
      markersRef.current.push(marker);
    });
  }, [reports]);

  return (
    <div className="relative w-full h-72 rounded-3xl overflow-hidden border border-slate-700/70 shadow-lg">
      <div
        ref={mapContainer}
        className="w-full h-full bg-slate-900"
        style={{ zIndex: 1 }}
      />
      {reports.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl backdrop-blur-sm">
          <div className="text-center">
            <p className="text-slate-300 font-medium">No incidents to display on map</p>
            <p className="text-slate-400 text-sm mt-1">Create a report to see it here</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficMap;

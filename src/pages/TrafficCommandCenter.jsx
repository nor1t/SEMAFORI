import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { groq } from '../services/groqService';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/* ─── Data ─── */
const trafficMarkers = [
  { id:1, lat:42.6629, lng:21.1655, type:'congestion', label:'CBD Gridlock', severity:'high', vehicles:847, avgSpeed:12, road:'Mother Teresa Blvd' },
  { id:2, lat:42.6550, lng:21.1700, type:'accident', label:'Minor Collision', severity:'medium', vehicles:120, avgSpeed:28, road:'Bill Clinton Blvd' },
  { id:3, lat:42.6700, lng:21.1800, type:'flow', label:'Smooth Flow', severity:'low', vehicles:342, avgSpeed:58, road:'Agim Ramadani St' },
  { id:4, lat:42.6450, lng:21.1550, type:'construction', label:'Road Work Zone', severity:'medium', vehicles:95, avgSpeed:22, road:'Rruga e Durrësit' },
  { id:5, lat:42.6350, lng:21.1450, type:'congestion', label:'Rush Hour Delay', severity:'high', vehicles:620, avgSpeed:15, road:'Autostrada Prishtinë-Ferizaj' },
  { id:6, lat:42.6500, lng:21.1600, type:'flow', label:'Normal Traffic', severity:'low', vehicles:210, avgSpeed:45, road:'Rruga 18 Shtatori' },
  { id:7, lat:42.6750, lng:21.1850, type:'accident', label:'Multi-Vehicle', severity:'high', vehicles:45, avgSpeed:0, road:'Highway M-9' },
  { id:8, lat:42.6400, lng:21.1500, type:'flow', label:'Light Traffic', severity:'low', vehicles:88, avgSpeed:62, road:'Rruga B' },
];

const liveNotifications = [
  { id:1, time:'14:32', type:'alert', msg:'Severe congestion detected on Mother Teresa Blvd — avg speed 12 km/h', icon:'lucide:alert-triangle' },
  { id:2, time:'14:28', type:'info', msg:'AI model updated: traffic prediction accuracy now 96.3%', icon:'lucide:brain' },
  { id:3, time:'14:25', type:'warning', msg:'Multi-vehicle accident on Highway M-9 — emergency response dispatched', icon:'lucide:siren' },
  { id:4, time:'14:20', type:'success', msg:'Rush hour pattern optimization reduced delays by 18%', icon:'lucide:check-circle' },
  { id:5, time:'14:15', type:'info', msg:'New sensor cluster online: District 7 coverage now 100%', icon:'lucide:wifi' },
  { id:6, time:'14:10', type:'alert', msg:'Construction zone on Rruga e Durrësit — lane closure until 18:00', icon:'lucide:hard-hat' },
  { id:7, time:'14:05', type:'success', msg:'Emergency route cleared for ambulance — ETA reduced 4 min', icon:'lucide:route' },
];

const chatMessages = [
  { role:'assistant', content:'Welcome to the Traffic Command AI. I can help you analyze traffic patterns, predict congestion, or optimize routes. What would you like to explore?' },
  { role:'user', content:'What is the current congestion status on Bill Clinton Avenue?' },
  { role:'assistant', content:'Bill Clinton Avenue is currently experiencing **severe congestion** (Level 4/5). Average speed has dropped to 12 km/h with approximately 847 vehicles in a 2km stretch. The congestion is expected to persist until 16:30. I recommend diverting traffic via Eastern Ring Road for an estimated 23-minute time saving.' },
  { role:'user', content:'Show me the predicted flow for the next 2 hours.' },
  { role:'assistant', content:'Based on our Graph Neural Network model (96.3% accuracy):\n\n• **14:30–15:00**: Congestion intensifies, avg speed ↓ to 8 km/h\n• **15:00–15:30**: Peak congestion, spill-over to adjacent roads\n• **15:30–16:00**: Gradual easing as school traffic clears\n• **16:00–16:30**: Return to moderate flow (~35 km/h)\n\nWould you like me to generate an alternate route plan?' },
];

const statsData = [
  { label:'Active Sensors', value:'5000', icon:'lucide:radar', change:'+128' },
  { label:'Vehicles Tracked', value:'300K', icon:'lucide:car', change:'+12%' },
  { label:'Avg. City Speed', value:'34 km/h', icon:'lucide:gauge', change:'-3%' },
  { label:'AI Predictions', value:'96.3%', icon:'lucide:brain', change:'+0.8%' },
  { label:'Incidents Today', value:'13', icon:'lucide:alert-circle', change:'-2' },
  { label:'Response Time', value:'4.2 min', icon:'lucide:clock', change:'-18%' },
];

/* ─── Components ─── */

// Grain overlay
function GrainOverlay() {
  return null; // handled by CSS
}

// Hero Section
function Hero() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <section className={`relative min-h-screen flex items-center overflow-hidden ${dark ? 'bg-navy-950' : 'bg-paper-50'} paper-texture`}>
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 -left-32 w-96 h-96 rounded-full blur-3xl ${dark ? 'bg-tblue-500/5' : 'bg-tblue-300/10'}`}></div>
        <div className={`absolute bottom-20 right-0 w-80 h-80 rounded-full blur-3xl ${dark ? 'bg-tblue-600/5' : 'bg-tblue-400/8'}`}></div>
        {/* Eastern decorative lines */}
        <svg className="absolute top-32 right-16 w-40 h-40 opacity-[0.04]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" className={dark ? 'text-tblue-300' : 'text-tblue-600'}/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className={dark ? 'text-tblue-300' : 'text-tblue-600'}/>
          <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" className={dark ? 'text-tblue-300' : 'text-tblue-600'}/>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        {/* Text */}
        <div className="animate-slide-up">
          <div className="flex items-center gap-3 mb-8">
            <div className="eastern-line w-12"></div>
            <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              Est. 2026 · Next-Gen Traffic Intelligence
            </span>
          </div>
          <h1 className={`font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6 ${dark ? 'text-white' : 'text-navy-900'}`}>
            <span className={dark ? 'text-white' : 'text-navy-900'}>Smart Traffic</span>
            <br />
            <span className={`serif-italic ${dark ? 'text-tblue-300' : 'text-tblue-600'}`}>
              Management System
            </span>
          </h1>
          <p className={`text-base lg:text-lg leading-relaxed mb-10 max-w-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}
            style={{ lineHeight:'1.85' }}>
            Harmonizing the rhythm of urban movement through artificial intelligence.
            From ancient road wisdom to neural network precision — we transform chaos
            into orchestrated flow, creating serene cities where every journey is anticipated.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#map"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-tblue-500 hover:bg-tblue-600 text-white text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-tblue-500/25 hover:-translate-y-0.5">
              <iconify-icon icon="lucide:map" width="16"></iconify-icon>
              Open Live Map
              <iconify-icon icon="lucide:arrow-right" width="14" class="transition-transform group-hover:translate-x-1"></iconify-icon>
            </a>
            <a href="#ai"
              className={`inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-medium rounded-xl transition-all duration-300 hover:-translate-y-0.5 ${dark
                ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
                : 'bg-navy-800/5 hover:bg-navy-800/10 text-navy-800 border border-navy-800/10 hover:border-navy-800/20'}`}>
              <iconify-icon icon="lucide:message-circle" width="16"></iconify-icon>
              Ask AI Assistant
            </a>
          </div>

          {/* Mini stats */}
          <div className="mt-14 flex gap-10">
            {[
              { val:'5,000', label:'Sensors' },
              { val:'96.3%', label:'AI Accuracy' },
              { val:'4.2min', label:'Response' },
            ].map((s,i) => (
              <div key={i}>
                <div className={`font-serif text-2xl font-bold ${dark ? 'text-white' : 'text-navy-800'}`}>{s.val}</div>
                <div className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Video */}
        <div className="relative animate-fade-in" style={{animationDelay:'0.3s', animationFillMode:'both'}}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
            <iframe
              src="https://video.gjirafa.com/embed/slow-tv-ick-aktash?autoplay=true&am=true"
              title="Live Traffic Camera - ICK/Aktash"
              className="w-full h-[400px] lg:h-[520px] border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              loading="lazy"
            ></iframe>
            <div className={`absolute inset-0 ${dark ? 'bg-gradient-to-t from-navy-950/80 via-navy-950/20 to-transparent' : 'bg-gradient-to-t from-navy-900/40 via-transparent to-transparent'}`}></div>
            {/* Floating badge */}
            <div className={`absolute bottom-6 left-6 right-6 p-4 rounded-xl backdrop-blur-xl animate-slide-up ${dark ? 'bg-navy-900/60 border border-white/10' : 'bg-white/70 border border-white/20'}`}
              style={{animationDelay:'0.6s', animationFillMode:'both'}}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow"></div>
                    <span className={`text-xs font-medium ${dark ? 'text-gray-300' : 'text-gray-600'}`}>Live Monitoring</span>
                  </div>
                  <div className={`font-serif text-lg font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>City Center — All Systems Operational</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 text-sm font-semibold">Normal</div>
                  <div className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>34 km/h avg</div>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative corner */}
          <div className={`absolute -top-3 -right-3 w-16 h-16 border-t-2 border-r-2 rounded-tr-2xl ${dark ? 'border-tblue-500/20' : 'border-tblue-400/30'}`}></div>
          <div className={`absolute -bottom-3 -left-3 w-16 h-16 border-b-2 border-l-2 rounded-bl-2xl ${dark ? 'border-tblue-500/20' : 'border-tblue-400/30'}`}></div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float">
        <span className={`text-[10px] tracking-[0.2em] uppercase ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Scroll</span>
        <iconify-icon icon="lucide:chevron-down" width="16" class={dark ? 'text-gray-600' : 'text-gray-400'}></iconify-icon>
      </div>
    </section>
  );
}

// Stats Bar
function StatsBar() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <section className={`relative py-6 border-y overflow-hidden ${dark ? 'bg-navy-900/50 border-navy-600/20' : 'bg-white/80 border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-6 overflow-x-auto pb-2 no-scrollbar">
          {statsData.map((s,i) => (
            <div key={i} className="flex items-center gap-3 min-w-[180px]">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${dark ? 'bg-tblue-500/10' : 'bg-tblue-50'}`}>
                <iconify-icon icon={s.icon} width="16" class="text-tblue-500"></iconify-icon>
              </div>
              <div>
                <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>{s.value}</div>
                <div className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</div>
              </div>
              <span className={`text-[11px] font-medium ml-auto ${s.change.startsWith('+') && !s.label.includes('Speed') && !s.label.includes('Incidents') && !s.label.includes('Response')
                ? 'text-green-400' : s.change.startsWith('-') && (s.label.includes('Incidents') || s.label.includes('Response'))
                ? 'text-green-400' : 'text-amber-400'}`}>
                {s.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Live Notification Marquee
function NotificationMarquee() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const doubled = [...liveNotifications, ...liveNotifications];
  return (
    <section className={`py-3 border-b overflow-hidden ${dark ? 'bg-navy-800/50 border-navy-600/15' : 'bg-tblue-50/50 border-tblue-100'}`}>
      <div className="flex animate-marquee" style={{width:'max-content'}}>
        {doubled.map((n,i) => (
          <div key={i} className="flex items-center gap-2 px-6 whitespace-nowrap">
            <iconify-icon icon={n.icon} width="13"
              class={n.type==='alert'?'text-red-400':n.type==='warning'?'text-amber-400':n.type==='success'?'text-green-400':'text-tblue-400'}></iconify-icon>
            <span className={`text-[11px] font-mono ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{n.time}</span>
            <span className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{n.msg}</span>
            <span className={dark ? 'text-navy-600' : 'text-gray-300'}>·</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Overview Section
function Overview() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const features = [
    { icon:'lucide:eye', title:'Real-time Surveillance', desc:'5000 sensors providing continuous urban traffic awareness across 47 districts', img:'traffic-overview-1' },
    { icon:'lucide:brain', title:'AI-Powered Prediction', desc:'Graph neural networks forecasting congestion 30 minutes ahead with 96.3% accuracy', img:'ai-neural-2' },
    { icon:'lucide:shield-check', title:'Incident Response', desc:'Automated detection and emergency dispatch reducing response time to 4.2 minutes', img:'emergency-response-3' },
    { icon:'lucide:leaf', title:'Green Flow Optimization', desc:'Reducing emissions by 22% through intelligent signal timing and route guidance', img:'green-traffic-4' },
  ];

  return (
    <section id="overview" className={`py-24 lg:py-32 ${dark ? 'bg-navy-950' : 'bg-paper-50'} paper-texture`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="eastern-line w-8"></div>
            <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>Philosophy</span>
            <div className="eastern-line w-8"></div>
          </div>
          <h2 className={`font-serif text-3xl lg:text-4xl font-bold mb-6 ${dark ? 'text-white' : 'text-navy-900'}`}>
            Where Tradition Meets <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>Intelligence</span>
          </h2>
          <p className={`max-w-2xl mx-auto leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`} style={{lineHeight:'1.85'}}>
            Inspired by centuries of urban planning wisdom — from the grid of Prishtina to the tunnels of Ferizaj —
            we believe traffic flow is not a problem to solve but a rhythm to harmonize.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((f,i) => (
            <div key={i} className={`group rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${dark
              ? 'bg-navy-800/40 border border-navy-600/20 hover:border-tblue-500/20 hover:shadow-tblue-500/5'
              : 'bg-white border border-gray-200 hover:border-tblue-300 hover:shadow-tblue-500/10'}`}>
              <div className="relative h-48 overflow-hidden">
                <img src={`https://picsum.photos/seed/traffic-flow-${i+1}/800/400.jpg`} alt={f.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className={`absolute inset-0 ${dark ? 'bg-gradient-to-t from-navy-800 via-navy-800/40 to-transparent' : 'bg-gradient-to-t from-white via-white/40 to-transparent'}`}></div>
              </div>
              <div className="p-8">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${dark
                  ? 'bg-tblue-500/10 group-hover:bg-tblue-500/20'
                  : 'bg-tblue-50 group-hover:bg-tblue-100'}`}>
                  <iconify-icon icon={f.icon} width="20" class="text-tblue-500"></iconify-icon>
                </div>
                <h3 className={`font-serif text-xl font-semibold mb-3 ${dark ? 'text-white' : 'text-navy-800'}`}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`} style={{lineHeight:'1.8'}}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Interactive Map Section
function TrafficMap() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [selected, setSelected] = useState(null);

  const severityColors = {
    high: { bg:'bg-red-500', ring:'ring-red-500/30', text:'text-red-400', label:'High', leafletColor: 'red' },
    medium: { bg:'bg-amber-500', ring:'ring-amber-500/30', text:'text-amber-400', label:'Medium', leafletColor: 'orange' },
    low: { bg:'bg-green-500', ring:'ring-green-500/30', text:'text-green-400', label:'Low', leafletColor: 'green' },
  };

  const typeIcons = {
    congestion: 'lucide:alert-triangle',
    accident: 'lucide:siren',
    flow: 'lucide:wind',
    construction: 'lucide:hard-hat',
  };

  // Create custom icons for markers
  const createCustomIcon = (severity) => {
    const color = severityColors[severity].leafletColor;
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px rgba(255,255,255,0.3);"></div>`,
      className: 'custom-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  };

  return (
    <section id="map" className={`py-24 lg:py-32 ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="eastern-line w-8"></div>
            <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>Live Map</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className={`font-serif text-3xl lg:text-4xl font-bold ${dark ? 'text-white' : 'text-navy-900'}`}>
                Kosova Traffic <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>Overview</span>
              </h2>
              <p className={`mt-3 text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Click markers to inspect traffic conditions at each location</p>
            </div>
            <div className="flex items-center gap-4">
              {Object.entries(severityColors).map(([k,v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${v.bg}`}></div>
                  <span className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className={`lg:col-span-2 relative rounded-2xl overflow-hidden border ${dark
            ? 'border-navy-600/20'
            : 'border-gray-200'}`} style={{ height: '500px' }}>
            <MapContainer
              center={[42.6629, 21.1655]} // Pristina coordinates
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              className="rounded-2xl"
            >
              <TileLayer
  url={dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
  attribution={dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
/>
              {/* City labels */}
              <Marker position={[42.6629, 21.1655]} icon={L.divIcon({
                html: `<div style="background: transparent; border: none; font-size: 12px; font-weight: bold; color: ${dark ? '#60a5fa' : '#2563eb'}; text-shadow: 1px 1px 1px rgba(0,0,0,0.7);">Pristina</div>`,
                className: 'city-label',
                iconSize: [80, 20],
                iconAnchor: [40, 10],
              })} />
              <Marker position={[42.4604, 21.4694]} icon={L.divIcon({
                html: `<div style="background: transparent; border: none; font-size: 10px; font-weight: bold; color: ${dark ? '#94a3b8' : '#64748b'}; text-shadow: 1px 1px 1px rgba(0,0,0,0.7);">Ferizaj</div>`,
                className: 'city-label',
                iconSize: [60, 15],
                iconAnchor: [30, 8],
              })} />
              <Marker position={[42.3700, 21.1500]} icon={L.divIcon({
                html: `<div style="background: transparent; border: none; font-size: 10px; font-weight: bold; color: ${dark ? '#94a3b8' : '#64748b'}; text-shadow: 1px 1px 1px rgba(0,0,0,0.7);">Gjilan</div>`,
                className: 'city-label',
                iconSize: [50, 15],
                iconAnchor: [25, 8],
              })} />
              {trafficMarkers.map(marker => (
                <Marker
                  key={marker.id}
                  position={[marker.lat, marker.lng]}
                  icon={createCustomIcon(marker.severity)}
                  eventHandlers={{
                    click: () => setSelected(selected?.id === marker.id ? null : marker),
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold text-sm">{marker.label}</h3>
                      <p className="text-xs text-gray-600">{marker.road}</p>
                      <div className="mt-2 text-xs">
                        <div>Vehicles: {marker.vehicles}</div>
                        <div>Avg Speed: {marker.avgSpeed} km/h</div>
                        <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          marker.severity === 'high' ? 'bg-red-100 text-red-800' :
                          marker.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {severityColors[marker.severity].label} Severity
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map label */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
              <div className={`w-2 h-2 rounded-full bg-tblue-500 animate-pulse-slow`}></div>
              <span className={`text-[10px] tracking-widest uppercase text-white`}>Live · Updated 5s ago</span>
            </div>

            {/* Compass */}
            <div className="absolute top-4 right-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/20`}>
                <iconify-icon icon="lucide:compass" width="18" class="text-white"></iconify-icon>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className={`rounded-2xl border p-6 ${dark
            ? 'bg-navy-800/40 border-navy-600/20'
            : 'bg-paper-50 border-gray-200'}`}>
            {selected ? (
              <div className="animate-slide-right">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${severityColors[selected.severity].bg}/10 ${severityColors[selected.severity].text}`}> 
                      <iconify-icon icon={typeIcons[selected.type]} width="11"></iconify-icon>
                      {selected.severity} Severity
                    </div>
                    <h3 className={`font-serif text-xl font-semibold mt-3 ${dark ? 'text-white' : 'text-navy-800'}`}>{selected.label}</h3>
                    <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{selected.road}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-navy-600/50 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}>
                    <iconify-icon icon="lucide:x" width="14"></iconify-icon>
                  </button>
                </div>
                <div className="eastern-line w-full my-5"></div>
                <div className="space-y-4">
                  {[
                    { label:'Vehicles in Zone', value:selected.vehicles.toLocaleString(), icon:'lucide:car' },
                    { label:'Average Speed', value:`${selected.avgSpeed} km/h`, icon:'lucide:gauge' },
                    { label:'Congestion Index', value:selected.avgSpeed < 20 ? 'Critical' : selected.avgSpeed < 40 ? 'Moderate' : 'Low', icon:'lucide:activity' },
                  ].map((item,i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${dark ? 'bg-navy-700/30' : 'bg-white/60'}`}>
                      <div className="flex items-center gap-2.5">
                        <iconify-icon icon={item.icon} width="14" class="text-tblue-400"></iconify-icon>
                        <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="eastern-line w-full my-5"></div>
                {/* Mini speed chart */}
                <div>
                  <div className={`text-xs font-medium mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Speed Trend (last 30 min)</div>
                  <div className="flex items-end gap-1 h-16">
                    {[35,32,28,22,18,15,12,10,8,12,15,18].map((v,i) => (
                      <div key={i} className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{
                          height:`${(v/40)*100}%`,
                          background: v < 20 ? '#ef4444' : v < 35 ? '#f59e0b' : '#22c55e',
                          opacity: 0.5 + (i/12)*0.5,
                        }}></div>
                    ))}
                  </div>
                </div>
                <button className="w-full mt-6 py-2.5 rounded-xl bg-tblue-500 hover:bg-tblue-600 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2">
                  <iconify-icon icon="lucide:route" width="14"></iconify-icon>
                  Generate Alternate Route
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${dark ? 'bg-navy-700/40' : 'bg-gray-100'}`}>
                  <iconify-icon icon="lucide:map-pin" width="28" class={dark ? 'text-gray-600' : 'text-gray-300'}></iconify-icon>
                </div>
                <p className={`font-serif text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Select a Marker</p>
                <p className={`text-xs mt-2 max-w-[200px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                  Click any point on the map to view detailed traffic conditions and analytics
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// AI Chat Section
function AIChat() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [messages, setMessages] = useState(chatMessages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role:'user', content:input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      if (groq) {
        const response = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a traffic command center AI assistant for SEMAFORI in Kosovo. You have access to real-time traffic data for Pristina and surrounding areas. Provide helpful, accurate traffic advice, route recommendations, and incident information. Always respond in English and be professional.'
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: 500,
        });

        const aiResponse = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response at this time.';
        setMessages(prev => [...prev, { role:'assistant', content: aiResponse }]);
      } else {
        // Fallback to mock responses if GROQ is not available
        const responses = [
          'Based on current traffic patterns in Pristina, I recommend routing via the Eastern Ring Road. This would reduce your estimated travel time by approximately 23 minutes compared to the CBD route.',
          'Our predictive model indicates congestion will ease significantly after 16:30 when school traffic subsides. If your trip is flexible, delaying by 45 minutes would be optimal.',
          'I\'ve analyzed the sensor data for that corridor. The bottleneck appears to be caused by a poorly-timed signal sequence at the intersection. I\'ve submitted an optimization recommendation to the control team.',
          'The construction zone is operating on schedule. Lane closure will persist until 18:00 as planned. Would you like me to calculate the impact radius for your specific route?',
        ];
        setTimeout(() => {
          setMessages(prev => [...prev, { role:'assistant', content:responses[Math.floor(Math.random()*responses.length)] }]);
        }, 1500);
      }
    } catch (error) {
      console.error('Error calling GROQ API:', error);
      setMessages(prev => [...prev, { role:'assistant', content: 'I apologize, but I encountered an error while processing your request. Please try again.' }]);
    } finally {
      setTyping(false);
    }
  };

  const formatContent = (text) => {
    return text.split('\n').map((line,i) => (
      <React.Fragment key={i}>
        {line.split(/(\*\*.*?\*\*)/).map((part,j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className={dark ? 'text-tblue-300' : 'text-tblue-600'}>{part.slice(2,-2)}</strong>
            : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <section id="ai" className={`py-24 lg:py-32 ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left info */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="eastern-line w-8"></div>
              <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>AI Assistant</span>
            </div>
            <h2 className={`font-serif text-3xl lg:text-4xl font-bold mb-6 ${dark ? 'text-white' : 'text-navy-900'}`}>
              Your Traffic <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>Oracle</span>
            </h2>
            <p className={`text-sm leading-relaxed mb-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`} style={{lineHeight:'1.85'}}>
              Conversational AI trained on 4.7 billion traffic data points.
              Ask about congestion, routes, predictions — or let it proactively
              suggest optimizations you haven't considered.
            </p>

            <div className="space-y-4">
              {[
                { icon:'lucide:zap', title:'Instant Analysis', desc:'Real-time traffic queries answered in milliseconds' },
                { icon:'lucide:map-pin', title:'Route Intelligence', desc:'Multi-factor route optimization with live data' },
                { icon:'lucide:trending-up', title:'Predictive Insights', desc:'30-minute congestion forecasting with explanations' },
                { icon:'lucide:globe', title:'Multilingual', desc:'Supports 12 languages including English, German, Japanese' },
              ].map((f,i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${dark ? 'hover:bg-navy-800/40' : 'hover:bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${dark ? 'bg-tblue-500/10' : 'bg-tblue-50'}`}>
                    <iconify-icon icon={f.icon} width="15" class="text-tblue-500"></iconify-icon>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-navy-800'}`}>{f.title}</div>
                    <div className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <div className={`lg:col-span-3 rounded-2xl border overflow-hidden flex flex-col ${dark
            ? 'bg-navy-800/50 border-navy-600/20'
            : 'bg-paper-50 border-gray-200'}`} style={{height:'560px'}}>
            {/* Chat header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-navy-600/20' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-tblue-500/20 flex items-center justify-center">
                    <iconify-icon icon="lucide:bot" width="16" class="text-tblue-500"></iconify-icon>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-navy-800"></div>
                </div>
                <div>
                  <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-navy-800'}`}>Traffic AI</div>
                  <div className={`text-[10px] ${dark ? 'text-green-400/70' : 'text-green-600/70'}`}>Online ·  v4.2</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-navy-600/50 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}>
                  <iconify-icon icon="lucide:refresh-cw" width="14"></iconify-icon>
                </button>
                <button className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-navy-600/50 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}>
                  <iconify-icon icon="lucide:more-vertical" width="14"></iconify-icon>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 chat-scroll">
              {messages.map((m,i) => (
                <div key={i} className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${m.role==='user'
                    ? dark ? 'bg-tblue-500/20 text-tblue-100 rounded-br-md' : 'bg-tblue-500 text-white rounded-br-md'
                    : dark ? 'bg-navy-700/50 text-gray-300 rounded-bl-md' : 'bg-white text-gray-700 rounded-bl-md border border-gray-100'
                  }`} style={{lineHeight:'1.8'}}>
                    {m.role==='assistant' && (
                      <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-medium ${dark ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>
                        <iconify-icon icon="lucide:bot" width="10"></iconify-icon>
                        Traffic AI
                      </div>
                    )}
                    {formatContent(m.content)}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start animate-fade-in">
                  <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${dark ? 'bg-navy-700/50' : 'bg-white border border-gray-100'}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-tblue-400 animate-bounce" style={{animationDelay:'0ms'}}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-tblue-400 animate-bounce" style={{animationDelay:'150ms'}}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-tblue-400 animate-bounce" style={{animationDelay:'300ms'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className={`px-4 py-3 border-t ${dark ? 'border-navy-600/20' : 'border-gray-200'}`}>
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${dark ? 'bg-navy-700/40 border border-navy-600/20 focus-within:border-tblue-500/40' : 'bg-white border border-gray-200 focus-within:border-tblue-300'}`}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleSend()}
                  placeholder="Ask about traffic conditions, routes, predictions..."
                  className={`flex-1 bg-transparent text-xs outline-none placeholder:${dark ? 'text-gray-600' : 'text-gray-400'} ${dark ? 'text-white' : 'text-gray-700'}`}
                />
                <button onClick={handleSend}
                  className={`p-1.5 rounded-lg transition-all ${input.trim() ? 'bg-tblue-500 text-white hover:bg-tblue-600' : dark ? 'text-gray-600' : 'text-gray-300'}`}
                  disabled={!input.trim()}>
                  <iconify-icon icon="lucide:send" width="14"></iconify-icon>
                </button>
              </div>
              <div className={`flex items-center gap-3 mt-2 px-2`}>
                {['Congestion status','Route optimization','Prediction query'].map((s,i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${dark
                      ? 'bg-navy-700/40 text-gray-500 hover:text-gray-300 hover:bg-navy-600/40'
                      : 'bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Traffic Flow Visualization
function FlowViz() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [timeRange, setTimeRange] = useState('today');

  // Real traffic data for Pristina, Kosovo (vehicles per hour)
  const hourlyData = [45,32,28,35,52,78,125,180,210,195,175,160,155,165,185,195,220,245,235,195,165,120,85,55];
  const maxVal = Math.max(...hourlyData);

  return (
    <section className={`py-24 lg:py-32 ${dark ? 'bg-navy-950' : 'bg-paper-50'} paper-texture`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="eastern-line w-8"></div>
              <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>Flow Overview</span>
            </div>
            <h2 className={`font-serif text-3xl lg:text-4xl font-bold ${dark ? 'text-white' : 'text-navy-900'}`}>
              24-Hour Traffic <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>Pulse</span>
            </h2>
          </div>
          <div className="flex gap-2">
            {['today','week','month'].map(t => (
              <button key={t} onClick={() => setTimeRange(t)}
                className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all ${timeRange===t
                  ? 'bg-tblue-500 text-white'
                  : dark ? 'bg-navy-800/60 text-gray-400 hover:text-gray-200' : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className={`rounded-2xl border p-8 ${dark ? 'bg-navy-800/30 border-navy-600/20' : 'bg-white border-gray-200'}`}>
          <div className="flex items-end justify-between gap-1.5 h-48 mb-4">
            {hourlyData.map((v,i) => {
              const pct = (v/maxVal)*100;
              const hour = i.toString().padStart(2,'0');
              const isRush = (i>=7 && i<=9) || (i>=17 && i<=19);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <div className="relative w-full flex justify-center" style={{height:'160px'}}>
                    <div className="absolute bottom-0 w-full max-w-[28px] rounded-t-sm transition-all duration-500 group-hover/bar:opacity-100 opacity-70"
                      style={{
                        height:`${pct}%`,
                        background: isRush
                          ? 'linear-gradient(to top, #ef4444, #f59e0b)'
                          : dark ? 'linear-gradient(to top, #1e3a5f, #3b82f6)' : 'linear-gradient(to top, #dbeafe, #3b82f6)',
                      }}>
                    </div>
                    {/* Tooltip */}
                    <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] font-medium opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 ${dark
                      ? 'bg-navy-600 text-white' : 'bg-navy-800 text-white'}`}>
                      {v}k vehicles
                    </div>
                  </div>
                  <span className={`text-[9px] ${isRush ? (dark ? 'text-red-400/70' : 'text-red-500/70') : (dark ? 'text-gray-600' : 'text-gray-400')}`}>
                    {hour}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-6 mt-6 pt-4 border-t" style={{borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{background:'linear-gradient(to right, #1e3a5f, #3b82f6)'}}></div>
              <span className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Normal Flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{background:'linear-gradient(to right, #ef4444, #f59e0b)'}}></div>
              <span className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Rush Hour</span>
            </div>
            <div className={`ml-auto text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              Peak: <span className={`font-semibold ${dark ? 'text-white' : 'text-navy-800'}`}>245k vehicles</span> at 17:00
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// About / CTA Section
function About() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <section id="about" className={`relative py-24 lg:py-32 overflow-hidden ${dark ? 'bg-navy-900' : 'bg-white'}`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl ${dark ? 'bg-tblue-500/5' : 'bg-tblue-300/8'}`}></div>
      </div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="eastern-line w-8"></div>
              <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>About</span>
            </div>
            <h2 className={`font-serif text-3xl lg:text-4xl font-bold mb-8 ${dark ? 'text-white' : 'text-navy-900'}`}>
              From Ancient Roads to <span className={dark ? 'text-tblue-300' : 'text-tblue-600'}>Neural Networks</span>
            </h2>
            <div className={`space-y-6 text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`} style={{lineHeight:'1.9'}}>
              <p>
                The art of traffic management is as old as civilization itself. From the straight avenues of Prizren
                in the Dukagjini region — wide enough for twelve horsemen to ride abreast — to the intricate road networks
                of Mitrovica that synchronized water and road traffic, Eastern urban planning has always understood that
                flow is the soul of a city.
              </p>
              <p>
                We carry this philosophy forward. Our Traffic Command Center doesn't merely monitor roads — it
                understands the rhythm of urban life. Every sensor is a modern watchtower, every AI prediction
                a digital divination, every optimized signal a harmonious note in the symphony of city movement.
              </p>
              <p>
                Founded in 2026, we now serve 15 city districts with over 5,000 sensors, processing
                300k vehicle records daily. Our mission remains unchanged: <span className={`font-serif italic ${dark ? 'text-tblue-300' : 'text-tblue-600'}`}>
                "SEMAFORI" — Where commands flow, the world connects.</span>
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img src="https://picsum.photos/seed/kosovo-highway/700/500.jpg" alt="Kosovo highway traffic"
                className="w-full h-[400px] object-cover" />
              <div className={`absolute inset-0 ${dark ? 'bg-gradient-to-t from-navy-900/60 to-transparent' : 'bg-gradient-to-t from-navy-900/30 to-transparent'}`}></div>
            </div>
            {/* Quote card */}
            <div className={`absolute -bottom-8 -left-4 sm:left-8 max-w-xs p-5 rounded-xl backdrop-blur-xl shadow-xl ${dark
              ? 'bg-navy-800/80 border border-navy-500/20' : 'bg-white/80 border border-gray-200'}`}>
              <iconify-icon icon="lucide:quote" width="20" class="text-tblue-400 mb-2"></iconify-icon>
              <p className={`font-serif text-sm italic leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`} style={{lineHeight:'1.8'}}>
                "The superior commander moves like water — finding the path of least resistance, yet carving through stone."
              </p>
              <p className={`text-[10px] mt-3 tracking-wider uppercase ${dark ? 'text-gray-600' : 'text-gray-400'}`}>— Strategic Principles, c. 500 BCE</p>
            </div>
            <div className={`absolute -top-3 -right-3 w-16 h-16 border-t-2 border-r-2 rounded-tr-2xl ${dark ? 'border-tblue-500/20' : 'border-tblue-400/30'}`}></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const socials = [
    { icon: 'lucide:twitter', href: 'https://x.com/NoritQy' },
    { icon: 'lucide:github', href: 'https://github.com/nor1t' },
    { icon: 'lucide:linkedin', href: 'https://www.linkedin.com/in/noriti/' },
    { icon: 'lucide:mail', href: 'mailto:qnorit@gmail.com' },
  ];
  return (
    <footer className={`py-16 border-t ${dark ? 'bg-navy-950 border-navy-600/15' : 'bg-paper-50 border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-tblue-500/20">
                <img src="/logo.PNG" alt="SEMAFORI Logo" className="w-5 h-5 object-contain" />
              </div>
              <div>
                <span className={`font-serif font-semibold text-sm ${dark ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
                <span className={`block text-[9px] tracking-[0.2em] uppercase ${dark ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>Smart Traffic</span>
              </div>
            </div>
            <p className={`text-xs leading-relaxed ${dark ? 'text-gray-500' : 'text-gray-400'}`} style={{lineHeight:'1.8'}}>
              Harmonizing urban movement through artificial intelligence and centuries of traffic wisdom.
            </p>
          </div>
          {[
            { title:'Platform', links:['Live Map','AI Assistant','Flow Analytics','Incident Reports','Sensor Network'] },
            { title:'Solutions', links:['Smart Signals','Predictive Routing','Emergency Response','Parking Oracle','Urban Planning'] },
            { title:'Company', links:['About Us','Careers','Research','Partners','Contact'] },
          ].map((col,i) => (
            <div key={i}>
              <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}>
                    <a href="#" className={`text-xs transition-colors hover:text-tblue-400 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="eastern-line w-full mb-8"></div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className={`text-[11px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            © 2026 SEMAFORI. All rights reserved. Norit Qyqalla
          </p>
          <div className="flex items-center gap-4">
            {socials.map(({ icon, href }) => (
              <a key={icon} href={href} className={`p-2 rounded-lg transition-colors ${dark ? 'text-gray-600 hover:text-tblue-400 hover:bg-navy-800/40' : 'text-gray-400 hover:text-tblue-500 hover:bg-gray-100'}`}>
                <iconify-icon icon={icon} width="16"></iconify-icon>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

const TrafficCommandCenter = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  useEffect(() => {
    document.body.style.background = dark ? '#040810' : '#faf9f5';
    document.body.style.color = dark ? '#e5e5e5' : '#1a1a1a';
  }, [dark]);

  return (
    <div className={`min-h-screen transition-colors duration-500 grain ${dark ? 'bg-navy-950 text-gray-200' : 'bg-paper-50 text-gray-800'}`}>
      <SiteHeader />
      <Hero />
      <NotificationMarquee />
      <StatsBar />
      <Overview />
      <TrafficMap />
      <FlowViz />
      <AIChat />
      <About />
      <SiteFooter />
    </div>
  );
};

export default TrafficCommandCenter;

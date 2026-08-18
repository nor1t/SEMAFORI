import React from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const PIPELINE_STEPS = [
  {
    icon: 'lucide:video',
    title: 'Live city cameras',
    text: 'Four public cameras around Prishtina — Fushë Kosova, Aktash, Pejton and Bregu i Diellit — are sampled every 5 minutes, day and night.',
  },
  {
    icon: 'lucide:scan-line',
    title: 'Computer vision',
    text: 'A self-hosted YOLOv8n model with ByteTrack tracking counts the vehicles visible in each frame burst and every line crossing.',
  },
  {
    icon: 'lucide:database',
    title: 'Real data only',
    text: 'Every detection cycle is stored in Supabase. Nothing in this app is simulated — every number you see was measured on the street.',
  },
  {
    icon: 'lucide:layout-dashboard',
    title: 'This dashboard',
    text: 'The web app turns raw counts into live load indicators, camera health, analytics and an AI assistant that quotes the real data.',
  },
];

const FEATURES = [
  { to: '/cameras', icon: 'lucide:cctv', title: 'Camera Center', text: 'Watch the live feeds next to the latest AI-annotated snapshots and per-camera load.' },
  { to: '/ai-chat', icon: 'lucide:message-square-text', title: 'AI Assistant', text: 'Ask about traffic in natural language, or get route estimates with live network context.' },
  { to: '/live-map', icon: 'lucide:map', title: 'Live Map', text: 'A Google Maps cockpit with live traffic, camera load markers and community incident reports.' },
  { to: '/analytics', icon: 'lucide:bar-chart-3', title: 'Analytics', text: 'Hour-of-day profiles, camera comparison, vehicle-type mix, peaks and anomaly detection.' },
];

const TECH_STACK = ['React 19', 'Vite', 'Tailwind CSS', 'Supabase', 'Python', 'YOLOv8n (ONNX)', 'ByteTrack', 'Groq LLM', 'Google Maps API', 'Render', 'Vercel'];

const AboutPage = () => (
  <div className="theme-cockpit" style={{ minHeight: '100vh', color: 'var(--app-fg)' }}>
    <style>{`
      .glass-card { background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--card-border); transition: all 0.3s ease; box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset; }
      .glass-card:hover { background: var(--card-bg-hover); border-color: var(--card-border-hover); }
      .stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      .anim { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
      .d1{animation-delay:0.05s;opacity:0}.d2{animation-delay:0.12s;opacity:0}.d3{animation-delay:0.2s;opacity:0}.d4{animation-delay:0.28s;opacity:0}.d5{animation-delay:0.36s;opacity:0}
      .tech-chip { border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-dim); }
    `}</style>

    <SiteHeader />

    <main className="mx-auto max-w-4xl px-6 pb-16 pt-24">
      {/* Hero */}
      <section className="text-center anim d1">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-tblue-500/20">
          <img src="/NewLogo.png" alt="SEMAFORI" className="h-8 w-8 object-contain" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">About SEMAFORI</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          SEMAFORI is a smart traffic-monitoring platform for Prishtina, Kosova. It watches public city
          cameras around the clock, counts vehicles with computer vision, and turns the measurements into
          a live picture of how the city moves.
        </p>
      </section>
      {/* How it works */}
      <section className="mt-14 anim d2">
        <h2 className="stat-label mb-4 text-center">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.title} className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <iconify-icon icon={step.icon} width="16" className="text-orange-400" />
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>0{i + 1}</span>
              </div>
              <h3 className="text-sm font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore the app */}
      <section className="mt-12 anim d3">
        <h2 className="stat-label mb-4 text-center">Explore the app</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link key={feature.to} to={feature.to} className="glass-card rounded-2xl p-5 block group">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tblue-500/15 border border-tblue-500/25">
                  <iconify-icon icon={feature.icon} width="16" className="text-tblue-400" />
                </div>
                <iconify-icon icon="lucide:arrow-up-right" width="14" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--text-dim)' }} />
              </div>
              <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{feature.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="mt-12 anim d4">
        <h2 className="stat-label mb-4 text-center">Built with</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TECH_STACK.map((tech) => (
            <span key={tech} className="tech-chip rounded-full px-3 py-1.5 text-[11px] font-medium">{tech}</span>
          ))}
        </div>
      </section>

      {/* Credits */}
      <section className="mt-12 anim d5">
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Designed and built by <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>Norit Qyqalla</span> as
            a thesis project for Software Engineering. The detection pipeline runs 24/7 on Render;
            the dashboard is deployed on Vercel; all traffic data lives in Supabase.
          </p>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
);

export default AboutPage;
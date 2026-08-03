import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=512&q=80';

const emptyProfile = {
  full_name: '',
  email: '',
  phone: '',
  department: '',
  role: 'Officer',
  avatar_url: '',
  bio: '',
  location: 'Prishtinë, Kosova',
};

const recentActivity = [
  { id: 1, title: 'Reported congestion at Bill Clinton Blvd', time: '2 hours ago', dot: 'bg-orange-500', label: 'Report' },
  { id: 2, title: 'Incident marker placed at Aktash intersection', time: '5 hours ago', dot: 'bg-red-500', label: 'Marker' },
  { id: 3, title: 'AI route query: Prishtinë → Ferizaj', time: 'Yesterday at 3:15 PM', dot: 'bg-blue-500', label: 'Query' },
  { id: 4, title: 'Camera feed switched to Pejton', time: '2 days ago', dot: 'bg-emerald-500', label: 'Monitor' },
  { id: 5, title: 'Session started on Live Map', time: '3 days ago', dot: 'bg-fuchsia-500', label: 'Session' },
];

const skillsData = [
  { name: 'Traffic Monitoring', pct: 92, color: 'bg-orange-500/50' },
  { name: 'Incident Response', pct: 85, color: 'bg-blue-500/40' },
  { name: 'Route Planning', pct: 78, color: 'bg-emerald-500/40' },
  { name: 'Data Analysis', pct: 70, color: 'bg-fuchsia-500/30' },
  { name: 'AI Assistance', pct: 65, color: 'bg-orange-500/30' },
];

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(emptyProfile);
  const [initialProfileData, setInitialProfileData] = useState(emptyProfile);
  const [avatarPreview, setAvatarPreview] = useState(DEFAULT_AVATAR);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ text: '', type: 'success', visible: false });
  const [activeTab, setActiveTab] = useState('profile');
  const [stats, setStats] = useState({ totalReports: 0, activeReports: 0, resolvedReports: 0 });
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [twoFactorOn, setTwoFactorOn] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);

  /* ── Load profile ── */
  useEffect(() => {
    if (!user) return;
    const next = {
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
      phone: user.user_metadata?.phone || '',
      department: user.user_metadata?.department || '',
      role: user.user_metadata?.role || 'Officer',
      avatar_url: user.user_metadata?.avatar_url || DEFAULT_AVATAR,
      bio: user.user_metadata?.bio || '',
      location: user.user_metadata?.location || 'Prishtinë, Kosova',
    };
    setProfileData(next);
    setInitialProfileData(next);
    setAvatarPreview(next.avatar_url || DEFAULT_AVATAR);
  }, [user]);

  /* ── Load stats ── */
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.from('user_data').select('status').eq('user_id', user.id);
        if (error) throw error;
        const rows = data ?? [];
        setStats({
          totalReports: rows.length,
          activeReports: rows.filter(r => r.status === 'active').length,
          resolvedReports: rows.filter(r => r.status === 'cleared').length,
        });
      } catch {}
    };
    load();
  }, [user]);

  /* ── Toast auto-hide ── */
  useEffect(() => {
    if (toast.visible) {
      const id = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
      return () => clearTimeout(id);
    }
  }, [toast.visible]);

  const showToast = (text, type = 'success') => {
    setToast({ text, type, visible: true });
  };

  /* ── Handle save ── */
  const handleSave = async () => {
    if (!user) return;
    if (!profileData.full_name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const nextProfile = {
        full_name: profileData.full_name.trim(),
        phone: profileData.phone.trim(),
        department: profileData.department.trim(),
        role: profileData.role,
        avatar_url: profileData.avatar_url,
        bio: profileData.bio.trim(),
        location: profileData.location.trim(),
      };
      await supabase.auth.updateUser({ data: nextProfile });
      await supabase.from('profiles').upsert({ user_id: user.id, ...nextProfile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      setInitialProfileData(profileData);
      setEditing(false);
      showToast('Profile saved');
    } catch (err) {
      console.error(err);
      showToast('Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setProfileData(initialProfileData);
    setAvatarPreview(initialProfileData.avatar_url || DEFAULT_AVATAR);
    setEditing(false);
    showToast('Discarded', 'info');
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await signOut(); navigate('/login'); } finally { setLoggingOut(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const filePath = `avatars/${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const url = pub.publicUrl;
      setProfileData(prev => ({ ...prev, avatar_url: url }));
      setAvatarPreview(url);
      showToast('Photo updated');
    } catch (err) {
      console.error(err);
      showToast('Upload failed', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#09090b' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const isGuest = !user;
  const name = profileData.full_name || 'Traffic Operator';
  const parts = name.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1{animation-delay:0.03s;opacity:0}.d2{animation-delay:0.08s;opacity:0}.d3{animation-delay:0.13s;opacity:0}.d4{animation-delay:0.18s;opacity:0}.d5{animation-delay:0.23s;opacity:0}
        .tab-btn{font-size:13px;font-weight:400;color:#52525b;padding:8px 0;position:relative;transition:color 0.2s;cursor:pointer;background:none;border:none}
        .tab-btn:hover{color:#a1a1aa}
        .tab-btn.active{color:#fff;font-weight:500}
        .tab-btn.active::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:1px;background:#fff}
        .field-group label{display:block;font-size:11px;font-weight:500;color:#3f3f46;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em}
        .field-display{font-size:14px;font-weight:300;color:#d4d4d8;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.03);min-height:38px;display:flex;align-items:center}
        .field-input{width:100%;font-size:14px;font-weight:300;color:#fff;background:transparent;border:none;border-bottom:1px solid rgba(249,115,22,0.25);padding:9px 0;outline:none;font-family:Inter,sans-serif;transition:border-color 0.2s}
        .field-input:focus{border-bottom-color:#f97316}
        .field-input::placeholder{color:#27272a}
        textarea.field-input{border:1px solid rgba(249,115,22,0.25);border-radius:8px;padding:10px 12px;resize:none;line-height:1.6}
        textarea.field-input:focus{border-color:#f97316}
        .pill{font-size:11px;padding:3px 10px;border-radius:9999px;border:1px solid rgba(255,255,255,0.05);color:#52525b;background:transparent;transition:all 0.2s}
        .skill-row{display:flex;align-items:center;gap:12px;padding:6px 0}
        .skill-name{font-size:13px;color:#a1a1aa;font-weight:300;width:130px;flex-shrink:0}
        .skill-bar-bg{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,0.04);overflow:hidden}
        .skill-bar-fill{height:100%;border-radius:99px;transition:width 0.8s cubic-bezier(0.16,1,0.3,1)}
        .skill-pct{font-size:11px;color:#3f3f46;font-family:monospace;width:30px;text-align:right}
        .act-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03)}
        .act-item:last-child{border-bottom:none}
        .act-dot{width:6px;height:6px;border-radius:9999px;margin-top:6px;flex-shrink:0}
        .bg-glow{position:fixed;width:500px;height:300px;border-radius:9999px;filter:blur(140px);opacity:0.035;pointer-events:none;z-index:-10}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1c1c1e;border-radius:99px}
      `}</style>

      <div className="bg-glow" style={{ top: '-80px', left: '40%', background: '#f97316' }} />

      <SiteHeader />

      {/* Top Bar */}
      <div className="border-b border-zinc-800/30 pt-14">
        <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium">profile</span>
          {!isGuest && (
            <div className="flex items-center gap-2">
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-[11px] text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded">Edit</button>
              ) : (
                <>
                  <button onClick={handleCancel} className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="text-[11px] bg-white text-black px-3 py-1 rounded font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50" style={{ boxShadow: '0 0 12px -4px rgba(255,255,255,0.2)' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-10 pb-20">
        {isGuest ? (
          /* ── Guest View ── */
          <div className="text-center py-20 anim d1">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-5">
              <iconify-icon icon="lucide:user" width="28" className="text-zinc-500" />
            </div>
            <h1 className="text-xl font-semibold">Sign in to view your profile</h1>
            <p className="text-[13px] text-zinc-500 mt-2">Access your traffic command profile and activity</p>
            <div className="flex justify-center gap-3 mt-6">
              <Link to="/login" className="px-5 py-2 bg-white text-black text-[13px] font-semibold rounded-lg">Login</Link>
              <Link to="/signup" className="px-5 py-2 border border-zinc-700 text-zinc-300 text-[13px] font-semibold rounded-lg">Sign Up</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="flex flex-col items-center text-center anim d1">
              <div className="relative group mb-4">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  <img src={avatarPreview} className="w-20 h-20 rounded-full object-cover border-2 border-zinc-800 transition-all duration-500 group-hover:border-orange-500/40" alt="" />
                  {editing && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <iconify-icon icon="lucide:camera" width="16" className="text-white/70" />
                    </div>
                  )}
                </label>
              </div>
              <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
              <p className="text-[13px] text-zinc-500 font-light mt-1">{profileData.role === 'Officer' ? 'Traffic Officer' : profileData.role === 'Supervisor' ? 'Traffic Supervisor' : profileData.role === 'Manager' ? 'Traffic Manager' : 'Administrator'}{profileData.department ? ` · ${profileData.department}` : ''}</p>

              <div className="flex items-center gap-6 mt-5">
                <div className="text-center"><div className="text-base font-semibold">{stats.totalReports}</div><div className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Reports</div></div>
                <div className="w-px h-6 bg-zinc-800/50" />
                <div className="text-center"><div className="text-base font-semibold text-orange-400">{stats.activeReports}</div><div className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Active</div></div>
                <div className="w-px h-6 bg-zinc-800/50" />
                <div className="text-center"><div className="text-base font-semibold text-emerald-400">{stats.resolvedReports}</div><div className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Resolved</div></div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {[
                  `Role: ${profileData.role}`,
                  profileData.department || 'General',
                  `ID: ${user.id.slice(0, 8)}…`,
                ].map((t, i) => (
                  <span key={i} className="pill">{t}</span>
                ))}
                <span className="pill" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.15)' }}>Verified</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-10 border-b border-zinc-800/40 flex gap-6 anim d2">
              {['Profile', 'Skills', 'Activity', 'Settings'].map(t => (
                <button key={t} className={`tab-btn ${activeTab === t.toLowerCase() ? 'active' : ''}`} onClick={() => setActiveTab(t.toLowerCase())}>{t}</button>
              ))}
            </div>

            {/* ═══ Profile Tab ═══ */}
            {activeTab === 'profile' && (
              <div className="mt-8 anim d3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                  <div className="field-group">
                    <label>Full Name</label>
                    {editing ? (
                      <input type="text" className="field-input" value={profileData.full_name} onChange={e => setProfileData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Full name" />
                    ) : (
                      <div className="field-display">{name}</div>
                    )}
                  </div>
                  <div className="field-group">
                    <label>Email</label>
                    <div className="flex items-center gap-2">
                      <div className="field-display flex-1">{profileData.email}</div>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70 font-semibold uppercase tracking-wider flex-shrink-0">✓</span>
                    </div>
                  </div>
                  <div className="field-group">
                    <label>Role</label>
                    {editing ? (
                      <select className="field-input" value={profileData.role} onChange={e => setProfileData(prev => ({ ...prev, role: e.target.value }))} style={{ appearance: 'none' }}>
                        {['Officer', 'Supervisor', 'Manager', 'Admin'].map(r => (
                          <option key={r} value={r} style={{ background: '#18181b', color: '#fff' }}>{r === 'Officer' ? 'Traffic Officer' : r === 'Supervisor' ? 'Traffic Supervisor' : r === 'Manager' ? 'Traffic Manager' : 'Administrator'}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="field-display">{profileData.role === 'Officer' ? 'Traffic Officer' : profileData.role === 'Supervisor' ? 'Traffic Supervisor' : profileData.role === 'Manager' ? 'Traffic Manager' : 'Administrator'}</div>
                    )}
                  </div>
                  <div className="field-group">
                    <label>Department</label>
                    {editing ? (
                      <input type="text" className="field-input" value={profileData.department} onChange={e => setProfileData(prev => ({ ...prev, department: e.target.value }))} placeholder="Department" />
                    ) : (
                      <div className="field-display">{profileData.department || '—'}</div>
                    )}
                  </div>
                  <div className="field-group">
                    <label>Phone</label>
                    {editing ? (
                      <input type="tel" className="field-input" value={profileData.phone} onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" />
                    ) : (
                      <div className="field-display">{profileData.phone || '—'}</div>
                    )}
                  </div>
                  <div className="field-group">
                    <label>Location</label>
                    {editing ? (
                      <input type="text" className="field-input" value={profileData.location} onChange={e => setProfileData(prev => ({ ...prev, location: e.target.value }))} placeholder="Location" />
                    ) : (
                      <div className="field-display">{profileData.location || '—'}</div>
                    )}
                  </div>
                  <div className="field-group sm:col-span-2">
                    <label>Bio</label>
                    {editing ? (
                      <textarea className="field-input" rows={3} value={profileData.bio} onChange={e => setProfileData(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tell us about yourself…" />
                    ) : (
                      <div className="field-display" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{profileData.bio || 'No bio yet.'}</div>
                    )}
                  </div>
                </div>

                {/* Edit actions moved below */}
                {editing && (
                  <div className="flex items-center gap-3 mt-8 pt-6 border-t border-zinc-800/30 anim d4">
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-white text-black text-[13px] font-semibold rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50" style={{ boxShadow: '0 0 12px -4px rgba(255,255,255,0.2)' }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={handleCancel} className="px-6 py-2 text-[13px] text-zinc-500 hover:text-white transition-colors rounded-lg">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Skills Tab ═══ */}
            {activeTab === 'skills' && (
              <div className="mt-8 anim d3">
                <div className="space-y-1">
                  {skillsData.map(s => (
                    <div key={s.name} className="skill-row">
                      <span className="skill-name">{s.name}</span>
                      <div className="skill-bar-bg"><div className={`skill-bar-fill ${s.color}`} style={{ width: `${s.pct}%` }} /></div>
                      <span className="skill-pct">{s.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Activity Tab ═══ */}
            {activeTab === 'activity' && (
              <div className="mt-8 anim d3">
                {recentActivity.map(a => (
                  <div key={a.id} className="act-item">
                    <div className={`act-dot ${a.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-300 font-light">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium mr-1.5 uppercase">{a.label}</span>
                        {a.title}
                      </p>
                      <p className="text-[11px] text-zinc-700 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ Settings Tab ═══ */}
            {activeTab === 'settings' && (
              <div className="mt-8 anim d3 space-y-6">
                <div>
                  <h3 className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider mb-3">Connected Services</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <iconify-icon icon="lucide:database" width="16" className="text-zinc-400" />
                        <span className="text-[13px] text-zinc-300 font-light">Supabase</span>
                      </div>
                      <span className="text-[10px] text-emerald-500/70">Connected</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <iconify-icon icon="lucide:cpu" width="16" className="text-orange-400/60" />
                        <span className="text-[13px] text-zinc-300 font-light">Groq AI</span>
                      </div>
                      <span className="text-[10px] text-emerald-500/70">Connected</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <iconify-icon icon="lucide:video" width="16" className="text-blue-400/60" />
                        <span className="text-[13px] text-zinc-300 font-light">Gjirafa Cameras</span>
                      </div>
                      <span className="text-[10px] text-zinc-600">Active</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/30" />

                <div>
                  <h3 className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider mb-3">Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-zinc-400 font-light">Notifications</span>
                      <button onClick={() => setNotificationsOn(!notificationsOn)} className="w-9 h-5 rounded-full relative transition-colors" style={{ background: notificationsOn ? '#f97316' : '#27272a' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200" style={{ left: notificationsOn ? '16px' : '2px' }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-zinc-400 font-light">Two-factor auth</span>
                      <button onClick={() => setTwoFactorOn(!twoFactorOn)} className="w-9 h-5 rounded-full relative transition-colors" style={{ background: twoFactorOn ? '#f97316' : '#27272a' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200" style={{ left: twoFactorOn ? '16px' : '2px' }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-zinc-400 font-light">Public profile</span>
                      <button onClick={() => setPublicProfile(!publicProfile)} className="w-9 h-5 rounded-full relative transition-colors" style={{ background: publicProfile ? '#f97316' : '#27272a' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200" style={{ left: publicProfile ? '16px' : '2px' }} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/30" />

                <div>
                  <h3 className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider mb-3">Account</h3>
                  <div className="space-y-2">
                    <button onClick={handleLogout} disabled={loggingOut} className="w-full text-left py-2 text-[13px] text-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50">
                      {loggingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Toast */}
      <div className="fixed bottom-8 left-1/2 z-[100] px-4 py-2 rounded-lg text-[12px] text-zinc-300 font-medium flex items-center gap-2 transition-all duration-300 pointer-events-none" style={{ background: 'rgba(24,24,27,0.9)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', opacity: toast.visible ? 1 : 0, transform: toast.visible ? 'translate(-50%, 0)' : 'translate(-50%, 12px)' }}>
        <iconify-icon icon={toast.type === 'error' ? 'lucide:x-circle' : toast.type === 'info' ? 'lucide:minus-circle' : 'lucide:check'} width="12" className={toast.type === 'error' ? 'text-red-400' : toast.type === 'info' ? 'text-zinc-500' : 'text-emerald-400'} />
        <span>{toast.text}</span>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
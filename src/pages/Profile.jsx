import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
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
};

const roleOptions = [
  { value: 'Officer', label: 'Traffic Officer' },
  { value: 'Supervisor', label: 'Supervisor' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Admin', label: 'Administrator' },
];

const getErrorDetails = (error) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();

const canFallbackToAuthMetadata = (error) => {
  const details = getErrorDetails(error);

  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    error?.code === '42501' ||
    error?.status === 401 ||
    error?.status === 403 ||
    details.includes('profiles') ||
    details.includes('row-level security') ||
    details.includes('permission denied') ||
    details.includes('not allowed') ||
    details.includes('relation') ||
    details.includes('does not exist') ||
    details.includes('could not find the table')
  );
};

const Profile = () => {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [profileData, setProfileData] = useState(emptyProfile);
  const [initialProfileData, setInitialProfileData] = useState(emptyProfile);
  const [avatarPreview, setAvatarPreview] = useState(DEFAULT_AVATAR);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [stats, setStats] = useState({ totalReports: 0, activeReports: 0, resolvedReports: 0 });

  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && !canFallbackToAuthMetadata(profileError)) {
        console.error('Error fetching profile row:', profileError);
      }

      const nextProfile = {
        full_name: profile?.full_name || user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: profile?.phone || user.user_metadata?.phone || '',
        department: profile?.department || user.user_metadata?.department || '',
        role: profile?.role || user.user_metadata?.role || 'Officer',
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || DEFAULT_AVATAR,
      };

      setProfileData(nextProfile);
      setInitialProfileData(nextProfile);
      setAvatarPreview(nextProfile.avatar_url);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('status')
        .eq('user_id', user.id);

      if (error) throw error;

      const rows = data ?? [];
      const totalReports = rows.length;
      const activeReports = rows.filter((item) => item.status === 'active').length;
      const resolvedReports = rows.filter((item) => item.status === 'cleared').length;

      setStats({ totalReports, activeReports, resolvedReports });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user, loadProfile, loadStats]);

  useEffect(() => {
    document.body.style.background = dark ? '#040810' : '#faf9f5';
    document.body.style.color = dark ? '#e5e5e5' : '#1a1a1a';
  }, [dark]);

  const upsertProfileRecord = useCallback(async (profilePatch) => {
    const { error } = await supabase
      .from('profiles')
      .upsert(profilePatch, { onConflict: 'user_id' });

    if (!error) return true;

    if (canFallbackToAuthMetadata(error)) {
      console.warn('Profiles table is unavailable, falling back to auth metadata.', error);
      return false;
    }

    throw error;
  }, []);

  const updateAuthMetadata = useCallback(async (profilePatch) => {
    const { error } = await supabase.auth.updateUser({
      data: profilePatch,
    });

    if (error) throw error;
  }, []);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    const filePath = `avatars/${user.id}/${Date.now()}_${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

    // ── Persist the new avatar_url to the profiles table immediately ──
      await upsertProfileRecord({
        user_id: user.id,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });

      await updateAuthMetadata({ avatar_url: publicUrl });

      setProfileData((prev) => ({ ...prev, avatar_url: publicUrl }));
      setInitialProfileData((prev) => ({ ...prev, avatar_url: publicUrl }));
      setAvatarPreview(publicUrl);
      setMessage({ text: 'Profile picture updated successfully.', type: 'success' });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage({ text: 'Failed to upload avatar. Check your storage settings.', type: 'error' });
    } finally {
      setAvatarUploading(false);
      window.setTimeout(() => setMessage({ text: '', type: '' }), 3500);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const updatedProfile = {
        user_id: user.id,
        full_name: profileData.full_name,
        phone: profileData.phone,
        department: profileData.department,
        role: profileData.role,
        avatar_url: profileData.avatar_url,
        updated_at: new Date().toISOString(),
      };

      await upsertProfileRecord(updatedProfile);
      await updateAuthMetadata({
        full_name: profileData.full_name,
        phone: profileData.phone,
        department: profileData.department,
        role: profileData.role,
        avatar_url: profileData.avatar_url,
      });

      setInitialProfileData(profileData);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      window.setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage({ text: 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfileData(initialProfileData);
    setAvatarPreview(initialProfileData.avatar_url || DEFAULT_AVATAR);
    setMessage({ text: '', type: '' });
  };

  if (loading) {
    return (
      <div className={`grain flex min-h-screen items-center justify-center transition-colors duration-500 ${dark ? 'bg-navy-950 text-gray-200' : 'bg-paper-50 text-gray-800'}`}>
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-tblue-500"></div>
      </div>
    );
  }

  const isGuest = !user;
  const completionFields = [
    profileData.full_name,
    profileData.email,
    profileData.phone,
    profileData.department,
    profileData.role,
    profileData.avatar_url,
  ];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const hasChanges = Object.keys(profileData).some((key) => profileData[key] !== initialProfileData[key]);

  const panelClass = dark ? 'border-navy-600/20 bg-navy-900/60' : 'border-gray-200/80 bg-white/90';
  const secondaryPanelClass = dark ? 'border-slate-800/80 bg-slate-900/80' : 'border-gray-200 bg-white/85';
  const labelClass = dark ? 'text-slate-200' : 'text-slate-700';
  const textMutedClass = dark ? 'text-gray-400' : 'text-gray-500';
  const inputClass = dark
    ? 'border-slate-700/80 bg-slate-950/90 text-slate-100 focus:border-cyan-400'
    : 'border-slate-200 bg-white text-slate-800 focus:border-tblue-500';
  const readonlyInputClass = dark
    ? 'border-slate-700/80 bg-slate-900/80 text-slate-400'
    : 'border-slate-200 bg-slate-50 text-slate-500';
  const ghostButtonClass = dark
    ? 'border-slate-700/90 bg-slate-950/80 text-slate-200 hover:bg-slate-900'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  const messageClass = message.type === 'error'
    ? dark
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-red-200 bg-red-50 text-red-700'
    : dark
      ? 'border-green-500/30 bg-green-500/10 text-green-200'
      : 'border-green-200 bg-green-50 text-green-700';

  return (
    <div className={`grain min-h-screen transition-colors duration-500 ${dark ? 'bg-navy-950 text-gray-200' : 'bg-paper-50 text-gray-800'}`}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        {message.text && (
          <div className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-xl ${messageClass}`}>
            {message.text}
          </div>
        )}

        {isGuest ? (
          <div className={`rounded-3xl border p-10 shadow-2xl backdrop-blur-xl ${panelClass}`}>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="eastern-line w-10"></div>
                  <span className={`text-[11px] uppercase tracking-[0.25em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>Profile Access</span>
                </div>
                <h1 className={`font-serif text-3xl font-bold ${dark ? 'text-white' : 'text-navy-900'}`}>Access Your Command Profile</h1>
                <p className={`max-w-xl text-sm leading-relaxed ${textMutedClass}`} style={{ lineHeight: '1.85' }}>
                  Sign in or create an account to manage your traffic command profile, update your personal details, and keep your dashboard identity in sync.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Link to="/login" className="rounded-2xl bg-tblue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-tblue-600">
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className={`rounded-2xl border px-6 py-3 text-sm font-semibold transition ${dark ? 'border-tblue-500/30 text-tblue-300 hover:bg-tblue-500/10' : 'border-tblue-500/20 text-tblue-600 hover:bg-tblue-50'}`}
                  >
                    Sign Up
                  </Link>
                </div>
              </div>

              <div className={`rounded-3xl border border-dashed p-6 text-center ${dark ? 'border-tblue-500/30 bg-slate-950/30' : 'border-tblue-500/20 bg-tblue-50/60'}`}>
                <div className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl ${dark ? 'bg-tblue-500/10 text-tblue-300' : 'bg-tblue-500/10 text-tblue-500'}`}>
                  👤
                </div>
                <p className={`text-sm ${textMutedClass}`}>
                  Secure access keeps your profile, role details, and command activity connected to the right account.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className={`rounded-3xl border p-8 shadow-xl backdrop-blur-xl ${panelClass}`}>
                <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`relative h-28 w-28 overflow-hidden rounded-[2rem] border ${dark ? 'border-slate-700/50 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
                      <img src={avatarPreview} alt="Profile avatar" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className={`text-sm uppercase tracking-[0.25em] ${dark ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>Command Profile</p>
                      <p className={`mt-1 text-2xl font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{profileData.full_name || 'Traffic Operator'}</p>
                      <p className={`mt-2 text-sm ${textMutedClass}`}>{profileData.role || 'Officer'}{profileData.department ? ` • ${profileData.department}` : ''}</p>
                    </div>
                  </div>

                  <div className="space-y-3 lg:max-w-xs lg:text-right">
                    <p className={`text-xs uppercase tracking-[0.3em] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Profile completeness</p>
                    <div className={`rounded-full p-1 ${dark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                      <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-300" style={{ width: `${completion}%` }} />
                    </div>
                    <p className={`text-sm ${textMutedClass}`}>{completion}% complete</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Upload Avatar</label>
                    <label className={`flex cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 py-4 text-sm transition ${dark ? 'border-slate-600/70 bg-slate-950/80 text-slate-300 hover:border-cyan-400 hover:text-white' : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-tblue-500 hover:bg-white hover:text-slate-800'}`}>
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                      {avatarUploading ? 'Uploading...' : 'Choose a photo'}
                    </label>
                  </div>
                  <div>
                    <p className={`mb-2 text-sm font-medium ${labelClass}`}>Image preview</p>
                    <div className={`rounded-3xl border p-4 ${dark ? 'border-slate-700/60 bg-slate-950/80' : 'border-slate-200 bg-slate-50'}`}>
                      <img src={avatarPreview} alt="Avatar preview" className="h-36 w-full rounded-3xl object-cover" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Full Name</label>
                    <input
                      type="text"
                      value={profileData.full_name}
                      onChange={(event) => setProfileData({ ...profileData, full_name: event.target.value })}
                      className={`w-full rounded-3xl border px-4 py-3 outline-none transition ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className={`w-full rounded-3xl border px-4 py-3 outline-none ${readonlyInputClass}`}
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(event) => setProfileData({ ...profileData, phone: event.target.value })}
                      className={`w-full rounded-3xl border px-4 py-3 outline-none transition ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Department</label>
                    <input
                      type="text"
                      value={profileData.department}
                      onChange={(event) => setProfileData({ ...profileData, department: event.target.value })}
                      className={`w-full rounded-3xl border px-4 py-3 outline-none transition ${inputClass}`}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>Role</label>
                  <select
                    value={profileData.role}
                    onChange={(event) => setProfileData({ ...profileData, role: event.target.value })}
                    className={`w-full rounded-3xl border px-4 py-3 outline-none transition ${inputClass}`}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex-1 rounded-3xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? 'Saving changes...' : 'Save profile'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!hasChanges}
                    className={`flex-1 rounded-3xl border px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${ghostButtonClass}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-xl ${secondaryPanelClass}`}>
                <h3 className={`mb-4 text-lg font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>Insights</h3>
                <div className={`space-y-4 text-sm ${textMutedClass}`}>
                  <div className="flex items-center justify-between">
                    <span>Total Reports</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{stats.totalReports}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active Incidents</span>
                    <span className="font-semibold text-cyan-400">{stats.activeReports}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Resolved Cases</span>
                    <span className="font-semibold text-emerald-400">{stats.resolvedReports}</span>
                  </div>
                  <div className={`rounded-2xl border p-4 ${dark ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
                    <span className={`block text-xs uppercase tracking-[0.3em] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Account ID</span>
                    <p className={`mt-2 break-all text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{user.id}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-xl ${secondaryPanelClass}`}>
                <h3 className={`mb-4 text-lg font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>Quick Access</h3>
                <div className="space-y-3">
                  <Link
                    to="/dashboard"
                    className={`block rounded-2xl border px-4 py-3 text-sm font-medium transition ${dark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}
                  >
                    Return to dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      loadProfile();
                      loadStats();
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${dark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}
                  >
                    Refresh profile data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Profile;

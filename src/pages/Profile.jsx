import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Header from '../components/Header';

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [stats, setStats] = useState({ totalReports: 0, activeReports: 0, resolvedReports: 0 });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      // Load profile data from user metadata or a profiles table
      const profile = {
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        department: user.user_metadata?.department || '',
        role: user.user_metadata?.role || 'Officer',
      };
      setProfileData(profile);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('status')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalReports = data.length;
      const activeReports = data.filter(item => item.status === 'active').length;
      const resolvedReports = data.filter(item => item.status === 'cleared').length;

      setStats({ totalReports, activeReports, resolvedReports });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update user metadata in Supabase
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          phone: profileData.phone,
          department: profileData.department,
          role: profileData.role,
        }
      });

      if (error) throw error;

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-8 pt-24 sm:px-6 lg:px-8">
        {message.text && (
          <div className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-xl ${
            message.type === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">Profile Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Full Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                        className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-slate-300">{profileData.full_name || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
                    <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-slate-400">{profileData.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-slate-300">{profileData.phone || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Department</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={profileData.department}
                        onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                        className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                        placeholder="e.g., Traffic Control"
                      />
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-slate-300">{profileData.department || 'Not set'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Role</label>
                  {isEditing ? (
                    <select
                      value={profileData.role}
                      onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                      className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                    >
                      <option value="Officer">Traffic Officer</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  ) : (
                    <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-slate-300">{profileData.role}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats and Quick Actions */}
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Your Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Total Reports</span>
                  <span className="text-2xl font-semibold text-white">{stats.totalReports}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Active Incidents</span>
                  <span className="text-2xl font-semibold text-cyan-300">{stats.activeReports}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Resolved Cases</span>
                  <span className="text-2xl font-semibold text-emerald-300">{stats.resolvedReports}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full rounded-2xl bg-slate-800/70 px-4 py-3 text-left text-slate-200 transition hover:bg-slate-700"
                >
                  📊 View Dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full rounded-2xl bg-slate-800/70 px-4 py-3 text-left text-slate-200 transition hover:bg-slate-700"
                >
                  🔄 Refresh Data
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Account Details</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p>Member since: {new Date(user?.created_at).toLocaleDateString()}</p>
                <p>Last sign in: {new Date(user?.last_sign_in_at).toLocaleDateString()}</p>
                <p>User ID: {user?.id?.slice(0, 8)}...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
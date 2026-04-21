import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import Header from '../components/Header';

const incidentTypes = ['Aksident', 'Konstruksion', 'Trafik i Rëndë', 'Moti'];
const severityOptions = ['Minore', 'Moderate', 'Madhore'];
const statusOptions = [
  { value: 'active', label: 'Aktiv', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'under_control', label: 'Nën Kontroll', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'cleared', label: 'Pastruar', badge: 'bg-sky-500/15 text-sky-300' },
];

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: incidentTypes[0],
    severity: severityOptions[1],
    status: 'active',
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);

  console.log('Dashboard render:', { user, authLoading });

  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Redirecting to login');
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  // Early return for debugging
  if (authLoading) {
    console.log('Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) {
    console.log('No user, should redirect');
    return null;
  }

  console.log('Rendering dashboard content');

  const fetchReports = useCallback(async () => {
    if (!user) {
      console.log('No user available for fetchReports');
      return;
    }
    console.log('Fetching reports for user:', user.id);
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Fetched reports:', data);
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setMessage({ text: 'Nuk mund të ngarkohen raportet nga Supabase.', type: 'error' });
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchReports();
  }, [user, fetchReports]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3200);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      type: incidentTypes[0],
      severity: severityOptions[1],
      status: 'active',
    });
  };

  const handleSubmit = async (e, retryCount = 0) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showMessage('Titulli është i nevojshëm.', 'error');
      return;
    }

    // Check if offline
    if (!navigator.onLine) {
      showMessage('Jeni offline. Kontrolloni lidhjen tuaj të internetit dhe provoni përsëri.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        severity: formData.severity,
        status: formData.status,
      };

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Kërkesa ka skaduar. Provoni përsëri.')), 15000);
      });

      const submitPromise = supabase.from('user_data').insert([payload]);

      const { error } = await Promise.race([submitPromise, timeoutPromise]);

      if (error) throw error;
      resetForm();
      await fetchReports();
      showMessage('Incidenti u shtua me sukses.');
    } catch (err) {
      console.error('Error submitting report:', err);
      let message = 'Nuk mund të ruhet incidenti.';

      if (err.message.includes('timeout') || err.message.includes('skaduar')) {
        message = 'Kërkesa ka skaduar. Provoni përsëri.';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        message = 'Problem me lidhjen. Kontrolloni internetin dhe provoni përsëri.';
      }

      showMessage(message, 'error');

      // Auto-retry for network errors, up to 2 retries
      if ((err.message.includes('network') || err.message.includes('timeout') || err.message.includes('fetch')) && retryCount < 2) {
        console.log(`Retrying submit... Attempt ${retryCount + 1}`);
        setTimeout(() => handleSubmit({ preventDefault: () => {} }, retryCount + 1), 3000);
        showMessage(`${message} (Duke provuar përsëri...)`, 'error');
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!formData.title.trim()) {
      showMessage('Titulli është i nevojshëm.', 'error');
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        severity: formData.severity,
        status: formData.status,
      };
      const { error } = await supabase
        .from('user_data')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      resetForm();
      setEditingId(null);
      await fetchReports();
      showMessage('Incidenti u përditësua me sukses.');
    } catch (err) {
      console.error('Error updating report:', err);
      showMessage('Nuk mund të përditësohet incidenti në Supabase.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Fshi këtë raport incidenti?')) return;
    try {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await fetchReports();
      showMessage('Incidenti u hoq nga paneli yt.');
    } catch (err) {
      console.error('Error deleting report:', err);
      showMessage('Nuk mund të hiqet incidenti nga Supabase.', 'error');
    }
  };

  const startEditing = (report) => {
    setEditingId(report.id);
    setFormData({
      title: report.title,
      description: report.description,
      type: report.type,
      severity: report.severity,
      status: report.status,
    });
  };

  const stats = useMemo(() => {
    const active = reports.filter((item) => item.status === 'active').length;
    const control = reports.filter((item) => item.status === 'under_control').length;
    const cleared = reports.filter((item) => item.status === 'cleared').length;
    return { total: reports.length, active, control, cleared };
  }, [reports]);

  const statusBadge = (status) => {
    const option = statusOptions.find((item) => item.value === status);
    return option ? option.badge : 'bg-slate-500/15 text-slate-300';
  };

  return (
    <div className="dark:text-slate-100 text-gray-900 dark:bg-slate-950 bg-white min-h-screen">
      {/* <Header reports={reports} /> */}
      <main className="mx-auto max-w-7xl px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Welcome to the Traffic Control Command Center!</p>
          <p className="text-gray-600 dark:text-gray-300 mt-2">User: {user?.email}</p>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Reports: {reports.length}</p>
        </div>
        {message.text && (
          <div className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-xl ${
            message.type === 'error'
              ? 'dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 border-rose-500/30 bg-rose-500/10 text-rose-800'
              : 'dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
          }`}>
            {message.text}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl dark:border dark:border-slate-800/80 dark:bg-slate-900/80 border border-gray-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.25em] dark:text-slate-400 text-gray-600">Total raportet</p>
                <p className="mt-4 text-4xl font-semibold dark:text-white text-gray-900">{stats.total}</p>
              </div>
              <div className="rounded-3xl dark:border dark:border-slate-800/80 dark:bg-slate-900/80 border border-gray-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.25em] dark:text-slate-400 text-gray-600">Aktiv</p>
                <p className="mt-4 text-4xl font-semibold dark:text-cyan-300 text-cyan-700">{stats.active}</p>
              </div>
              <div className="rounded-3xl dark:border dark:border-slate-800/80 dark:bg-slate-900/80 border border-gray-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.25em] dark:text-slate-400 text-gray-600">Pastruar</p>
                <p className="mt-4 text-4xl font-semibold dark:text-sky-300 text-sky-700">{stats.cleared}</p>
              </div>
            </div>

            <div className="rounded-3xl dark:border dark:border-slate-800/80 dark:bg-slate-900/80 border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] dark:text-slate-400 text-gray-600">Operacionet aktuale</p>
                  <h2 className="mt-3 text-3xl font-semibold dark:text-white text-gray-900">Pamja e përgjithshme e rrjedhës së trafikut</h2>
                </div>
                <div className="rounded-full dark:bg-slate-800/70 bg-gray-100 px-4 py-2 text-sm dark:text-slate-300 text-gray-700">
                  {new Date().toLocaleString()}
                </div>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Korridori më i prekur</p>
                  <p className="mt-3 text-lg font-semibold text-white">Rruga I-95</p>
                  <p className="mt-2 text-slate-400">Shumë vonesa për shkak të mbylljes së korsisë dhe trafikut të rëndë.</p>
                </div>
                <div className="rounded-3xl bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Incidenti kryesor</p>
                  <p className="mt-3 text-lg font-semibold text-white">Aksident në Veri Hub</p>
                  <p className="mt-2 text-slate-400">Ekipi i përgjigjes u dërgua. Pastrimi i parashikuar në 45 min.</p>
                </div>
                <div className="rounded-3xl bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Shëndeti i sistemit</p>
                  <p className="mt-3 text-lg font-semibold text-white">Stabil</p>
                  <p className="mt-2 text-slate-400">Të gjitha sistemet e monitorimit po funksionojnë normalisht.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Harta e trafikut live</p>
            <div className="mt-5 h-72 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-5 shadow-inner">
              <div className="relative h-full overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950">
                <div className="absolute left-4 top-4 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
                <div className="absolute right-6 top-10 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                <div className="absolute left-10 bottom-12 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                <div className="absolute inset-x-5 top-32 h-1 rounded-full bg-slate-700" />
                <div className="absolute inset-x-20 top-44 h-1 rounded-full bg-slate-700" />
                <div className="absolute inset-x-10 top-56 h-1 rounded-full bg-slate-700" />
                <div className="absolute left-16 top-20 h-9 w-9 rounded-full border border-slate-600 bg-slate-900" />
                <div className="absolute right-16 top-52 h-9 w-9 rounded-full border border-slate-600 bg-slate-900" />
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Raporti i incidentit</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Krijo një alarm trafiku të ri</h2>
              </div>
              <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {editingId ? 'Modaliteti i redaktimit' : 'Raport i ri'}
              </span>
            </div>

            <form onSubmit={editingId ? (e) => {e.preventDefault(); handleUpdate(editingId);} : handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-200">
                  Titulli i incidentit
                  <input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Mbyllja e rrugës në M4"
                    className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-200">
                  Kategoria
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {incidentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-200">
                Përshkrimi
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                  placeholder="Shto detaje për incidentin dhe përgjigjen e rekomanduar."
                  className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-slate-200">
                  Rëndësia
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {severityOptions.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-200">
                  Statusi
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Duke ruajtur...
                    </>
                  ) : (
                    editingId ? 'Përditëso raportin' : 'Shto incidentin'
                  )}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="rounded-full bg-slate-800 px-6 py-3 text-sm text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Anulo redaktimin
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Incidentet e fundit</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Rrjedha e raporteve</h2>
              </div>
              <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {reports.length} total
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {reports.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-700/70 bg-slate-950/80 p-8 text-center text-slate-400">
                  Ende nuk ka raporte incidenti. Përdor formularin për të shtuar një dhe monitoro kushtet e trafikut.
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-inner">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-slate-400 uppercase tracking-[0.2em]">{report.type}</p>
                        <h3 className="mt-2 text-xl font-semibold text-white">{report.title}</h3>
                        <p className="mt-2 text-slate-400">{report.description || 'Nuk janë dhënë detaje shtesë.'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(report.status)}`}>
                          {statusOptions.find((option) => option.value === report.status)?.label}
                        </span>
                        <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-300">{report.severity}</span>
                        <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-300">{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => startEditing(report)}
                        className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
                      >
                        Redakto
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="rounded-full bg-rose-500/15 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/25"
                      >
                        Fshi
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TrafficMap from '../components/TrafficMap';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import {
  createIncidentReport,
  fetchIncidentReports,
  removeIncidentReport,
  updateIncidentReport,
} from '../services/reportService';

const INCIDENT_TYPE_KEYS = ['accident', 'construction', 'heavyTrafficType', 'weather'];
const SEVERITY_KEYS = ['minor', 'moderate', 'major'];
const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'active', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { value: 'under_control', labelKey: 'underControl', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { value: 'cleared', labelKey: 'cleared', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
];

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const formSectionRef = useRef(null);

  const [reports, setReports] = useState([]);
  const [editingReport, setEditingReport] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: INCIDENT_TYPE_KEYS[0],
    severity: SEVERITY_KEYS[0],
    status: 'active',
    location: { lat: null, lng: null },
  });

  const locale = language === 'english' ? 'en-US' : 'sq-AL';
  const cardClass = theme === 'light'
    ? 'border border-slate-200 bg-white/85'
    : 'border border-slate-800/80 bg-slate-900/80';
  const innerCardClass = theme === 'light'
    ? 'bg-slate-100/90 text-slate-900'
    : 'bg-slate-950/80 text-white';

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: '', type: '' }), 3200);
  }, []);

  const resetForm = useCallback(() => {
    setEditingReport(null);
    setFormData({
      title: '',
      description: '',
      type: INCIDENT_TYPE_KEYS[0],
      severity: SEVERITY_KEYS[0],
      status: 'active',
      location: { lat: null, lng: null },
    });
  }, []);

  const fetchReports = useCallback(async () => {
    if (!user) return;

    try {
      const data = await fetchIncidentReports(user.id);
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      showMessage(t('errorFetch'), 'error');
    }
  }, [showMessage, t, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [fetchReports, user]);

  useEffect(() => {
    if (editingReport && formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingReport]);

  const stats = useMemo(() => {
    const active = reports.filter((item) => item.status === 'active').length;
    const control = reports.filter((item) => item.status === 'under_control').length;
    const cleared = reports.filter((item) => item.status === 'cleared').length;
    return { total: reports.length, active, control, cleared };
  }, [reports]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      showMessage(t('titleRequired'), 'error');
      return;
    }

    if (!navigator.onLine) {
      showMessage(t('offline'), 'error');
      return;
    }

    if (!user) return;

    setSubmitting(true);

    try {
      await createIncidentReport(user.id, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        severity: formData.severity,
        status: formData.status,
        location: formData.location,
      });

      resetForm();
      await fetchReports();
      showMessage(t('successMessage'));
    } catch (error) {
      console.error('Error submitting report:', error);
      showMessage(t('errorSave'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!editingReport) return;

    if (!formData.title.trim()) {
      showMessage(t('titleRequired'), 'error');
      return;
    }

    if (!user) return;

    setSubmitting(true);

    try {
      await updateIncidentReport(
        user.id,
        editingReport.id,
        {
          title: formData.title.trim(),
          description: formData.description.trim(),
          type: formData.type,
          severity: formData.severity,
          status: formData.status,
          location: formData.location,
        },
        editingReport.sourceTable
      );

      resetForm();
      await fetchReports();
      showMessage(t('updateSuccess'));
    } catch (error) {
      console.error('Error updating report:', error);
      showMessage(t('errorUpdate'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (report) => {
    if (!window.confirm(t('confirm'))) return;
    if (!user) return;

    try {
      await removeIncidentReport(user.id, report.id, report.sourceTable);
      await fetchReports();
      showMessage(t('deleteSuccess'));
    } catch (error) {
      console.error('Error deleting report:', error);
      showMessage(t('errorDelete'), 'error');
    }
  };

  const startEditing = (report) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      description: report.description || '',
      type: report.type || INCIDENT_TYPE_KEYS[0],
      severity: report.severity || SEVERITY_KEYS[0],
      status: report.status || 'active',
      location: {
        lat: report.location?.lat ?? null,
        lng: report.location?.lng ?? null,
      },
    });
  };

  const formatTypeLabel = (typeKey) => t(typeKey);
  const formatSeverityLabel = (severityKey) => t(severityKey);
  const formatStatusLabel = (status) => t(STATUS_OPTIONS.find((option) => option.value === status)?.labelKey || 'active');
  const statusBadgeClass = (status) => STATUS_OPTIONS.find((option) => option.value === status)?.badge || 'bg-slate-500/15 text-slate-700 dark:text-slate-300';

  if (authLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-950'}`}>
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      <Header reports={reports} />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {message.text && (
          <div className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-xl ${
            message.type === 'error'
              ? theme === 'light'
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : theme === 'light'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
          >
            {message.text}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={`rounded-3xl p-5 shadow-xl backdrop-blur-xl ${cardClass}`}>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('totalReports')}</p>
                <p className="mt-4 text-4xl font-semibold text-slate-900 dark:text-white">{stats.total}</p>
              </div>
              <div className={`rounded-3xl p-5 shadow-xl backdrop-blur-xl ${cardClass}`}>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('active')}</p>
                <p className="mt-4 text-4xl font-semibold text-cyan-700 dark:text-cyan-300">{stats.active}</p>
              </div>
              <div className={`rounded-3xl p-5 shadow-xl backdrop-blur-xl ${cardClass}`}>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('cleared')}</p>
                <p className="mt-4 text-4xl font-semibold text-sky-700 dark:text-sky-300">{stats.cleared}</p>
              </div>
            </div>

            <div className={`rounded-3xl p-6 shadow-xl backdrop-blur-xl ${cardClass}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('currentOperations')}</p>
                  <h2 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{t('trafficOverview')}</h2>
                </div>
                <div className={`rounded-full px-4 py-2 text-sm ${theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-slate-800/70 text-slate-300'}`}>
                  {new Date().toLocaleString(locale)}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className={`rounded-3xl p-4 ${innerCardClass}`}>
                  <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('affectedCorridor')}</p>
                  <p className="mt-3 text-lg font-semibold">{t('route')}</p>
                  <p className={`mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{t('heavyTrafficDescription')}</p>
                </div>
                <div className={`rounded-3xl p-4 ${innerCardClass}`}>
                  <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('mainIncident')}</p>
                  <p className="mt-3 text-lg font-semibold">{t('northHub')}</p>
                  <p className={`mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{t('responseTeam')}</p>
                </div>
                <div className={`rounded-3xl p-4 ${innerCardClass}`}>
                  <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('systemHealth')}</p>
                  <p className="mt-3 text-lg font-semibold">{t('stable')}</p>
                  <p className={`mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{t('allSystems')}</p>
                </div>
              </div>
            </div>
          </div>

          <aside className={`rounded-3xl p-6 shadow-xl backdrop-blur-xl ${cardClass}`}>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('liveTrafficMap')}</p>
            <div className="mt-5">
              <TrafficMap
                reports={reports}
                selectedLocation={formData.location.lat && formData.location.lng ? formData.location : null}
                onLocationSelect={(coords) => setFormData((prev) => ({ ...prev, location: coords }))}
              />
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div ref={formSectionRef} className={`rounded-3xl p-6 shadow-xl backdrop-blur-xl ${cardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('reportIncident')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{t('createNewTrafficAlert')}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-slate-800/70 text-slate-300'}`}>
                {editingReport ? t('editMode') : t('newReport')}
              </span>
            </div>

            <form onSubmit={editingReport ? handleUpdate : handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`block text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                  {t('incidentTitle')}
                  <input
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder={t('enterTitle')}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-400 ${theme === 'light' ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700/80 bg-slate-950/90 text-slate-100'}`}
                  />
                </label>

                <label className={`block text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                  {t('category')}
                  <select
                    value={formData.type}
                    onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-400 ${theme === 'light' ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700/80 bg-slate-950/90 text-slate-100'}`}
                  >
                    {INCIDENT_TYPE_KEYS.map((typeKey) => (
                      <option key={typeKey} value={typeKey}>
                        {t(typeKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={`block text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                {t('description')}
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  rows="4"
                  placeholder={t('addDetails')}
                  className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-400 ${theme === 'light' ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700/80 bg-slate-950/90 text-slate-100'}`}
                />
              </label>

              <div className={`rounded-3xl border p-4 ${theme === 'light' ? 'border-slate-200 bg-slate-100/80 text-slate-900' : 'border-slate-800/80 bg-slate-950/90 text-slate-200'}`}>
                <p className={`mb-2 text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>{t('selectLocation')}</p>
                <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('clickMapToPlacePin')}</p>
                {formData.location.lat && formData.location.lng && (
                  <div className={`mt-3 rounded-2xl p-3 text-sm ${theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900/80 text-slate-100'}`}>
                    <p>{t('locationSelected')}:</p>
                    <p>{`${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}`}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className={`block text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                  {t('severity')}
                  <select
                    value={formData.severity}
                    onChange={(event) => setFormData((prev) => ({ ...prev, severity: event.target.value }))}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-400 ${theme === 'light' ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700/80 bg-slate-950/90 text-slate-100'}`}
                  >
                    {SEVERITY_KEYS.map((severityKey) => (
                      <option key={severityKey} value={severityKey}>
                        {t(severityKey)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={`block text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                  {t('status')}
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-400 ${theme === 'light' ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700/80 bg-slate-950/90 text-slate-100'}`}
                  >
                    {STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {t(statusOption.labelKey)}
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
                      {t('saving')}
                    </>
                  ) : (
                    editingReport ? t('updateReport') : t('addIncident')
                  )}
                </button>

                {editingReport && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className={`rounded-full px-6 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${theme === 'light' ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                  >
                    {t('cancelEdit')}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className={`rounded-3xl p-6 shadow-xl backdrop-blur-xl ${cardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t('recentIncidents')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{t('reportFlow')}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-slate-800/70 text-slate-300'}`}>
                {reports.length} {t('totalItems')}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {reports.length === 0 ? (
                <div className={`rounded-3xl border border-dashed p-8 text-center ${theme === 'light' ? 'border-slate-300 bg-slate-50 text-slate-500' : 'border-slate-700/70 bg-slate-950/80 text-slate-400'}`}>
                  {t('noReports')}
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className={`rounded-3xl border p-5 shadow-inner ${theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-800/80 bg-slate-950/80'}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className={`text-sm uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{formatTypeLabel(report.type)}</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{report.title}</h3>
                        <p className={`mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{report.description || t('noDetails')}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(report.status)}`}>
                          {formatStatusLabel(report.status)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800/70 text-slate-300'}`}>
                          {formatSeverityLabel(report.severity)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800/70 text-slate-300'}`}>
                          {new Date(report.createdAt).toLocaleDateString(locale)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => startEditing(report)}
                        className={`rounded-full px-4 py-2 text-sm transition ${theme === 'light' ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                      >
                        {t('edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(report)}
                        className="rounded-full bg-rose-500/15 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/25 dark:text-rose-300"
                      >
                        {t('delete')}
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

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/Input';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, loading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email-i është i nevojshëm';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Shkruaj një adresë email të vlefshme';
    }
    if (!formData.password) {
      newErrors.password = 'Fjalëkalimi është i nevojshëm';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Fjalëkalimi duhet të jetë të paktën 6 karaktere';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const { error } = await signIn(formData.email, formData.password);
    if (error) {
      setServerError(error.message);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-950 text-slate-100">
      <div className="w-full max-w-lg">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/85 shadow-2xl backdrop-blur-xl p-8 sm:p-10">
          <div className="text-center mb-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 shadow-xl">
              <span className="text-4xl">🚦</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Qendra e Komandës së Trafikut</h1>
            <p className="mt-3 text-slate-400">Hyni për të menaxhuar raportet e incidenteve dhe monitoruar kushtet e rrugëve.</p>
          </div>

          {serverError && (
            <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-red-200 mb-2">{serverError}</p>
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => {} })}
                className="text-sm text-cyan-300 hover:text-cyan-200 underline"
              >
                Provo përsëri
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Adresa Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
            />
            <Input
              label="Fjalëkalimi"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Hyni në Kontroll'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400">
            <p>
              I ri për Komandën e Trafikut?{' '}
              <Link to="/signup" className="font-medium text-cyan-300 transition hover:text-cyan-100">
                Krijoni një llogari
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
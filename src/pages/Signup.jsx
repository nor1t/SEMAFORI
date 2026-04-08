import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';

const Signup = () => {
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Emri i plotë është i nevojshëm';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Emri duhet të jetë të paktën 2 karaktere';
    }
    if (!formData.email) {
      newErrors.email = 'Email-i është i nevojshëm';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Shkruaj një adresë email të vlefshme';
    }
    if (!formData.password) {
      newErrors.password = 'Fjalëkalimi është i nevojshëm';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Fjalëkalimi duhet të jetë të paktën 6 karaktere';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Përdor të paktën një shkronjë dhe një numër';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Fjalëkalimet nuk përputhen';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (serverError) setServerError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const { error } = await signUp(formData.email, formData.password, formData.name);
    if (error) {
      setServerError(error.message);
    } else {
      setSuccessMessage('Account created successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1800);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-xl">
        <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="text-center mb-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 shadow-xl">
              <span className="text-4xl">🛣️</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Bashkohuni me Komandën e Trafikut</h1>
            <p className="mt-3 text-slate-400">Krijoni një llogari të sigurt për të menaxhuar incidentet dhe shikuar kushtet e rrugëve.</p>
          </div>

          {serverError && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
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

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Emri i Plotë"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
              autoComplete="name"
            />
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
              autoComplete="new-password"
            />
            <Input
              label="Konfirmo Fjalëkalimin"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Duke krijuar llogari...' : 'Krijo llogari'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400">
            <p>
              Keni një llogari tashmë?{' '}
              <Link to="/login" className="font-medium text-cyan-300 transition hover:text-cyan-100">
                Hyni këtu
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
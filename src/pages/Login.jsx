import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import Input from '../components/Input';
import { translations } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { signIn, loading } = useAuth();
  const copy = translations.albanian;
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = copy.emailRequired;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = copy.emailInvalid;
    }

    if (!formData.password) {
      newErrors.password = copy.passwordRequired;
    } else if (formData.password.length < 6) {
      newErrors.password = copy.passwordTooShort;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const { error } = await signIn(formData.email, formData.password);
    if (error) {
      setServerError(error.message);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      <div className="w-full max-w-lg">
        <div className={`rounded-3xl border p-8 shadow-2xl backdrop-blur-xl sm:p-10 ${theme === 'light' ? 'border-slate-200 bg-white/90' : 'border-slate-800/80 bg-slate-900/85'}`}>
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 w-fit">
              <BrandMark />
            </div>
            <h1 className={`text-4xl font-semibold tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>SEMAFORI</h1>
            <p className={`mt-3 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{copy.loginSubtitle}</p>
          </div>

          {serverError && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 ${theme === 'light' ? 'border-red-300 bg-red-50' : 'border-red-500/40 bg-red-500/10'}`}>
              <p className={`mb-2 ${theme === 'light' ? 'text-red-700' : 'text-red-200'}`}>{serverError}</p>
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => {} })}
                className={`text-sm underline ${theme === 'light' ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-300 hover:text-cyan-200'}`}
              >
                {copy.tryAgain}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label={copy.emailAddress}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
            />
            <Input
              label={copy.passwordLabel}
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
                  {copy.loginSigningIn}
                </>
              ) : (
                copy.loginButton
              )}
            </button>
          </form>

          <div className={`mt-8 text-center text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            <p>
              {copy.loginNoAccount}{' '}
              <Link to="/signup" className={`font-medium transition ${theme === 'light' ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-300 hover:text-cyan-100'}`}>
                {copy.loginSignupLink}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

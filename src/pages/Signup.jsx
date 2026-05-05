import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import Input from '../components/Input';
import { translations } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const Signup = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();
  const copy = translations.albanian;
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
      newErrors.name = copy.nameRequired;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = copy.nameTooShort;
    }

    if (!formData.email) {
      newErrors.email = copy.emailRequired;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = copy.emailInvalid;
    }

    if (!formData.password) {
      newErrors.password = copy.passwordRequired;
    } else if (formData.password.length < 6) {
      newErrors.password = copy.passwordTooShort;
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = copy.passwordNeedsLetterAndNumber;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = copy.passwordsDoNotMatch;
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

    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const { error } = await signUp(formData.email, formData.password, formData.name);
    if (error) {
      setServerError(error.message);
      return;
    }

    setSuccessMessage(copy.signupSuccess);
    setTimeout(() => navigate('/login'), 1800);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      <div className="w-full max-w-xl">
        <div className={`rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl sm:p-10 ${theme === 'light' ? 'border-slate-200 bg-white/90' : 'border-slate-800/80 bg-slate-900/90'}`}>
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 w-fit">
              <BrandMark />
            </div>
            <h1 className={`text-4xl font-semibold tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>SEMAFORI</h1>
            <p className={`mt-3 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{copy.signupSubtitle}</p>
          </div>

          {serverError && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 ${theme === 'light' ? 'border-red-300 bg-red-50' : 'border-red-500/20 bg-red-500/10'}`}>
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

          {successMessage && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 ${theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label={copy.fullName}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
              autoComplete="name"
            />
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
              autoComplete="new-password"
            />
            <Input
              label={copy.confirmPassword}
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
              {loading ? copy.signupCreatingAccount : copy.signupButton}
            </button>
          </form>

          <div className={`mt-8 text-center text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            <p>
              {copy.signupAlreadyHaveAccount}{' '}
              <Link to="/login" className={`font-medium transition ${theme === 'light' ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-300 hover:text-cyan-100'}`}>
                {copy.signupLoginLink}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;

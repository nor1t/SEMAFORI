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
    <div className={`min-h-screen flex items-center justify-center overflow-hidden relative ${theme === 'dark' ? 'bg-navy-950' : 'bg-paper-50'} paper-texture grain`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 -left-32 w-96 h-96 rounded-full blur-3xl ${theme === 'dark' ? 'bg-tblue-500/5' : 'bg-tblue-300/10'}`}></div>
        <div className={`absolute bottom-20 right-0 w-80 h-80 rounded-full blur-3xl ${theme === 'dark' ? 'bg-tblue-600/5' : 'bg-tblue-400/8'}`}></div>
        <svg className="absolute top-32 right-16 w-40 h-40 opacity-[0.04]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" className={theme === 'dark' ? 'text-tblue-300' : 'text-tblue-600'}/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className={theme === 'dark' ? 'text-tblue-300' : 'text-tblue-600'}/>
          <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" className={theme === 'dark' ? 'text-tblue-300' : 'text-tblue-600'}/>
        </svg>
      </div>
      <div className="w-full max-w-xl relative z-10 px-6">
        <div className="text-center mb-8 animate-slide-up">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="eastern-line w-12"></div>
            <span className={`text-[11px] tracking-[0.25em] uppercase font-medium ${theme === 'dark' ? 'text-tblue-300/70' : 'text-tblue-600/70'}`}>
              Join the Network
            </span>
            <div className="eastern-line w-12"></div>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-tblue-500/20">
              <img src="/logo.PNG" alt="SEMAFORI Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <span className={`font-serif font-semibold text-lg tracking-wide ${theme === 'dark' ? 'text-white' : 'text-navy-800'}`}>SEMAFORI</span>
              <span className={`block text-[8px] tracking-[0.2em] uppercase ${theme === 'dark' ? 'text-tblue-300/60' : 'text-tblue-600/60'}`}>Smart Traffic</span>
            </div>
          </div>
          <h1 className={`font-serif text-3xl lg:text-4xl font-bold leading-[1.1] tracking-tight mb-4 ${theme === 'dark' ? 'text-white' : 'text-navy-900'}`}>
            Create Your Account
          </h1>
          <p className={`text-sm leading-relaxed max-w-sm mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Join the intelligent traffic management revolution and help shape the future of urban mobility.
          </p>
        </div>

        <div className={`rounded-2xl border p-8 shadow-2xl backdrop-blur-xl animate-fade-in ${theme === 'dark'
          ? 'bg-navy-800/50 border-navy-600/20'
          : 'bg-white/80 border-gray-200'}`} style={{animationDelay:'0.3s', animationFillMode:'both'}}>
          {serverError && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 ${theme === 'dark' ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'}`}>
              <p className={`mb-2 ${theme === 'dark' ? 'text-red-200' : 'text-red-700'}`}>{serverError}</p>
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => {} })}
                className={`text-sm underline ${theme === 'dark' ? 'text-red-300 hover:text-red-200' : 'text-red-700 hover:text-red-900'}`}
              >
                {copy.tryAgain}
              </button>
            </div>
          )}

          {successMessage && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 ${theme === 'dark' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
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
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-tblue-500 hover:bg-tblue-600 text-white text-sm font-medium px-6 py-3.5 shadow-lg shadow-tblue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-tblue-500/25 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {copy.signupCreatingAccount}
                </>
              ) : (
                <>
                  <iconify-icon icon="lucide:user-plus" width="16"></iconify-icon>
                  {copy.signupButton}
                </>
              )}
            </button>
          </form>

          <div className={`mt-8 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            <p>
              {copy.signupAlreadyHaveAccount}{' '}
              <Link to="/login" className={`font-medium transition hover:text-tblue-400 ${theme === 'dark' ? 'text-tblue-300' : 'text-tblue-600'}`}>
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

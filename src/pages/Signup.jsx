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
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one letter and one number';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
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
      setSuccessMessage('🎉 Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-md w-full animate-slide-up">
        {/* Header kreativ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl shadow-xl mb-4 transform -rotate-3 hover:rotate-0 transition">
            <span className="text-4xl">✨</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Join the Journey
          </h2>
          <p className="mt-2 text-gray-400">Create an account to get started</p>
        </div>

        {/* Kartela e formës */}
        <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-gray-700/50 transition-all duration-300 hover:shadow-xl">
          {serverError && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 border-l-8 border-red-500 text-red-400 flex items-center">
              <span className="text-2xl mr-2">⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-green-900/30 border-l-8 border-green-500 text-green-400 flex items-center">
              <span className="text-2xl mr-2">🎉</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="👤 Full Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
              autoComplete="name"
              className="w-full px-4 py-2 rounded-xl border-2 border-white/50 bg-white/80 focus:bg-white focus:border-indigo-500 transition-all outline-none"
            />

            <Input
              label="📧 Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
              className="w-full px-4 py-2 rounded-xl border-2 border-white/50 bg-white/80 focus:bg-white focus:border-indigo-500 transition-all outline-none"
            />

            <Input
              label="🔒 Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-xl border-2 border-white/50 bg-white/80 focus:bg-white focus:border-indigo-500 transition-all outline-none"
            />

            <Input
              label="✅ Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-xl border-2 border-white/50 bg-white/80 focus:bg-white focus:border-indigo-500 transition-all outline-none"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-full shadow-md hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </>
              ) : (
                <>🌟 Sign Up</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-indigo-400 hover:text-indigo-300 transition">
                Sign in ✨
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
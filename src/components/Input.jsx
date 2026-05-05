import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Input = ({ 
  label, 
  type = 'text', 
  name, 
  value, 
  onChange, 
  error, 
  required = false,
  autoComplete = 'off',
  ...props 
}) => {
  const { theme } = useTheme();
  const labelClass = theme === 'light' ? 'text-slate-700' : 'text-gray-300';
  const inputBg = theme === 'light'
    ? 'bg-white text-slate-900 border-slate-300 placeholder-slate-500'
    : 'bg-slate-700/60 text-white placeholder-gray-400 border-gray-600';
  const errorClass = theme === 'light'
    ? 'border-red-400 bg-red-50 text-slate-900'
    : 'border-red-500 bg-red-900/30 text-white';
  const hoverClass = theme === 'light' ? 'hover:border-slate-400' : 'hover:border-gray-500';

  return (
    <div className="mb-4">
      <label 
        htmlFor={name} 
        className={`block text-sm font-medium mb-1 ${labelClass}`}
      >
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className={`
          w-full px-4 py-2 border rounded-lg transition-all duration-200
          ${inputBg}
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          ${error ? errorClass : hoverClass}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;

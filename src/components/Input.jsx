import React from 'react';

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
  return (
    <div className="mb-4">
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-300 mb-1"
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
          bg-gray-700/60 text-white placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          ${error ? 'border-red-500 bg-red-900/30' : 'border-gray-600 hover:border-gray-500'}
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
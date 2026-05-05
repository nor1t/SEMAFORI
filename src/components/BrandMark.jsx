import React from 'react';

const BrandMark = ({ className = 'h-20 w-20', innerClassName = 'h-16 w-16', roundedClassName = 'rounded-3xl' }) => {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/20 ${className} ${roundedClassName}`}>
      <div className={`grid grid-cols-3 gap-1 ${innerClassName}`}>
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-slate-950" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-white/90" />
        <div className="rounded-full bg-slate-950" />
      </div>
    </div>
  );
};

export default BrandMark;

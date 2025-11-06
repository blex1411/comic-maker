
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="py-6 px-8 text-center border-b border-slate-800/50">
      <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 font-ames">
        Comic Craft AI
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Hidupkan ceritamu dengan karakter konsisten dan seni buatan AI.
      </p>
    </header>
  );
};
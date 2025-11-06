
import React from 'react';

interface LoadingSpinnerProps {
    message: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 bg-transparent rounded-lg">
      <div className="w-12 h-12 border-4 border-slate-700 border-t-pink-500 rounded-full animate-spin"></div>
      <p className="text-slate-300 font-medium text-center">{message}</p>
    </div>
  );
};
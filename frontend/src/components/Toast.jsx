import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, Sparkles } from 'lucide-react';
import { playSound } from '../utils/audio';

export default function Toast({ message, type = 'error', onClose, duration = 4000 }) {
  useEffect(() => {
    playSound(type === 'success' ? 'badge' : 'click', true);
    if (duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose, type]);

  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <div className={`fixed top-5 right-5 z-50 flex max-w-md items-center space-x-3.5 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-bounce-short font-sans text-xs ${
      isError 
        ? 'border-rose-200 bg-rose-50/95 text-rose-950 shadow-rose-500/10' 
        : isSuccess 
        ? 'border-emerald-200 bg-emerald-50/95 text-emerald-950 shadow-emerald-500/10' 
        : 'border-indigo-200 bg-indigo-50/95 text-indigo-950 shadow-indigo-500/10'
    }`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
        isError 
          ? 'bg-rose-100 text-rose-600 border border-rose-200' 
          : isSuccess 
          ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
          : 'bg-indigo-100 text-indigo-600 border border-indigo-200'
      }`}>
        {isError ? <AlertTriangle className="h-5 w-5" /> : isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </div>

      <div className="flex-1 pr-2">
        <div className={`font-black uppercase tracking-wider text-[10px] ${
          isError ? 'text-rose-700' : isSuccess ? 'text-emerald-700' : 'text-indigo-700'
        }`}>
          {isError ? 'System Alert' : isSuccess ? 'Action Approved' : 'DevRank Notification'}
        </div>
        <p className="mt-0.5 font-bold text-slate-800 leading-snug">{message}</p>
      </div>

      <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

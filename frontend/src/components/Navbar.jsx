import React from 'react';
import { ShieldCheck, Volume2, VolumeX, LogOut, Code2, Building2, Sparkles, Trophy } from 'lucide-react';
import { playSound } from '../utils/audio';

export default function Navbar({ activeRole, currentUser, recruiterUser, onViewLeaderboard, onLogout, soundEnabled, setSoundEnabled }) {
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) playSound('click', true);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl font-sans shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-md shadow-indigo-500/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight text-slate-900">Dev<span className="text-indigo-600">Rank</span></span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 border border-indigo-200 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> VERIFIED
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              {activeRole === 'candidate' ? 'Student Arena Dashboard' : 'HR Recruiter Sourcing Hub'}
            </p>
          </div>
        </div>

        {/* Active Session & Leaderboard Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => { playSound('click', soundEnabled); onViewLeaderboard(); }}
            className="flex items-center space-x-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition shadow-sm"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Global Leaderboard</span>
          </button>

          <div className="hidden sm:flex items-center space-x-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold">
            {activeRole === 'candidate' ? (
              <span className="flex items-center space-x-1.5 text-indigo-600">
                <Code2 className="h-4 w-4" />
                <span>Student: {currentUser?.name} ({currentUser?.totalXp || 0} XP)</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-emerald-600">
                <Building2 className="h-4 w-4" />
                <span>Recruiter: {recruiterUser?.companyName || 'Verified Company'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Controls: Sound & Logout */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Mute Sound FX" : "Unmute Sound FX"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-indigo-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>

          <button
            onClick={() => { onLogout(); playSound('click', soundEnabled); }}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}

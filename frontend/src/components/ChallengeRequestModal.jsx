import React, { useState } from 'react';
import { X, Swords, CheckCircle2, ShieldCheck, Clock, Loader2, Sparkles, Hourglass } from 'lucide-react';
import { playSound } from '../utils/audio';
import { create1v1ChallengeRequest } from '../services/api';

export default function ChallengeRequestModal({ isOpen, onClose, currentUser, opponent, soundEnabled, showToast }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'submitted'

  if (!isOpen || !opponent) return null;

  const handleSendChallenge = async () => {
    playSound('click', soundEnabled);
    setStatus('submitting');

    const res = await create1v1ChallengeRequest(
      currentUser?.githubUsername || 'candidate',
      opponent?.githubUsername
    );

    if (res.success) {
      setStatus('submitted');
      playSound('badge', soundEnabled);
      if (showToast) showToast(`1v1 Battle request sent to Admin Approval Queue!`, 'success');
    } else {
      setStatus('idle');
      if (showToast) showToast(`Failed to submit challenge: ${res.error}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-md rounded-3xl border border-indigo-200 bg-white p-6 shadow-2xl text-slate-900 text-center">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-200 shadow-sm">
          <Swords className="h-9 w-9" />
        </div>

        <h2 className="text-xl font-black text-slate-900">1v1 Developer Battle Request</h2>
        <p className="text-xs text-slate-500 mt-1">Challenge @{opponent.githubUsername} on the Global Leaderboard!</p>

        {/* Opponent Profile Card */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center space-x-4 text-left">
          <img
            src={opponent.avatar || `https://github.com/${opponent.githubUsername}.png`}
            alt={opponent.name}
            className="h-14 w-14 rounded-2xl object-cover ring-2 ring-indigo-500/20 shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">{opponent.name}</h3>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                {opponent.totalXp} XP
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">@{opponent.githubUsername}</p>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5">{opponent.targetRole || 'Software Engineer'}</p>
          </div>
        </div>

        {/* Challenge Action States */}
        {status === 'idle' && (
          <button
            onClick={handleSendChallenge}
            className="mt-6 w-full flex items-center justify-center space-x-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-indigo-700 transition"
          >
            <Swords className="h-5 w-5" />
            <span>Send Challenge Request to Admin Queue</span>
          </button>
        )}

        {status === 'submitting' && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-center space-x-2 text-amber-700 font-bold text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <span>Saving challenge request to Supabase...</span>
          </div>
        )}

        {status === 'submitted' && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-3 text-left">
            <div className="flex items-center space-x-2 text-indigo-900 font-black text-sm">
              <Hourglass className="h-5 w-5 text-indigo-600" />
              <span>Challenge Submitted to Admin Queue!</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Your 1v1 battle request against <strong>@{opponent.githubUsername}</strong> has been stored in Supabase.
            </p>
            <div className="rounded-xl border border-indigo-200 bg-white p-3 text-[11px] text-slate-600 font-semibold">
              📌 <strong>Next Step:</strong> Admin will review the request in the Admin Panel, select the code question, and launch the match live for both of you!
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

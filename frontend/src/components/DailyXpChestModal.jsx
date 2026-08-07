import React, { useState } from 'react';
import { X, Gift, Sparkles, Trophy, Award, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSound } from '../utils/audio';

export default function DailyXpChestModal({ isOpen, onClose, onAwardXp, soundEnabled }) {
  const [claimed, setClaimed] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  if (!isOpen) return null;

  const handleOpenChest = () => {
    playSound('badge', soundEnabled);
    // Random XP strictly between 1 and 10 XP
    const reward = Math.floor(Math.random() * 10) + 1;
    setBonusAmount(reward);
    setClaimed(true);
    onAwardXp(reward);

    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-md rounded-3xl border border-indigo-200 bg-white p-6 shadow-2xl shadow-indigo-500/10 text-slate-900 text-center">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-3 shadow-inner">
          <Gift className="h-9 w-9" />
        </div>

        <h2 className="text-xl font-black text-slate-900">Daily Developer Luck Chest</h2>
        <p className="text-xs text-slate-500 mt-1">Claim your daily surprise XP bonus & climb the global leaderboard!</p>

        {!claimed ? (
          <div className="mt-6">
            <button
              onClick={handleOpenChest}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition"
            >
              <Sparkles className="h-5 w-5" />
              <span>Unlock Mystery Chest</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-2">
            <div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>+{bonusAmount} DevRank XP Claimed!</span>
            </div>
            <p className="text-xs text-slate-600">Come back tomorrow for your next daily developer reward!</p>
            <button
              onClick={onClose}
              className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Awesome!
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

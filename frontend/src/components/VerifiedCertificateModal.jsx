import React, { useEffect } from 'react';
import { X, ShieldCheck, Sparkles, Share2, Download, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSound } from '../utils/audio';

export default function VerifiedCertificateModal({ isOpen, onClose, currentUser, soundEnabled }) {
  useEffect(() => {
    if (isOpen) {
      playSound('badge', soundEnabled);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}
    }
  }, [isOpen]);

  // Handle ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const handleShare = () => {
    playSound('click', soundEnabled);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`Check out my verified DevRank Score (${currentUser.totalXp} XP) and live code proof! https://devrank.io/verify/${currentUser.githubUsername || 'candidate'}`);
      alert('Verified Certificate share link copied to clipboard!');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      {/* Modal Container (stop click propagation) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 sm:p-8 shadow-2xl shadow-cyan-500/20 text-slate-100 my-auto"
      >
        
        {/* Prominent High-Visibility Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex items-center space-x-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-extrabold text-rose-300 hover:bg-rose-900/60 transition shadow-lg z-10"
        >
          <X className="h-4 w-4" />
          <span>Close</span>
        </button>

        {/* Certificate Card Body */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600"></div>

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-xl shadow-cyan-500/30">
            <ShieldCheck className="h-9 w-9 text-white" />
          </div>

          <div className="mt-4 flex items-center justify-center space-x-1.5 text-xs font-bold text-cyan-400 tracking-widest uppercase">
            <Sparkles className="h-3.5 w-3.5" /> DevRank Verified Developer Certificate
          </div>

          <h1 className="mt-2 text-2xl font-black tracking-tight text-white">{currentUser.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{currentUser.targetRole || 'Full Stack Engineer'}</p>

          <div className="my-6 inline-flex flex-col items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-950/40 px-6 py-3">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">DevRank Total Score</span>
            <span className="text-4xl font-extrabold bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {currentUser.totalXp} XP
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 mt-0.5">Verified Live Code Proof Badge</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-4 text-xs font-mono text-slate-300">
            <div className="rounded-xl bg-slate-900/80 p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400">Resume ATS</div>
              <div className="font-bold text-cyan-400">{currentUser.resumeXp || 0} XP</div>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400">GitHub Proof</div>
              <div className="font-bold text-blue-400">{currentUser.githubXp || 0} XP</div>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400">LeetCode Solved</div>
              <div className="font-bold text-purple-400">{currentUser.leetcodeXp || 0} XP</div>
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleShare}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 transition"
          >
            <Share2 className="h-4 w-4" />
            <span>Copy LinkedIn Share Link</span>
          </button>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:from-cyan-400 hover:to-blue-500 transition"
            >
              <Download className="h-4 w-4" />
              <span>Print Certificate</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

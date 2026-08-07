import React, { useState } from 'react';
import { X, Swords, Trophy, Sparkles, Award } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { playSound } from '../utils/audio';

export default function HeadToHeadBattleModal({ isOpen, onClose, candidates, soundEnabled }) {
  const [candidateA, setCandidateA] = useState(candidates[0] || null);
  const [candidateB, setCandidateB] = useState(candidates[1] || candidates[0] || null);

  if (!isOpen || !candidateA || !candidateB) return null;

  const comparisonData = [
    { subject: 'Total XP', A: (candidateA.totalXp / 1000) * 100, B: (candidateB.totalXp / 1000) * 100 },
    { subject: 'LeetCode', A: (candidateA.leetcodeXp / 300) * 100, B: (candidateB.leetcodeXp / 300) * 100 },
    { subject: 'GitHub Proof', A: (candidateA.githubXp / 300) * 100, B: (candidateB.githubXp / 300) * 100 },
    { subject: 'Resume ATS', A: (candidateA.resumeXp / 400) * 100, B: (candidateB.resumeXp / 400) * 100 },
    { subject: 'Repo Quality', A: candidateA.repoQualityScore || 90, B: candidateB.repoQualityScore || 90 }
  ];

  const winner = candidateA.totalXp > candidateB.totalXp ? candidateA : candidateB;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-4xl rounded-2xl border border-emerald-500/30 bg-slate-950 p-6 shadow-2xl shadow-emerald-500/10 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                Dev vs Dev Head-to-Head Battle Mode
              </h2>
              <p className="text-xs text-slate-400">Side-by-side verification & comparative skill radar</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Candidate Selectors */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <label className="text-xs font-bold text-cyan-400 uppercase">Candidate A</label>
            <select
              value={candidateA.id}
              onChange={(e) => { setCandidateA(candidates.find(c => c.id === e.target.value)); playSound('click', soundEnabled); }}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs font-bold text-white focus:outline-none"
            >
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name} ({c.totalXp} XP)</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3">
            <label className="text-xs font-bold text-purple-400 uppercase">Candidate B</label>
            <select
              value={candidateB.id}
              onChange={(e) => { setCandidateB(candidates.find(c => c.id === e.target.value)); playSound('click', soundEnabled); }}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs font-bold text-white focus:outline-none"
            >
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name} ({c.totalXp} XP)</option>)}
            </select>
          </div>
        </div>

        {/* Comparative Radar Chart */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* Candidate A Card */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-4 text-center">
            <img src={candidateA.avatar} alt={candidateA.name} className="h-16 w-16 rounded-xl mx-auto object-cover ring-2 ring-cyan-500/50" />
            <h3 className="mt-2 text-sm font-bold text-white">{candidateA.name}</h3>
            <div className="text-xl font-black text-cyan-400 mt-1">{candidateA.totalXp} XP</div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <div>LeetCode: <strong className="text-white">{candidateA.leetcodeXp} XP</strong></div>
              <div>GitHub Stars: <strong className="text-white">{candidateA.githubStats.stars}</strong></div>
              <div>Resume Match: <strong className="text-white">{candidateA.resumeXp} XP</strong></div>
            </div>
          </div>

          {/* Center Radar Chart */}
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={comparisonData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} stroke="#475569" />
                <Radar name={candidateA.name} dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                <Radar name={candidateB.name} dataKey="B" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Candidate B Card */}
          <div className="rounded-2xl border border-purple-500/30 bg-slate-900/60 p-4 text-center">
            <img src={candidateB.avatar} alt={candidateB.name} className="h-16 w-16 rounded-xl mx-auto object-cover ring-2 ring-purple-500/50" />
            <h3 className="mt-2 text-sm font-bold text-white">{candidateB.name}</h3>
            <div className="text-xl font-black text-purple-400 mt-1">{candidateB.totalXp} XP</div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <div>LeetCode: <strong className="text-white">{candidateB.leetcodeXp} XP</strong></div>
              <div>GitHub Stars: <strong className="text-white">{candidateB.githubStats.stars}</strong></div>
              <div>Resume Match: <strong className="text-white">{candidateB.resumeXp} XP</strong></div>
            </div>
          </div>

        </div>

        {/* Winner Banner */}
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-center flex items-center justify-center space-x-2 text-xs font-bold text-emerald-400">
          <Trophy className="h-4 w-4" />
          <span>DevRank Automated Verdict: <strong>{winner.name}</strong> leads by +{Math.abs(candidateA.totalXp - candidateB.totalXp)} XP!</span>
        </div>

      </div>
    </div>
  );
}

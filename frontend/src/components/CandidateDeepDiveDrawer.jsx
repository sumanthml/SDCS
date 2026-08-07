import React, { useState } from 'react';
import { X, ExternalLink, ShieldCheck, Star, GitBranch, Calendar, Mail, Award, CheckCircle2, Sparkles, Trophy, Zap, Medal } from 'lucide-react';
import { scheduleInterview, updateCandidateInSupabase } from '../services/api';
import { playSound } from '../utils/audio';
import confetti from 'canvas-confetti';

export default function CandidateDeepDiveDrawer({ candidate, liveBattles = [], isOpen, onClose, soundEnabled, showToast }) {
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [awardedBadge, setAwardedBadge] = useState(candidate?.hrBadge || null);

  if (!isOpen || !candidate) return null;

  const handleScheduleInterview = async () => {
    playSound('click', soundEnabled);
    setScheduling(true);
    const res = await scheduleInterview({
      candidateName: candidate.name,
      companyName: 'TechCorp / Sourcing Hub',
      jobTitle: candidate.targetRole || 'Senior Engineer',
      date: '2026-08-18',
      time: '14:00'
    });
    setInviteData(res);
    setScheduling(false);
    setScheduled(true);
    playSound('success', soundEnabled);
  };

  const handleAwardHRBadge = async (badgeName) => {
    playSound('badge', soundEnabled);
    setAwardedBadge(badgeName);
    try { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch {}
    await updateCandidateInSupabase(candidate.githubUsername, { hr_badge: badgeName });
    if (showToast) showToast(`Awarded "${badgeName}" to @${candidate.githubUsername}!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm font-sans">
      <div className="relative w-full max-w-2xl border-l border-slate-200 bg-white p-6 text-slate-900 shadow-2xl flex flex-col h-full overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-4">
            <img
              src={candidate.avatar || `https://github.com/${candidate.githubUsername}.png`}
              alt={candidate.name}
              className="h-14 w-14 rounded-2xl object-cover ring-2 ring-emerald-500/20 shadow-sm"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-900">{candidate.name}</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                  {candidate.totalXp} XP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{candidate.targetRole} • Global Rank #{candidate.globalRank || 1}</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* HR Special Award Action Bar */}
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-emerald-600" /> HR Endorsement & Special Kudos
            </span>
            {awardedBadge && (
              <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black shadow-sm">
                Active: {awardedBadge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 font-medium">Award an official HR endorsement badge to highlight this candidate on the platform!</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => handleAwardHRBadge('🏆 HR Top Pick')}
              className="flex items-center space-x-1 rounded-xl bg-white border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>HR Top Pick</span>
            </button>
            <button
              onClick={() => handleAwardHRBadge('⚡ Fast Track Pass')}
              className="flex items-center space-x-1 rounded-xl bg-white border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-indigo-800 hover:bg-indigo-50 transition shadow-sm"
            >
              <Zap className="h-3.5 w-3.5 text-indigo-600" />
              <span>Fast Track Pass</span>
            </button>
            <button
              onClick={() => handleAwardHRBadge('🌟 Gold Code Proof')}
              className="flex items-center space-x-1 rounded-xl bg-white border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-purple-800 hover:bg-purple-50 transition shadow-sm"
            >
              <Medal className="h-3.5 w-3.5 text-purple-600" />
              <span>Gold Code Proof</span>
            </button>
          </div>
        </div>

        {/* Candidate Stats Snapshot */}
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] text-slate-500 font-bold">Public Repos</div>
            <div className="text-base font-black text-slate-900 mt-0.5">{candidate.githubStats?.publicRepos || 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] text-slate-500 font-bold">LeetCode Solved</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">{candidate.leetcodeStats?.total || 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] text-slate-500 font-bold">Resume ATS</div>
            <div className="text-base font-black text-purple-700 mt-0.5">{candidate.resumeXp || 0} XP</div>
          </div>
        </div>

        {/* 1v1 Battle Activity & Match History Log */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">1v1 Speed Arena Battle History & Activity</h3>
          {(() => {
            const candGh = (candidate.githubUsername || '').toLowerCase();
            const candBattles = (liveBattles || []).filter(b => 
              (b.p1Gh || b.challenger_username)?.toLowerCase() === candGh || 
              (b.p2Gh || b.opponent_username)?.toLowerCase() === candGh
            );

            if (candBattles.length === 0) {
              return (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400 font-medium">
                  No 1v1 battle matches logged yet for @{candidate.githubUsername}.
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {candBattles.map(b => {
                  const p1 = b.p1 || b.challenger_username;
                  const p2 = b.p2 || b.opponent_username;
                  const isWinner = b.winner?.toLowerCase() === candGh;

                  return (
                    <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs font-sans">
                      <div>
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>@{p1}</span>
                          <span className="text-rose-600 font-black text-[10px]">VS</span>
                          <span>@{p2}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.title}</p>
                      </div>

                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                        b.status?.includes('COMPLETED') || b.winner
                          ? isWinner
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                          : b.status?.includes('LIVE')
                          ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {b.winner ? `🏆 Winner: @${b.winner}` : b.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Schedule Fast Track Interview */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Instant Recruiter Outreach</h3>
          {scheduled ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-xs text-emerald-800">
              <div className="flex items-center space-x-2 font-black text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Interview Invite Sent to {candidate.name}!</span>
              </div>
              <p className="font-medium text-slate-700">Calendar invite sent to candidate & HR calendar synchronized.</p>
            </div>
          ) : (
            <button
              onClick={handleScheduleInterview}
              disabled={scheduling}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-60"
            >
              <Calendar className="h-4 w-4" />
              <span>{scheduling ? 'Dispatching Interview Invite...' : `Schedule Interview Invite for ${candidate.name}`}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

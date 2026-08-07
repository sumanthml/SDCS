import React, { useState } from 'react';
import { Trophy, ShieldCheck, Search, Flame, Star, Award, Code2, ArrowLeft, Swords } from 'lucide-react';
import { playSound } from '../utils/audio';
import LiveBattleSpectatorFeed from './LiveBattleSpectatorFeed';

export default function LeaderboardPage({ candidates, currentUser, liveBattles = [], onBack, onChallengeCandidate, soundEnabled }) {
  const [search, setSearch] = useState('');
  const [filterStack, setFilterStack] = useState('All');

  const STACKS = ['All', 'React', 'Node.js', 'TypeScript', 'Java', 'Python', 'C++', 'SQL'];

  // Filter candidates strictly by registered list
  const filtered = candidates.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.githubUsername || '').toLowerCase().includes(search.toLowerCase());
    const matchesStack = filterStack === 'All' || (c.skills || []).some(s => s.toLowerCase().includes(filterStack.toLowerCase()));
    return matchesSearch && matchesStack;
  }).sort((a, b) => b.totalXp - a.totalXp);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8 font-sans bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => { playSound('click', soundEnabled); onBack(); }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Global Verified Leaderboard <Trophy className="h-6 w-6 text-amber-500" />
            </h1>
            <p className="text-xs text-slate-500">Rankings determined 100% by live verified GitHub code proof, LeetCode ratings, and ATS resume match.</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name or GitHub..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Live 1v1 Spectator Arena Feed */}
      <LiveBattleSpectatorFeed battles={liveBattles} soundEnabled={soundEnabled} />

      {/* Stack Badges Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {STACKS.map(s => (
          <button
            key={s}
            onClick={() => { setFilterStack(s); playSound('click', soundEnabled); }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filterStack === s
                ? 'bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Trophy className="h-10 w-10 text-slate-400 mx-auto" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">No Registered Candidates Found</h3>
          <p className="text-xs text-slate-500 mt-1">Be the first candidate to complete onboarding and claim rank #1!</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">DevRank XP</th>
                <th className="px-6 py-4">Resume ATS</th>
                <th className="px-6 py-4">GitHub Proof</th>
                <th className="px-6 py-4">LeetCode</th>
                <th className="px-6 py-4">1v1 Battle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c, idx) => {
                const rank = idx + 1;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                return (
                  <tr key={c.id || idx} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs ${
                        isTop1 ? 'bg-amber-100 text-amber-700 border border-amber-300 font-extrabold' :
                        isTop2 ? 'bg-slate-200 text-slate-800' :
                        isTop3 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        #{rank}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img src={c.avatar || `https://github.com/${c.githubUsername}.png`} alt={c.name} className="h-10 w-10 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-sm" />
                        <div>
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            {c.name}
                            {isTop1 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">Podium Leader</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">@{c.githubUsername}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-black text-sm text-indigo-600">{c.totalXp} XP</div>
                      <div className="text-[10px] text-slate-400">Verified Score</div>
                    </td>

                    <td className="px-6 py-4 font-mono text-purple-600 font-bold">
                      {c.resumeXp || 0} XP
                    </td>

                    <td className="px-6 py-4 font-mono text-sky-600 font-bold">
                      {c.githubXp || 0} XP ({c.githubStats?.publicRepos || 0} Repos)
                    </td>

                    <td className="px-6 py-4 font-mono text-emerald-600 font-bold">
                      {c.leetcodeXp || 0} XP ({c.leetcodeStats?.total || 0} Solved)
                    </td>

                    <td className="px-6 py-4">
                      {(() => {
                        const isSelf = (c.githubUsername || '').toLowerCase() === (currentUser?.githubUsername || '').toLowerCase();
                        if (isSelf) {
                          return (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 border border-indigo-200">
                              Your Profile
                            </span>
                          );
                        }

                        const match = (liveBattles || []).find(b =>
                          (b.p1Gh || b.challenger_username)?.toLowerCase() === c.githubUsername?.toLowerCase() ||
                          (b.p2Gh || b.opponent_username)?.toLowerCase() === c.githubUsername?.toLowerCase()
                        );

                        if (match) {
                          const isApproved = match.status?.includes('LIVE') || match.status === 'approved_active';
                          return (
                            <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold border ${
                              isApproved
                                ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {isApproved ? '🔴 In 1v1 Battle' : '⏳ Challenge Pending'}
                            </span>
                          );
                        }

                        return (
                          <button
                            onClick={() => {
                              playSound('click', soundEnabled);
                              if (onChallengeCandidate) onChallengeCandidate(c);
                            }}
                            className="flex items-center space-x-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                          >
                            <Swords className="h-3.5 w-3.5" />
                            <span>Challenge 1v1</span>
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

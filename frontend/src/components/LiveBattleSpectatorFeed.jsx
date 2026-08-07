import React, { useState } from 'react';
import { Swords, Eye, Trophy, Flame, PlayCircle, CheckCircle2, User, Zap } from 'lucide-react';
import { playSound } from '../utils/audio';

export default function LiveBattleSpectatorFeed({ battles = [], currentUser, onEnterArena, soundEnabled }) {
  const [selectedSpectate, setSelectedSpectate] = useState(null);

  if (!battles || battles.length === 0) return null;

  return (
    <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Swords className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              🔥 1v1 Speed Arena Spectator Feed
              <span className="animate-pulse rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200">
                LIVE ARENA
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Watch live 1v1 coding duels between verified candidates in real-time</p>
          </div>
        </div>
      </div>

      {/* Battles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {battles.map((b) => {
          const userGh = (currentUser?.githubUsername || '').toLowerCase();
          const isParticipant = userGh && (b.p1Gh?.toLowerCase() === userGh || b.p2Gh?.toLowerCase() === userGh);
          const opponentGh = b.p1Gh?.toLowerCase() === userGh ? b.p2Gh : b.p1Gh;
          const opponentName = b.p1Gh?.toLowerCase() === userGh ? b.p2 : b.p1;

          return (
            <div
              key={b.id}
              className={`relative rounded-2xl border p-4 shadow-sm transition flex flex-col justify-between ${
                isParticipant
                  ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50/80 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {b.title}
                  </span>
                  <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
                    b.status.includes('LIVE')
                      ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {b.status}
                  </span>
                </div>

                {/* Matchup */}
                <div className="flex items-center justify-between text-xs my-3 font-bold text-slate-900">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                      {b.p1[0]}
                    </div>
                    <div>
                      <span className="block font-extrabold text-slate-900 text-xs">{b.p1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">@{b.p1Gh}</span>
                    </div>
                  </div>

                  <span className="text-xs font-black text-rose-600 px-2">VS</span>

                  <div className="flex items-center space-x-2 text-right">
                    <div>
                      <span className="block font-extrabold text-slate-900 text-xs">{b.p2}</span>
                      <span className="text-[10px] text-slate-400 font-mono">@{b.p2Gh}</span>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                      {b.p2[0]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">{b.time}</span>

                {isParticipant ? (
                  <button
                    onClick={() => {
                      playSound('click', soundEnabled);
                      if (onEnterArena) onEnterArena(b);
                    }}
                    className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-[11px] font-extrabold text-white shadow-md hover:bg-indigo-700 transition animate-bounce"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Enter Your Battle Arena</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      playSound('click', soundEnabled);
                      setSelectedSpectate(b);
                    }}
                    className="flex items-center space-x-1 rounded-xl bg-indigo-600 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Spectate Match</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spectate Modal Overlay */}
      {selectedSpectate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md font-sans">
          <div className="relative w-full max-w-lg rounded-3xl border border-indigo-200 bg-white p-6 shadow-2xl text-slate-900 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Flame className="h-5 w-5 text-rose-600" />
                <h3 className="text-base font-black text-slate-900">Spectating Live 1v1 Battle</h3>
              </div>
              <button onClick={() => setSelectedSpectate(null)} className="text-xs font-bold text-slate-400 hover:text-slate-700">✕ Close</button>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2 text-xs">
              <div className="font-extrabold text-indigo-900 text-sm">{selectedSpectate.title}</div>
              <div className="flex justify-between text-slate-700 font-bold">
                <span>{selectedSpectate.p1} (@{selectedSpectate.p1Gh})</span>
                <span className="text-rose-600 font-black">VS</span>
                <span>{selectedSpectate.p2} (@{selectedSpectate.p2Gh})</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-emerald-400 font-mono text-xs space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold">// Realtime Code Stream</div>
              <div>function solveMatch(nums, target) &#123;</div>
              <div className="pl-4 text-slate-200">// Player 1 typed: const map = new Map();</div>
              <div className="pl-4 text-slate-200">// Player 2 typed: for (let i = 0; i &lt; nums.length; i++)</div>
              <div className="text-amber-400 animate-pulse">// Running test cases on sandbox runtime...</div>
              <div>&#125;</div>
            </div>

            <button
              onClick={() => setSelectedSpectate(null)}
              className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-indigo-700 transition"
            >
              Done Spectating
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

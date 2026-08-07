import React, { useState } from 'react';
import {
  Building2, Search, Filter, Sliders, Swords, PlusCircle, ShieldCheck, Star, ExternalLink,
  ChevronRight, Sparkles, CheckCircle2, UserCheck, Mail, Flame, AlertCircle, RefreshCw
} from 'lucide-react';
import CandidateDeepDiveDrawer from './CandidateDeepDiveDrawer';
import HeadToHeadBattleModal from './HeadToHeadBattleModal';
import CreateJobDropModal from './CreateJobDropModal';
import LiveBattleSpectatorFeed from './LiveBattleSpectatorFeed';
import { playSound } from '../utils/audio';
import { computeSkillScore, updateSkillScores } from '../services/api';

export default function RecruiterDashboard({
  candidates, jobDrops, setJobDrops, liveBattles = [], soundEnabled, showToast
}) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedStack, setSelectedStack] = useState('All');
  const [minLeetCode, setMinLeetCode]     = useState(0);
  const [minRepos, setMinRepos]           = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [battleOpen, setBattleOpen]       = useState(false);
  const [createDropOpen, setCreateDropOpen] = useState(false);
  const [shortlisted, setShortlisted]     = useState([]);
  const [skillScores, setSkillScores]     = useState({});
  const [computingSkill, setComputingSkill] = useState(false);

  const STACKS = ['All', 'React', 'Node.js', 'TypeScript', 'Java', 'Python', 'C++', 'SQL', 'Rust'];

  // When HR picks a skill filter, compute Gemini skill scores for all visible candidates
  const handleStackChange = async (stack) => {
    setSelectedStack(stack);
    playSound('click', soundEnabled);
    if (stack === 'All') { setSkillScores({}); return; }
    setComputingSkill(true);
    const initScores = {};
    candidates.forEach(c => { initScores[c.githubUsername] = { score: null, loading: true }; });
    setSkillScores({ ...initScores });
    await Promise.all(candidates.map(async (c) => {
      if (c.skillScores?.[stack] !== undefined) {
        setSkillScores(prev => ({ ...prev, [c.githubUsername]: { score: c.skillScores[stack], loading: false } }));
        return;
      }
      const profile = c.extractedProfile || { skills: c.skills || [], projects: [] };
      const score = await computeSkillScore(profile, stack);
      const newScore = score ?? 0;
      setSkillScores(prev => ({ ...prev, [c.githubUsername]: { score: newScore, loading: false } }));
      updateSkillScores(c.githubUsername, { ...(c.skillScores || {}), [stack]: newScore });
    }));
    setComputingSkill(false);
  };

  // Filter candidate pool dynamically with null-checks
  const filteredCandidates = candidates.filter(c => {
    const candidateName = (c.name || '').toLowerCase();
    const candidateGh = (c.githubUsername || '').toLowerCase();
    const matchesSearch = candidateName.includes(searchQuery.toLowerCase()) || candidateGh.includes(searchQuery.toLowerCase());
    const matchesStack = selectedStack === 'All' || (c.skills || []).some(s => s.toLowerCase().includes(selectedStack.toLowerCase()));
    const matchesLeetCode = (c.leetcodeStats?.total || 0) >= minLeetCode;
    const matchesRepos = (c.githubStats?.publicRepos || 0) >= minRepos;
    return matchesSearch && matchesStack && matchesLeetCode && matchesRepos;
  });

  const handleToggleShortlist = (candidateId, e) => {
    e.stopPropagation();
    playSound('click', soundEnabled);
    if (shortlisted.includes(candidateId)) {
      setShortlisted(prev => prev.filter(id => id !== candidateId));
      if (showToast) showToast('Candidate removed from shortlist', 'info');
    } else {
      setShortlisted(prev => [...prev, candidateId]);
      playSound('success', soundEnabled);
      if (showToast) showToast('Candidate shortlisted!', 'success');
    }
  };

  const handleOpenDeepDive = (candidate) => {
    playSound('click', soundEnabled);
    setSelectedCandidate(candidate);
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8 font-sans bg-slate-50 min-h-screen">
      
      {/* 1. Recruiter Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900">HR Talent Sourcing Hub</h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                VERIFIED POOL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Source verified candidates backed by real GitHub code proof & LeetCode ratings.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setBattleOpen(true); playSound('click', soundEnabled); }}
              className="flex items-center space-x-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-sm"
            >
              <Swords className="h-4 w-4" />
              <span>Dev vs Dev Battle Mode</span>
            </button>

            <button
              onClick={() => { setCreateDropOpen(true); playSound('click', soundEnabled); }}
              className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Post New Job Drop</span>
            </button>

            <button
              onClick={() => {
                setShortlisted([]);
                if (showToast) showToast('HR shortlist & session data cleared.', 'info');
              }}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset HR Data</span>
            </button>
          </div>
        </div>

        {/* Live Activity Feed Ticker */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
          <div className="animate-ticker text-slate-700 font-mono space-x-8">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
              <Flame className="h-3.5 w-3.5 fill-current" /> Live REST API Verification active
            </span>
            <span className="inline-flex items-center gap-1.5 text-indigo-700 font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Groq AI Technical Interviewer & Resume Assistant
            </span>
            <span className="inline-flex items-center gap-1.5 text-purple-700 font-bold">
              <Sparkles className="h-3.5 w-3.5" /> Supabase Realtime Sourcing Connected
            </span>
          </div>
        </div>
      </div>

      {/* Live 1v1 Arena Spectator Feed for HR */}
      <LiveBattleSpectatorFeed battles={liveBattles} soundEnabled={soundEnabled} />

      {/* 2. Sourcing Control & Filter Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by candidate name or GitHub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {STACKS.map(stack => (
              <button
                key={stack}
                onClick={() => handleStackChange(stack)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  selectedStack === stack
                    ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {stack}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>Min LeetCode Solved Threshold</span>
              <span className="text-emerald-700 font-extrabold">{minLeetCode}+ Solved</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              value={minLeetCode}
              onChange={(e) => setMinLeetCode(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>Min Public Repositories</span>
              <span className="text-indigo-700 font-extrabold">{minRepos}+ Repos</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={minRepos}
              onChange={(e) => setMinRepos(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. Candidate Talent Pool Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            Verified Talent Pool <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">{filteredCandidates.length} Candidates</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">Click candidate to open technical deep-dive drawer</span>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="mt-3 text-sm font-bold text-slate-900">No Candidates Match Sourcing Filters</h3>
            <p className="text-xs text-slate-500 mt-1">Try lowering the LeetCode or Public Repo threshold sliders above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => {
              const isShortlisted = shortlisted.includes(candidate.id || candidate.githubUsername);
              return (
                <div
                  key={candidate.id || candidate.githubUsername}
                  onClick={() => handleOpenDeepDive(candidate)}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={candidate.avatar || `https://github.com/${candidate.githubUsername}.png`}
                          alt={candidate.name}
                          className="h-12 w-12 rounded-2xl object-cover ring-2 ring-emerald-500/20 shadow-sm"
                        />
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">{candidate.name || candidate.githubUsername}</h3>
                          <p className="text-xs text-emerald-700 font-semibold">{candidate.targetRole || 'Software Engineer'}</p>
                          <p className="text-[11px] text-slate-400 font-mono">@{candidate.githubUsername}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleToggleShortlist(candidate.id || candidate.githubUsername, e)}
                        className={`rounded-xl p-2 transition ${
                          isShortlisted
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-700'
                        }`}
                        title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 inline-flex items-center justify-between w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <span className="text-xs font-bold text-slate-700">DevRank Score</span>
                      <span className="text-lg font-black text-emerald-700">{candidate.totalXp} XP</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">Resume ATS</div>
                        <div className="font-extrabold text-purple-700 mt-0.5">{candidate.resumeXp || 0} XP</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">GitHub Repos</div>
                        <div className="font-extrabold text-sky-700 mt-0.5">{candidate.githubStats?.publicRepos || 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">LeetCode</div>
                        <div className="font-extrabold text-emerald-700 mt-0.5">{candidate.leetcodeStats?.total || 0} Solved</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(candidate.skills || []).slice(0, 5).map(s => (
                        <span key={s} className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>Inspect Code Proof & GitHub Repos</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <CandidateDeepDiveDrawer
        candidate={selectedCandidate}
        liveBattles={liveBattles}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        soundEnabled={soundEnabled}
        showToast={showToast}
      />

      <HeadToHeadBattleModal
        candidates={candidates}
        isOpen={battleOpen}
        onClose={() => setBattleOpen(false)}
        soundEnabled={soundEnabled}
      />

      <CreateJobDropModal
        isOpen={createDropOpen}
        onClose={() => setCreateDropOpen(false)}
        onSaveJobDrop={(newDrop) => {
          setJobDrops(prev => [newDrop, ...prev]);
          if (showToast) showToast(`Job drop published for ${newDrop.title}!`, 'success');
        }}
        soundEnabled={soundEnabled}
      />

    </div>
  );
}

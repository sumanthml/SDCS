import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Plus, Trash2, Eye, EyeOff, Edit2, Users, Trophy, Zap,
  Clock, Tag, CheckCircle2, AlertCircle, Loader2, BarChart3, LogOut, Swords, Award, UserX, PlusCircle
} from 'lucide-react';
import {
  loadActiveChallenges, createChallenge, updateChallenge, deleteChallenge,
  getChallengeStats, loadAllCandidatesFromSupabase, deleteCandidateFromSupabase,
  loadPendingBattlesFromSupabase, approve1v1BattleByAdmin
} from '../services/api';

const ADMIN_EMAIL = 'admin@devrank.io';
const ADMIN_PASS  = 'devrank2024';

const DIFFICULTY_COLORS = {
  easy:   { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  medium: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200' },
  hard:   { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200' },
};
const XP_BY_DIFF = { easy: 5, medium: 8, hard: 15 };
const TIME_OPTS   = [
  { label: '1 minute',   value: 60  },
  { label: '3 minutes',  value: 180 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '15 minutes', value: 900 },
];

export default function AdminPanel({ onLogout, onAddLiveBattle, showToast }) {
  const [loggedIn, setLoggedIn]     = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass,  setLoginPass]  = useState('');
  const [loginErr,   setLoginErr]   = useState('');

  const [tab, setTab]               = useState('challenges'); // 'challenges' | 'pending_1v1' | '1v1' | 'candidates'
  const [challenges, setChallenges] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [pendingBattles, setPendingBattles] = useState([]);
  const [stats, setStats]           = useState([]);
  const [loading, setLoading]       = useState(false);

  // Challenge form
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [form, setForm]             = useState({
    title: '', description: '', difficulty: 'easy', timeLimitSeconds: 300, tags: ''
  });

  // 1v1 Battle Form (Between 2 Selected Candidates)
  const [player1, setPlayer1]       = useState('');
  const [player2, setPlayer2]       = useState('');
  const [battleTitle, setBattleTitle] = useState('1v1 Speed Code Arena Match');
  const [battleProblem, setBattleProblem] = useState('Given an array of integers, find two numbers such that they add up to a specific target.');
  const [battleSuccess, setBattleSuccess] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
  }, [loggedIn]);

  const loadData = async () => {
    setLoading(true);
    const [ch, ca, pb, st] = await Promise.all([
      loadActiveChallenges(),
      loadAllCandidatesFromSupabase(),
      loadPendingBattlesFromSupabase(),
      getChallengeStats(),
    ]);
    setChallenges(ch);
    setCandidates(ca);
    setPendingBattles(pb);
    setStats(st);
    if (ca.length >= 2) {
      setPlayer1(ca[0]?.githubUsername || '');
      setPlayer2(ca[1]?.githubUsername || '');
    }
    setLoading(false);
  };

  const handleApprovePendingBattle = async (battle, selectedChallenge) => {
    const res = await approve1v1BattleByAdmin(battle.id, {
      title: selectedChallenge?.title || 'Official Admin 1v1 Speed Battle',
      problemStatement: selectedChallenge?.description || 'Given an array of integers, solve the problem in record time.',
      starterCode: `function solveChallenge(input) {\n  // Starter code for ${selectedChallenge?.title || '1v1 Match'}\n  return true;\n}`
    });

    if (res.success) {
      if (showToast) showToast(`✅ Approved 1v1 match between @${battle.challenger_username} & @${battle.opponent_username}! Question: "${selectedChallenge?.title || 'Official Battle'}"`, 'success');
      loadData();
    } else {
      if (showToast) showToast(`Approval error: ${res.error}`, 'error');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginErr('');
    if (loginEmail.trim() === ADMIN_EMAIL && loginPass === ADMIN_PASS) {
      setLoggedIn(true);
    } else {
      setLoginErr('Invalid admin credentials. Use admin@devrank.io / devrank2024');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.title.trim() || !form.description.trim()) return setFormErr('Title and description are required.');
    setSaving(true);
    const result = await createChallenge({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (result.success) {
      setShowForm(false);
      setForm({ title: '', description: '', difficulty: 'easy', timeLimitSeconds: 300, tags: '' });
      loadData();
    } else {
      setFormErr(result.error || 'Failed to create challenge.');
    }
  };

  const handleCreate1v1Battle = (e) => {
    e.preventDefault();
    if (!player1 || !player2 || player1 === player2) {
      if (showToast) showToast('Please select two different candidates for the 1v1 battle match.', 'error');
      return;
    }
    setBattleSuccess(true);

    const c1 = candidates.find(c => c.githubUsername === player1);
    const c2 = candidates.find(c => c.githubUsername === player2);

    const adminBattle = {
      id: Date.now(),
      p1: c1?.name || player1,
      p1Gh: player1,
      p2: c2?.name || player2,
      p2Gh: player2,
      title: battleTitle || 'Admin Official 1v1 Speed Battle',
      difficulty: 'Hard (+50 XP)',
      status: 'LIVE 🔴',
      time: 'Just now'
    };

    if (onAddLiveBattle) onAddLiveBattle(adminBattle);

    setTimeout(() => setBattleSuccess(false), 4000);
  };

  const handleToggleActive = async (ch) => {
    await updateChallenge(ch.id, { is_active: !ch.is_active });
    loadData();
  };

  const handleDeleteChallenge = async (id) => {
    if (!window.confirm('Delete this challenge?')) return;
    await deleteChallenge(id);
    loadData();
  };

  const handleDeleteCandidate = async (ghUsername) => {
    if (!window.confirm(`Delete candidate @${ghUsername} permanently from Supabase?`)) return;
    await deleteCandidateFromSupabase(ghUsername);
    loadData();
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">DevRank Admin</div>
              <div className="text-xs text-slate-500 font-medium">Control Panel & 1v1 Match Maker</div>
            </div>
          </div>

          {loginErr && (
            <div className="mb-4 flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600" /><span>{loginErr}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700">Admin Email</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@devrank.io"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="devrank2024"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <button type="submit"
              className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-md">
              Enter Admin Portal
            </button>
          </form>
          {onLogout && (
            <button onClick={onLogout} className="w-full mt-4 text-xs font-bold text-slate-500 hover:text-slate-900 transition">
              ← Back to Main App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-black text-slate-900">DevRank</span>
            <span className="ml-2 text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">ADMIN CONTROL</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-xs text-slate-500 font-mono">admin@devrank.io</div>
          {onLogout && (
            <button onClick={onLogout} className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm">
              <LogOut className="h-3.5 w-3.5" /><span>Exit</span>
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users, label: 'Registered Candidates', value: candidates.length, color: 'indigo' },
            { icon: Swords, label: 'Active Coding Challenges', value: challenges.filter(c => c.is_active).length, color: 'emerald' },
            { icon: Trophy, label: 'Submissions Recorded', value: stats.length, color: 'amber' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-${color}-50 text-${color}-600 border border-${color}-200 mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-black text-slate-900">{value}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 rounded-2xl bg-white p-1.5 border border-slate-200 shadow-sm w-fit flex-wrap gap-1">
          {[
            ['challenges', 'Coding Challenges', Zap],
            ['pending_1v1', `Pending 1v1 Approvals (${pendingBattles.length})`, Clock],
            ['1v1', 'Deploy 1v1 Battle Match', Swords],
            ['candidates', 'Candidate Directory', Users]
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" /><span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── PENDING 1V1 APPROVALS TAB ────────────────────────────────────── */}
        {tab === 'pending_1v1' && (
          <div className="rounded-3xl border border-indigo-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" /> Pending 1v1 Challenge Requests Queue ({pendingBattles.length})
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">Review real-time challenge requests submitted by candidates. Select the code question and click Approve to launch the match live.</p>
            </div>

            {pendingBattles.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500 font-semibold">
                No pending 1v1 challenge requests awaiting approval right now.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBattles.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-black border border-amber-200">
                          Pending Admin Approval
                        </span>
                        <span className="text-xs text-slate-400 font-mono">ID: {b.id.slice(0, 8)}</span>
                      </div>
                      <div className="mt-2 text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <span className="text-indigo-600">@{b.challenger_username}</span>
                        <span className="text-rose-600 font-black text-xs">CHALLENGED</span>
                        <span className="text-purple-600">@{b.opponent_username}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                      <select
                        id={`ch_select_${b.id}`}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                      >
                        {challenges.map(ch => (
                          <option key={ch.id} value={ch.id}>
                            {ch.title} (+{ch.xp_reward} XP)
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          const selVal = document.getElementById(`ch_select_${b.id}`)?.value;
                          const selCh = challenges.find(c => c.id === selVal) || challenges[0];
                          handleApprovePendingBattle(b, selCh);
                        }}
                        className="flex items-center justify-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 transition"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve & Assign Code Question</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed Battle History & Declared Winners */}
            <div className="mt-8 border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Completed Battle History & Declared Winners
              </h3>
              {(() => {
                const completedList = (pendingBattles || []).filter(b => b.status === 'completed' || b.winner_username);
                if (completedList.length === 0) {
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 font-medium">
                      No completed battle matches logged in history yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {completedList.map(b => (
                      <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-extrabold text-slate-900">
                            @{b.challenger_username} <span className="text-rose-600 font-black">VS</span> @{b.opponent_username}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{b.title}</p>
                        </div>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200">
                          🏆 Winner: @{b.winner_username}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── 1. CHALLENGES TAB ─────────────────────────────────────────────── */}
        {tab === 'challenges' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Global Coding Challenges</h2>
              <button onClick={() => setShowForm(v => !v)}
                className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm">
                <Plus className="h-4 w-4" /><span>Create New Challenge</span>
              </button>
            </div>

            {/* Create Form */}
            {showForm && (
              <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-md space-y-4">
                <h3 className="text-sm font-bold text-slate-900">New Coding Challenge</h3>
                {formErr && (
                  <div className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600" /><span>{formErr}</span>
                  </div>
                )}
                <form onSubmit={handleCreateChallenge} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Challenge Title *</label>
                    <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                      placeholder="e.g. Two Sum Problem"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Problem Description / Question *</label>
                    <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                      rows={4} placeholder="Write full problem statement, constraints, and test inputs."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none resize-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Difficulty</label>
                      <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
                        <option value="easy">Easy (+5 XP)</option>
                        <option value="medium">Medium (+8 XP)</option>
                        <option value="hard">Hard (+15 XP)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Time Limit</label>
                      <select value={form.timeLimitSeconds} onChange={e => setForm({...form, timeLimitSeconds: Number(e.target.value)})}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
                        {TIME_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">XP Reward</label>
                      <div className="mt-1 w-full rounded-xl border border-slate-200 bg-indigo-50 p-3 text-sm font-extrabold text-indigo-700">
                        +{XP_BY_DIFF[form.difficulty]} XP
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-2">
                    <button type="submit" disabled={saving}
                      className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span>{saving ? 'Publishing...' : 'Publish Challenge'}</span>
                    </button>
                    <button type="button" onClick={() => { setShowForm(false); setFormErr(''); }}
                      className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List */}
            {challenges.map(ch => (
              <div key={ch.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{ch.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{ch.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 border border-indigo-200">+{ch.xp_reward} XP</span>
                  <button onClick={() => handleDeleteChallenge(ch.id)} className="rounded-xl p-2 text-rose-600 hover:bg-rose-50 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 2. TARGETED 1V1 BATTLE CREATOR ──────────────────────────────── */}
        {tab === '1v1' && (
          <div className="rounded-3xl border border-indigo-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Swords className="h-5 w-5 text-indigo-600" /> Targeted 1v1 Battle Creator (Between 2 Candidates)
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">Select two specific candidates from the directory to pit them in an official Admin 1v1 Speed Battle.</p>
            </div>

            {battleSuccess && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center space-x-3 text-xs text-emerald-800 font-extrabold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>1v1 Battle Match created successfully! Match invitation dispatched to both candidates over Realtime sockets.</span>
              </div>
            )}

            <form onSubmit={handleCreate1v1Battle} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="text-xs font-extrabold text-indigo-700 flex items-center gap-1.5 mb-2">
                    <Users className="h-4 w-4" /> Candidate 1 (Player 1)
                  </label>
                  <select
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {candidates.map(c => (
                      <option key={c.githubUsername} value={c.githubUsername}>
                        {c.name} (@{c.githubUsername}) — {c.totalXp} XP
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="text-xs font-extrabold text-purple-700 flex items-center gap-1.5 mb-2">
                    <Users className="h-4 w-4" /> Candidate 2 (Player 2)
                  </label>
                  <select
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {candidates.map(c => (
                      <option key={c.githubUsername} value={c.githubUsername}>
                        {c.name} (@{c.githubUsername}) — {c.totalXp} XP
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">1v1 Battle Match Title</label>
                <input
                  type="text"
                  value={battleTitle}
                  onChange={(e) => setBattleTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Problem Statement for Both Players</label>
                <textarea
                  rows={3}
                  value={battleProblem}
                  onChange={(e) => setBattleProblem(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 font-semibold focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Swords className="h-4 w-4" />
                <span>Deploy 1v1 Battle Between Selected Candidates</span>
              </button>
            </form>
          </div>
        )}

        {/* ── 3. CANDIDATES DIRECTORY ───────────────────────────────────────── */}
        {tab === 'candidates' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-slate-900">Candidate Directory ({candidates.length})</h2>
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    {['Candidate', 'GitHub', 'Total XP', 'LeetCode', 'Resume ATS', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-extrabold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <tr key={c.githubUsername} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {c.name} <span className="block text-[10px] text-slate-500 font-normal">{c.targetRole}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-600 font-bold">@{c.githubUsername}</td>
                      <td className="px-4 py-3 font-black text-emerald-700">{c.totalXp} XP</td>
                      <td className="px-4 py-3 text-slate-600 font-semibold">{c.leetcodeStats?.total || 0} Solved</td>
                      <td className="px-4 py-3 text-purple-700 font-semibold">{c.resumeXp || 0} XP</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteCandidate(c.githubUsername)}
                          className="rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition flex items-center gap-1"
                        >
                          <UserX className="h-3 w-3" /> Delete Row
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

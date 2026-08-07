import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Zap, Award, Sparkles, RefreshCw, Upload, FileText, Code2, Bot, ExternalLink,
  Star, Flame, CheckCircle2, Trophy, BarChart3, Lock, Edit3, Linkedin, AlertCircle, Clock, Tag, Gift, Swords
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import SpeedCodingArenaModal from './SpeedCodingArenaModal';
import AiInterviewDrawer from './AiInterviewDrawer';
import AtsResumeBuilderModal from './AtsResumeBuilderModal';
import VerifiedCertificateModal from './VerifiedCertificateModal';
import ChallengeModal from './ChallengeModal';
import DailyXpChestModal from './DailyXpChestModal';
import LiveBattleSpectatorFeed from './LiveBattleSpectatorFeed';
import {
  fetchLiveGitHubStats, fetchLiveLeetCodeStats, fetchGitHubContributions,
  computeGitHubXp, computeLeetCodeXp, computeResumeXp, computeResumeXpFromScore,
  computeTotalXp, extractStructuredProfile,
  subscribeToChallenges, getSubmissionsForUser, saveProfileToSupabase, deleteCandidateFromSupabase,
  validateLinkedIn
} from '../services/api';
import { playSound } from '../utils/audio';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import confetti from 'canvas-confetti';

export default function CandidateDashboard({
  currentUser, setCurrentUser, candidates, jobDrops, liveBattles = [], soundEnabled, onOpenProfileModal, onDeleteAccount, showToast
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dailyChestOpen, setDailyChestOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState([]);

  // Challenges state
  const [challenges, setChallenges]       = useState([]);
  const [submissions, setSubmissions]     = useState([]);
  const [activeChallenge, setActiveChallenge] = useState(null);

  // Real contributions heatmap
  const [contributions, setContributions] = useState(null);

  useEffect(() => {
    const unsub = subscribeToChallenges(setChallenges);
    if (currentUser?.githubUsername) {
      getSubmissionsForUser(currentUser.githubUsername).then(setSubmissions);
      // Fetch real contribution data
      if (!currentUser.contributionsData?.contributions?.length) {
        fetchGitHubContributions(currentUser.githubUsername).then(data => {
          if (data) setContributions(data);
        });
      } else {
        setContributions(currentUser.contributionsData);
      }
    }
    return unsub;
  }, [currentUser?.githubUsername]);

  // Skills radar — all values from REAL user data (no fake defaults, no cap since XP is unlimited)
  const maxGhXp = Math.max(currentUser?.githubXp || 0, 100);
  const maxLcXp = Math.max(currentUser?.leetcodeXp || 0, 200);
  const radarData = [
    { subject: 'Problem Solving', A: Math.min(100, Math.round(((currentUser?.leetcodeXp || 0) / maxLcXp) * 100)), fullMark: 100 },
    { subject: 'Code Proof',      A: Math.min(100, Math.round(((currentUser?.githubXp   || 0) / maxGhXp) * 100)), fullMark: 100 },
    { subject: 'ATS Match',       A: Math.min(100, currentUser?.atsScore || 0),                                   fullMark: 100 },
    { subject: 'Interview XP',    A: Math.min(100, (currentUser?.interviewXp || 0) * 10),                        fullMark: 100 },
    { subject: 'Challenges',      A: Math.min(100, (currentUser?.challengeXp || 0) * 4),                         fullMark: 100 },
  ];

  const handleSyncStats = async () => {
    playSound('click', soundEnabled);
    setIsSyncing(true);
    const [ghStats, contribs] = await Promise.all([
      fetchLiveGitHubStats(currentUser.githubUsername),
      fetchGitHubContributions(currentUser.githubUsername),
    ]);
    if (ghStats.error) { if (showToast) showToast(ghStats.error, 'error'); }
    if (contribs) setContributions(contribs);
    let lcStats = { easy: 0, medium: 0, hard: 0, total: 0, contestRating: 0, error: null };
    if (currentUser.leetcodeUsername) {
      lcStats = await fetchLiveLeetCodeStats(currentUser.leetcodeUsername);
    }
    const githubXp   = computeGitHubXp(ghStats, contribs);
    const leetcodeXp = computeLeetCodeXp(lcStats);
    const totalXp    = computeTotalXp(currentUser.resumeXp || 0, githubXp, leetcodeXp, currentUser.interviewXp || 0, currentUser.challengeXp || 0);
    const updated = { ...currentUser, totalXp, githubXp, leetcodeXp, githubStats: ghStats, leetcodeStats: lcStats, contributionsData: contribs || {} };
    setCurrentUser(updated);
    saveProfileToSupabase(updated);
    setIsSyncing(false);
    playSound('levelup', soundEnabled);
    try { confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } }); } catch {}
    if (showToast) showToast('Live GitHub & LeetCode APIs Synced!', 'success');
  };

  const handleDirectResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsAnalyzingResume(true);
    if (showToast) showToast('Extracting resume text & analyzing with Gemini AI...', 'info');

    try {
      const pdfText = await extractTextFromPdfFile(file);
      if (!pdfText || pdfText.length < 10) {
        if (showToast) showToast('Could not extract text from file. Please try another PDF.', 'error');
        setIsAnalyzingResume(false);
        return;
      }

      const role = currentUser.targetRole || 'Software Engineer';
      const geminiResult = await extractStructuredProfile(pdfText, role);

      let atsScore = 0;
      let resumeXp = 0;
      let extractedProfile = {};
      let skills = currentUser.skills || [];

      if (geminiResult) {
        atsScore = geminiResult.ats_score || 0;
        resumeXp = computeResumeXpFromScore(atsScore);
        extractedProfile = geminiResult;
        skills = Array.from(new Set([...skills, ...(geminiResult.skills || [])]));
      } else {
        resumeXp = computeResumeXp(pdfText, role);
      }

      const totalXp = computeTotalXp(resumeXp, currentUser.githubXp || 0, currentUser.leetcodeXp || 0, currentUser.interviewXp || 0, currentUser.challengeXp || 0);

      const updated = {
        ...currentUser,
        atsScore,
        resumeXp,
        totalXp,
        extractedProfile,
        skills,
      };

      setCurrentUser(updated);
      saveProfileToSupabase(updated);
      playSound('levelup', soundEnabled);
      try { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch {}
      if (showToast) showToast(`Resume Verified! Gemini ATS Score: ${atsScore}/100 (+${resumeXp} XP)`, 'success');
    } catch (err) {
      console.error('Direct resume upload error:', err);
      if (showToast) showToast('Failed to analyze resume.', 'error');
    } finally {
      setIsAnalyzingResume(false);
    }
  };

  const handleAwardXp = (amount) => {
    setCurrentUser(prev => {
      // Update both totalXp AND interviewXp so it persists through login recalculation
      const updated = {
        ...prev,
        totalXp: (prev.totalXp || 0) + amount,
        interviewXp: (prev.interviewXp || 0) + amount,
      };
      saveProfileToSupabase(updated);
      return updated;
    });
    if (showToast) showToast(`+${amount} XP Earned!`, 'success');
  };

  const handleChallengeXpEarned = (amount) => {
    setCurrentUser(prev => {
      const newChallengeXp = (prev.challengeXp || 0) + amount;
      const newTotalXp = (prev.totalXp || 0) + amount; // No cap — XP is unlimited
      const updated = { ...prev, challengeXp: newChallengeXp, totalXp: newTotalXp };
      saveProfileToSupabase(updated); // ✅ Persist challenge XP to Supabase
      return updated;
    });
    getSubmissionsForUser(currentUser.githubUsername).then(setSubmissions);
    if (showToast) showToast(`+${amount} XP Earned from Challenge!`, 'success');
  };

  const handleApplyJob = (job) => {
    playSound('click', soundEnabled);
    if (currentUser.totalXp < job.reqXp) {
      if (showToast) showToast(`Eligibility threshold not met (${job.reqXp} XP required). You have ${currentUser.totalXp} XP.`, 'error');
      return;
    }
    if (appliedJobs.includes(job.id)) return;

    setAppliedJobs(prev => [...prev, job.id]);
    playSound('apply', soundEnabled);
    if (showToast) showToast(`Application submitted to ${job.companyName}!`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8 font-sans">
      
      {/* 1. Student Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 flex-1 min-w-0">
            <div className="relative shrink-0">
              <img
                src={currentUser.avatar || `https://github.com/${currentUser.githubUsername}.png`}
                alt={currentUser.name}
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-indigo-500/20 shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-md">
                #{currentUser.globalRank || 1}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">{currentUser.name}</h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 border border-indigo-200 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> VERIFIED STUDENT
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed max-w-2xl">{currentUser.targetRole} {currentUser.bio ? `• ${currentUser.bio}` : ''}</p>
              
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(currentUser.skills || []).map(s => (
                  <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                    {s}
                  </span>
                ))}

                {currentUser.linkedinUrl && (
                  <a
                    href={currentUser.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Linkedin className="h-3 w-3" /> LinkedIn Profile
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* DevRank Score Counter */}
          <div className="flex flex-col items-center md:items-end">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-center min-w-[220px] shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600">Total DevRank XP</span>
              <div className="mt-1 flex items-baseline justify-center space-x-1">
                <span className="text-4xl font-black text-slate-900">
                  {currentUser.totalXp}
                </span>
                <span className="text-sm font-bold text-slate-500">XP</span>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[10px]">
                <span className="text-sky-600 font-bold">GitHub {currentUser.githubXp || 0}</span>
                <span className="text-violet-600 font-bold">LC {currentUser.leetcodeXp || 0}</span>
                <span className="text-purple-600 font-bold">ATS {currentUser.resumeXp || 0}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center space-x-2 gap-y-2">
              <button
                onClick={onOpenProfileModal}
                className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={handleSyncStats}
                disabled={isSyncing}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Live Stats'}</span>
              </button>

              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center space-x-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-100 transition"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => { setArenaOpen(true); playSound('click', soundEnabled); }}
          className="flex items-center space-x-3 rounded-2xl border border-indigo-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md transition text-left group shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">1v1 Speed Arena</div>
            <div className="text-[10px] text-indigo-600 font-semibold">Leaderboard Battles</div>
          </div>
        </button>

        <button
          onClick={() => { setAiDrawerOpen(true); playSound('click', soundEnabled); }}
          className="flex items-center space-x-3 rounded-2xl border border-purple-200 bg-white p-4 hover:border-purple-400 hover:shadow-md transition text-left group shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">AI Interviewer</div>
            <div className="text-[10px] text-purple-600 font-semibold">Tech Mock Practice</div>
          </div>
        </button>

        <button
          onClick={() => { setAtsModalOpen(true); playSound('click', soundEnabled); }}
          className="flex items-center space-x-3 rounded-2xl border border-sky-200 bg-white p-4 hover:border-sky-400 hover:shadow-md transition text-left group shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:scale-110 transition">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">ATS Resume Builder</div>
            <div className="text-[10px] text-sky-600 font-semibold">Download Resumes</div>
          </div>
        </button>

        <button
          onClick={() => { setCertModalOpen(true); playSound('click', soundEnabled); }}
          className="flex items-center space-x-3 rounded-2xl border border-emerald-200 bg-white p-4 hover:border-emerald-400 hover:shadow-md transition text-left group shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Share Certificate</div>
            <div className="text-[10px] text-emerald-600 font-semibold">LinkedIn Badge</div>
          </div>
        </button>

        <button
          onClick={() => { setDailyChestOpen(true); playSound('click', soundEnabled); }}
          className="flex items-center space-x-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 hover:border-amber-400 hover:shadow-md transition text-left group shadow-sm col-span-2 sm:col-span-1"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 group-hover:scale-110 transition">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Daily XP Chest</div>
            <div className="text-[10px] text-amber-600 font-semibold">Claim Free XP</div>
          </div>
        </button>
      </div>

      {/* 1v1 Battle Tracker & Request Status Banner for Logged-In Candidate */}
      {(() => {
        const userGh = (currentUser?.githubUsername || '').toLowerCase();
        const myBattles = (liveBattles || []).filter(b => 
          b.p1Gh?.toLowerCase() === userGh || b.p2Gh?.toLowerCase() === userGh
        );
        if (myBattles.length === 0) return null;

        return (
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-6 shadow-sm font-sans space-y-4">
            <div className="flex items-center space-x-2 border-b border-indigo-100 pb-3">
              <Swords className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">Your Active 1v1 Battle Center & Request Tracker</h3>
            </div>

            <div className="space-y-3">
              {myBattles.map(b => {
                const opponentGh = b.p1Gh?.toLowerCase() === userGh ? b.p2Gh : b.p1Gh;
                const opponentName = b.p1Gh?.toLowerCase() === userGh ? b.p2 : b.p1;
                const isApproved = b.status?.includes('LIVE') || b.status === 'approved_active';

                return (
                  <div key={b.id} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black text-xs ${
                        isApproved ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isApproved ? '🔴 LIVE' : '⏳ QUEUE'}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          Match: You <span className="text-rose-600 font-black">VS</span> {opponentName} (@{opponentGh})
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {isApproved 
                            ? '✅ Admin Approved! Assigned Coding Question is ready.' 
                            : '⏳ Challenge Request sent to Admin Approval Queue. Waiting for Admin to assign problem code.'}
                        </p>
                      </div>
                    </div>

                    {isApproved ? (
                      <button
                        onClick={() => {
                          playSound('click', soundEnabled);
                          setArenaOpen(true);
                        }}
                        className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-indigo-700 transition animate-bounce"
                      >
                        <Zap className="h-4 w-4" />
                        <span>Enter Coding Arena Now</span>
                      </button>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                        Awaiting Admin Approval
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Live 1v1 Arena Spectator Feed */}
      <LiveBattleSpectatorFeed
        battles={liveBattles}
        currentUser={currentUser}
        onEnterArena={() => setArenaOpen(true)}
        soundEnabled={soundEnabled}
      />

      {/* 2. Main Verified Verification Grid: Cards A, B, C */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card A: LeetCode Verification */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-base font-black text-slate-900 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-amber-500" /> LeetCode Verification
              </span>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold text-violet-700 border border-violet-200">
                {currentUser.leetcodeXp || 0} XP
              </span>
            </div>

            {(!currentUser.leetcodeUsername) ? (
              <div className="mt-8 text-center py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mx-auto mb-2">
                  <Code2 className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">No LeetCode handle connected.</p>
                <p className="text-xs text-slate-500 mt-1">Edit profile to add your LeetCode username.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-700 font-bold mb-1.5">
                    <span>Easy Solved ({currentUser.leetcodeStats?.easy || 0})</span>
                    <span className="text-emerald-700 font-extrabold">+{Math.min(30, (currentUser.leetcodeStats?.easy || 0) * 1)} XP</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((currentUser.leetcodeStats?.easy || 0) / 30) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-700 font-bold mb-1.5">
                    <span>Medium Solved ({currentUser.leetcodeStats?.medium || 0})</span>
                    <span className="text-amber-700 font-extrabold">+{Math.min(90, (currentUser.leetcodeStats?.medium || 0) * 3)} XP</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, ((currentUser.leetcodeStats?.medium || 0) / 30) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-700 font-bold mb-1.5">
                    <span>Hard Solved ({currentUser.leetcodeStats?.hard || 0})</span>
                    <span className="text-rose-700 font-extrabold">+{Math.min(70, (currentUser.leetcodeStats?.hard || 0) * 7)} XP</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, ((currentUser.leetcodeStats?.hard || 0) / 10) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-mono text-slate-700">
            <span>Contest Rating: <strong className="text-indigo-600 font-extrabold">{currentUser.leetcodeStats?.contestRating || 0}</strong></span>
            <span>Total: <strong className="text-slate-900 font-extrabold">{currentUser.leetcodeStats?.total || 0} Solved</strong></span>
          </div>
        </div>

        {/* Card B: GitHub Live Proof */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-base font-black text-slate-900">GitHub Live Proof</span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-700 border border-sky-200">
                {currentUser.githubXp || 0} XP
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-2xl font-black text-slate-900">{currentUser.githubStats?.publicRepos || 0}</div>
                <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">Public Repos</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 fill-current text-amber-500" /> {currentUser.githubStats?.stars || 0}
                </div>
                <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">Total Stars</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-extrabold text-slate-800 mb-2">Live Languages Breakdown</div>
              {(!currentUser.githubStats?.topLanguages || currentUser.githubStats.topLanguages.length === 0) ? (
                <div className="text-xs text-slate-500 font-mono py-2">No public language data found</div>
              ) : (
                <div className="space-y-2">
                  {currentUser.githubStats.topLanguages.map(lang => (
                    <div key={lang.name} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-800 font-bold">{lang.name}</span>
                      <span className="text-indigo-600 font-black">{lang.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-700">
            <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <Flame className="h-4 w-4 fill-current text-emerald-600" /> Verified Account
            </span>
            {currentUser.githubUsername && (
              <a href={`https://github.com/${currentUser.githubUsername}`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <span>View GitHub</span> <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Card C: Resume ATS — Gemini Semantic Score */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-base font-black text-slate-900">AI Resume ATS</span>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-extrabold text-purple-700 border border-purple-200">
                {currentUser.resumeXp || 0} XP earned
              </span>
            </div>

            {/* Gemini ATS Score Meter */}
            {currentUser.atsScore > 0 ? (
              <div className="mt-5">
                <div className="flex items-end justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Semantic ATS Match</span>
                  <span className={`text-2xl font-black ${
                    currentUser.atsScore >= 75 ? 'text-emerald-600' :
                    currentUser.atsScore >= 50 ? 'text-amber-600' : 'text-rose-600'
                  }`}>{currentUser.atsScore}<span className="text-sm text-slate-500">/100</span></span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    currentUser.atsScore >= 75 ? 'bg-emerald-500' :
                    currentUser.atsScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`} style={{ width: `${currentUser.atsScore}%` }} />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600 font-medium">
                  Scored by Gemini AI for: <span className="text-purple-700 font-bold">{currentUser.targetRole}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-xs text-purple-900 font-semibold leading-relaxed">
                Upload resume in Profile to get Gemini semantic ATS score (0–100).
              </div>
            )}

            {/* Extracted Projects from Gemini */}
            {(currentUser.extractedProfile?.projects || []).length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-extrabold text-slate-800 mb-2">AI-Extracted Projects</div>
                <div className="space-y-2">
                  {currentUser.extractedProfile.projects.slice(0, 3).map((p, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <div className="text-xs font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 font-medium">{p.description}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(p.tech || []).map(t => (
                          <span key={t} className="rounded bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Skills */}
            <div className="mt-4">
              <div className="text-xs font-extrabold text-slate-800 mb-2">Detected Skills</div>
              {(!currentUser.skills || currentUser.skills.length === 0) ? (
                <div className="text-xs text-slate-500 font-medium">No skills extracted. Upload PDF resume below.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.skills.map(s => (
                    <span key={s} className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3">
            <input
              type="file"
              accept=".pdf,.txt"
              id="card-c-resume-upload"
              className="hidden"
              onChange={handleDirectResumeUpload}
              disabled={isAnalyzingResume}
            />
            <label
              htmlFor="card-c-resume-upload"
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-purple-600 py-3 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition cursor-pointer disabled:opacity-50"
            >
              {isAnalyzingResume ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Gemini ATS Analyzing Resume...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-white" />
                  <span>Upload Resume PDF → Instant Gemini ATS</span>
                </>
              )}
            </label>
          </div>
        </div>

      </div>

      {/* 3. Skill Radar & Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" /> Candidate Capability Radar Matrix
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="subject" stroke="#334155" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" />
                <Radar name={currentUser.name} dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500 fill-current" /> Real GitHub Contribution Heatmap
            </h3>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
              {contributions?.total?.lastYear ?? 0} commits this year
            </span>
          </div>

          {!contributions?.contributions?.length ? (
            <div className="h-40 flex flex-col items-center justify-center text-center">
              <ExternalLink className="h-8 w-8 text-slate-400" />
              <p className="text-xs text-slate-600 font-medium mt-2">Loading real contribution data from GitHub...</p>
            </div>
          ) : (() => {
            const all = contributions.contributions;
            const weeks = [];
            for (let i = 0; i < all.length; i += 7) {
              weeks.push(all.slice(i, i + 7));
            }
            const lastWeeks = weeks.slice(-24);
            const levelColors = [
              'bg-slate-100',       // 0 commits
              'bg-emerald-200',     // 1-3
              'bg-emerald-400',     // 4-9
              'bg-emerald-600',     // 10-19
              'bg-emerald-700',     // 20+
            ];
            const dayLabels = ['M', '', 'W', '', 'F', '', 'S'];
            return (
              <div className="w-full overflow-x-auto">
                <div className="flex gap-1 min-w-0">
                  <div className="flex flex-col gap-1 mr-1 shrink-0">
                    {dayLabels.map((d, i) => (
                      <div key={i} className="h-3.5 flex items-center text-[9px] text-slate-500 font-bold w-3">{d}</div>
                    ))}
                  </div>
                  {lastWeeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1 flex-1">
                      {Array.from({ length: 7 }).map((_, di) => {
                        const cell = week[di];
                        if (!cell) return <div key={di} className="h-3.5 rounded-sm bg-slate-100" />;
                        return (
                          <div
                            key={di}
                            title={`${cell.date}: ${cell.count} commits`}
                            className={`h-3.5 rounded-sm transition ${levelColors[Math.min(4, cell.level)]}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Last 24 weeks · Real API data · github-contributions-api</span>
                  <div className="flex items-center gap-1">
                    <span>Less</span>
                    {levelColors.map((c, i) => <div key={i} className={`h-2.5 w-2.5 rounded-sm ${c}`} />)}
                    <span>More</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 4. Active Challenges from Admin */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Active Challenges
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs text-amber-400 font-bold">{challenges.length} Live</span>
          </h2>
          <span className="text-xs text-slate-400">Earn 5–15 XP per challenge · real-time from admin</span>
        </div>

        {challenges.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center">
            <Zap className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="mt-2 text-sm font-bold text-white">No Active Challenges Yet</h3>
            <p className="text-xs text-slate-400 mt-1">Admin-posted challenges will appear here in real time with a countdown timer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {challenges.map(ch => {
              const alreadyDone = submissions.some(s => s.challenge_id === ch.id);
              const dc = { easy: { border: 'border-emerald-500/30', badge: 'text-emerald-400 bg-emerald-500/20', btn: 'from-emerald-500 to-teal-600' }, medium: { border: 'border-amber-500/30', badge: 'text-amber-400 bg-amber-500/20', btn: 'from-amber-500 to-orange-600' }, hard: { border: 'border-rose-500/30', badge: 'text-rose-400 bg-rose-500/20', btn: 'from-rose-500 to-pink-600' } }[ch.difficulty] || {};
              return (
                <div key={ch.id} className={`rounded-2xl border ${dc.border} bg-slate-900/60 p-4 flex flex-col justify-between`}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-white leading-tight">{ch.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${dc.badge}`}>{ch.difficulty.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{ch.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{ch.time_limit_seconds / 60} min</span>
                      <span className="flex items-center gap-0.5 font-bold text-amber-400">+{ch.xp_reward} XP</span>
                    </div>
                    {(ch.tags || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ch.tags.map(t => <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { if (!alreadyDone) { setActiveChallenge(ch); playSound('click', soundEnabled); } }}
                    disabled={alreadyDone}
                    className={`mt-4 w-full rounded-xl py-2 text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      alreadyDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : `bg-gradient-to-r ${dc.btn} text-white hover:opacity-90 shadow-md`
                    }`}>
                    {alreadyDone ? <><CheckCircle2 className="h-4 w-4" /><span>Completed</span></> : <><Zap className="h-4 w-4" /><span>Attempt Challenge</span></>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Active Hiring Job Drops */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            Active Hiring Job Drops <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs text-cyan-400 font-bold">{jobDrops.length} Hiring</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">1-Click Apply if DevRank XP threshold met</span>
        </div>

        {jobDrops.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="mt-2 text-sm font-bold text-white">No Active Job Drops Posted Yet</h3>
            <p className="text-xs text-slate-400 mt-1">Recruiter job postings will appear here in real time once posted from the HR Sourcing Hub.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {jobDrops.map(job => {
              const eligible = (currentUser.totalXp || 0) >= job.reqXp;
              const applied = appliedJobs.includes(job.id);

              return (
                <div key={job.id} className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between hover:border-cyan-500/50 transition">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xl font-bold">
                          {job.logo || '🚀'}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{job.title}</h3>
                          <p className="text-xs text-cyan-400 font-medium">{job.companyName} • {job.location}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Salary:</span>
                        <strong className="text-slate-200">{job.salary}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Min DevRank Threshold:</span>
                        <strong className={eligible ? 'text-emerald-400' : 'text-amber-400'}>{job.reqXp} XP</strong>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {(job.skills || []).map(s => (
                        <span key={s} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-800 pt-3">
                    <button
                      onClick={() => handleApplyJob(job)}
                      disabled={applied}
                      className={`w-full rounded-xl py-2 text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        applied
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : eligible
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {applied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Application Submitted</span>
                        </>
                      ) : eligible ? (
                        <>
                          <Zap className="h-4 w-4" />
                          <span>1-Click Apply</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          <span>Locked (Needs {job.reqXp} XP)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Modal */}
      {activeChallenge && (
        <ChallengeModal
          challenge={activeChallenge}
          githubUsername={currentUser.githubUsername}
          onClose={() => setActiveChallenge(null)}
          onXpEarned={handleChallengeXpEarned}
          alreadySubmitted={submissions.some(s => s.challenge_id === activeChallenge.id)}
        />
      )}

      {/* Modals & Drawers */}
      <SpeedCodingArenaModal
        isOpen={arenaOpen}
        onClose={() => setArenaOpen(false)}
        onAwardXp={handleAwardXp}
        soundEnabled={soundEnabled}
      />

      <AiInterviewDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        currentUser={currentUser}
        soundEnabled={soundEnabled}
        onAwardXp={handleAwardXp}
      />

      <AtsResumeBuilderModal
        isOpen={atsModalOpen}
        onClose={() => setAtsModalOpen(false)}
        currentUser={currentUser}
        soundEnabled={soundEnabled}
      />

      <VerifiedCertificateModal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        currentUser={currentUser}
        soundEnabled={soundEnabled}
      />

      {/* Delete Account Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-950 p-6 shadow-2xl shadow-rose-500/20 text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-black text-white">Permanently Delete Account?</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete your profile <strong className="text-white">@{currentUser.githubUsername}</strong>? This action will permanently erase your DevRank score, ATS resume match, and leaderboard position from Supabase.
            </p>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteCandidateFromSupabase(currentUser.githubUsername);
                  setIsDeleting(false);
                  setDeleteConfirmOpen(false);
                  if (onDeleteAccount) onDeleteAccount();
                }}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center space-x-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-50"
              >
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete My Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <DailyXpChestModal
        isOpen={dailyChestOpen}
        onClose={() => setDailyChestOpen(false)}
        onAwardXp={handleAwardXp}
        soundEnabled={soundEnabled}
      />

    </div>
    </div>
  );
}

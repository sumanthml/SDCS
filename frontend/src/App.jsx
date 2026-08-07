import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LandingAuthPage from './components/LandingAuthPage';
import CandidateDashboard from './components/CandidateDashboard';
import RecruiterDashboard from './components/RecruiterDashboard';
import LeaderboardPage from './components/LeaderboardPage';
import StudentProfileModal from './components/StudentProfileModal';
import ChallengeRequestModal from './components/ChallengeRequestModal';
import AdminPanel from './components/AdminPanel';
import Toast from './components/Toast';
import {
  fetchLiveGitHubStats,
  fetchLiveLeetCodeStats,
  fetchGitHubContributions,
  calculateDevRankProfile,
  extractStructuredProfile,
  computeResumeXpFromScore,
  computeGitHubXp,
  computeLeetCodeXp,
  computeResumeXp,
  computeTotalXp,
  saveProfileToSupabase,
  subscribeToJobDrops,
  subscribeToLeaderboard,
  subscribeToChallenges,
  subscribeToBattleMatches,
} from './services/api';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  const [sessionState, setSessionState] = useState(null); // null | 'candidate' | 'recruiter' | 'admin'
  const [viewPage, setViewPage] = useState('dashboard');
  const [candidates, setCandidates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [recruiterUser, setRecruiterUser] = useState(null);
  const [jobDrops, setJobDrops] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [challengeOpponent, setChallengeOpponent] = useState(null);
  const [liveBattles, setLiveBattles] = useState([]);
  const [toast, setToast] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleAddLiveBattle = (battle) => {
    setLiveBattles(prev => [battle, ...prev]);
  };

  // Store Supabase unsubscribe refs
  const unsubJobDrops = useRef(null);
  const unsubLeaderboard = useRef(null);
  const unsubBattles = useRef(null);

  const showToast = (message, type = 'error') => setToast({ message, type });

  // ── On mount: subscribe to Supabase real-time channels ──────────────────────
  useEffect(() => {
    setIsInitializing(true);

    // Real-time job drops from Supabase
    unsubJobDrops.current = subscribeToJobDrops((drops) => {
      setJobDrops(drops);
    });

    // Real-time leaderboard from Supabase
    unsubLeaderboard.current = subscribeToLeaderboard((cands) => {
      setCandidates(cands);
      setIsInitializing(false);
    });

    // Real-time 1v1 battle matches from Supabase & Dual Storage
    unsubBattles.current = subscribeToBattleMatches((battles) => {
      const formatted = (battles || []).map(b => ({
        id: b.id,
        p1: b.challenger_username,
        p1Gh: b.challenger_username,
        p2: b.opponent_username,
        p2Gh: b.opponent_username,
        title: b.title || '1v1 Speed Duel',
        difficulty: b.status === 'completed' ? `🏆 Winner: @${b.winner_username}` : b.status === 'approved_active' ? 'Admin Assigned Code' : 'Awaiting Admin Approval',
        status: b.status === 'completed' ? 'COMPLETED 🏆' : b.status === 'approved_active' ? 'LIVE 🔴' : '⏳ PENDING APPROVAL',
        winner: b.winner_username,
        time: new Date(b.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        problemStatement: b.problem_statement,
        starterCode: b.starter_code
      }));
      setLiveBattles(formatted);
    });

    // Failsafe: stop spinner after 4s even if Supabase is slow
    const timer = setTimeout(() => setIsInitializing(false), 4000);

    return () => {
      if (unsubJobDrops.current) unsubJobDrops.current();
      if (unsubLeaderboard.current) unsubLeaderboard.current();
      if (unsubBattles.current) unsubBattles.current();
      clearTimeout(timer);
    };
  }, []);

  // ── Student login callback (from LandingAuthPage after full API verification) ─
  const handleStudentLogin = (fullProfile) => {
    setCandidates(prev => {
      const filtered = prev.filter(c => c.githubUsername !== fullProfile.githubUsername);
      return [fullProfile, ...filtered];
    });
    setCurrentUser(fullProfile);
    setSessionState('candidate');
    setViewPage('dashboard');
    showToast(`Welcome ${fullProfile.name}! DevRank Score: ${fullProfile.totalXp} / 500 XP`, 'success');
  };

  // ── Recruiter login ────────────────────────────────────────────────────────
  const handleRecruiterLogin = (recruiterDetails) => {
    setRecruiterUser(recruiterDetails);
    setSessionState('recruiter');
    setViewPage('dashboard');
    showToast(`Welcome ${recruiterDetails.recruiterName} at ${recruiterDetails.companyName}!`, 'success');
  };

  // ── Profile edit save (from StudentProfileModal) ───────────────────────────
  const handleSaveProfileEdit = async (formData) => {
    // Step 1: verify GitHub + fetch contributions
    const [ghStats, contribs] = await Promise.all([
      fetchLiveGitHubStats(formData.githubUsername),
      fetchGitHubContributions(formData.githubUsername),
    ]);
    if (ghStats.error) {
      showToast(ghStats.error, 'error');
      return { error: ghStats.error };
    }

    // Step 2: verify LeetCode (optional)
    let lcStats = { easy: 0, medium: 0, hard: 0, total: 0, contestRating: 0, error: null };
    if (formData.leetcodeUsername) {
      lcStats = await fetchLiveLeetCodeStats(formData.leetcodeUsername);
    }

    // Step 3: Build profile
    const base = calculateDevRankProfile({
      name: formData.name || ghStats.name,
      email: formData.email || currentUser?.email || '',
      targetRole: formData.targetRole,
      githubUsername: formData.githubUsername,
      leetcodeUsername: formData.leetcodeUsername,
      linkedinUrl: formData.linkedinUrl,
      bio: formData.bio || ghStats.bio,
      pdfText: formData.pdfText,
    });

    // Step 4: Compute XP math
    const githubXp = computeGitHubXp(ghStats, contribs);
    const leetcodeXp = computeLeetCodeXp(lcStats);

    let resumeXp = currentUser?.resumeXp || 0;
    let atsScore = currentUser?.atsScore || 0;
    let extractedProfile = currentUser?.extractedProfile || {};
    let skills = currentUser?.skills || base.skills || [];

    if (formData.pdfText?.trim()) {
      showToast('Gemini AI analyzing resume ATS score...', 'info');
      const geminiResult = await extractStructuredProfile(formData.pdfText, formData.targetRole || 'Software Engineer');
      if (geminiResult) {
        atsScore = geminiResult.ats_score || 0;
        resumeXp = computeResumeXpFromScore(atsScore);
        extractedProfile = geminiResult;
        skills = geminiResult.skills || skills;
      } else {
        resumeXp = computeResumeXp(formData.pdfText, formData.targetRole + ' ' + formData.bio);
      }
    }

    const totalXp = computeTotalXp(resumeXp, githubXp, leetcodeXp, currentUser?.interviewXp || 0, currentUser?.challengeXp || 0);

    const fullProfile = {
      ...base,
      avatar: ghStats.avatar || currentUser?.avatar || null,
      name: formData.name || ghStats.name,
      bio: formData.bio || ghStats.bio || '',
      githubXp,
      leetcodeXp,
      resumeXp,
      totalXp,
      atsScore,
      extractedProfile,
      skills,
      githubStats: ghStats,
      leetcodeStats: lcStats,
      contributionsData: contribs || {},
    };

    // Step 5: Save to Supabase
    saveProfileToSupabase(fullProfile);

    setCurrentUser(fullProfile);
    setCandidates(prev => {
      const filtered = prev.filter(c => c.githubUsername !== fullProfile.githubUsername);
      return [fullProfile, ...filtered];
    });

    showToast(`Profile updated! DevRank XP: ${totalXp}`, 'success');
    return { success: true };
  };

  const handleDeleteAccount = () => {
    if (currentUser?.githubUsername) {
      setCandidates(prev => prev.filter(c => c.githubUsername !== currentUser.githubUsername));
    }
    setCurrentUser(null);
    setSessionState(null);
    setViewPage('dashboard');
    showToast('Your account and profile data have been permanently erased.', 'info');
  };

  // ── Admin login ───────────────────────────────────────────────────────────
  const handleAdminLogin = () => {
    setSessionState('admin');
  };

  // ── Job Drops managed by RecruiterDashboard directly via Firebase ──────────
  // RecruiterDashboard calls saveJobDropToFirebase → Firestore → subscribeToJobDrops updates setJobDrops

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setSessionState(null);
    setCurrentUser(null);
    setRecruiterUser(null);
    setViewPage('dashboard');
  };

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/30 animate-pulse">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <div className="mt-5 text-sm font-bold tracking-wide text-cyan-400">Connecting to Supabase Cloud...</div>
        <div className="mt-2 text-xs text-slate-500">Loading real-time data from Supabase</div>
      </div>
    );
  }

  // ── Admin Panel ───────────────────────────────────────────────────────────
  if (sessionState === 'admin') {
    return (
      <>
        <AdminPanel onLogout={handleLogout} onAddLiveBattle={handleAddLiveBattle} showToast={showToast} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // ── Landing page (not logged in) ──────────────────────────────────────────
  if (sessionState === null) {
    return (
      <>
        <LandingAuthPage
          onStudentLogin={handleStudentLogin}
          onRecruiterLogin={handleRecruiterLogin}
          onAdminLogin={handleAdminLogin}
          soundEnabled={soundEnabled}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // ── Main App (logged in) ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white font-sans">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Navbar
        activeRole={sessionState}
        currentUser={currentUser}
        recruiterUser={recruiterUser}
        onViewLeaderboard={() => setViewPage(v => v === 'leaderboard' ? 'dashboard' : 'leaderboard')}
        onLogout={handleLogout}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      <main className="flex-1">
        {viewPage === 'leaderboard' ? (
          <LeaderboardPage
            candidates={candidates}
            currentUser={currentUser}
            liveBattles={liveBattles}
            onBack={() => setViewPage('dashboard')}
            onChallengeCandidate={(candidate) => {
              setChallengeOpponent(candidate);
            }}
            soundEnabled={soundEnabled}
          />
        ) : sessionState === 'candidate' ? (
          <CandidateDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            candidates={candidates}
            jobDrops={jobDrops}
            liveBattles={liveBattles}
            soundEnabled={soundEnabled}
            onOpenProfileModal={() => setProfileModalOpen(true)}
            onDeleteAccount={handleDeleteAccount}
            showToast={showToast}
          />
        ) : (
          <RecruiterDashboard
            candidates={candidates}
            jobDrops={jobDrops}
            setJobDrops={setJobDrops}
            liveBattles={liveBattles}
            soundEnabled={soundEnabled}
            showToast={showToast}
          />
        )}
      </main>

      <StudentProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSaveProfile={handleSaveProfileEdit}
        currentUser={currentUser}
        soundEnabled={soundEnabled}
        showToast={showToast}
      />

      <ChallengeRequestModal
        isOpen={Boolean(challengeOpponent)}
        onClose={() => setChallengeOpponent(null)}
        currentUser={currentUser}
        opponent={challengeOpponent}
        onAddLiveBattle={handleAddLiveBattle}
        onStartBattle={(opp) => {
          setChallengeOpponent(null);
          setViewPage('dashboard');
          if (showToast) showToast(`1v1 Battle accepted by @${opp.githubUsername}! Entering Arena...`, 'success');
        }}
        soundEnabled={soundEnabled}
      />

      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-5 text-center text-xs text-slate-400 font-sans">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span className="font-bold text-slate-300">DevRank Platform</span>
            <span>· Verified Developer Sourcing & Gamified Recruitment</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-500">
            <span>GitHub REST API</span><span>·</span>
            <span>LeetCode API</span><span>·</span>
            <span>Google Gemini AI</span><span>·</span>
            <span>Supabase Realtime</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

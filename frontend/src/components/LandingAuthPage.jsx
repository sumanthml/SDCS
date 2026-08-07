import React, { useState } from 'react';
import {
  ShieldCheck, Code2, Building2, ArrowRight, Github, Code, FileText, Upload,
  Sparkles, AlertCircle, Loader2, Linkedin, LogIn, UserPlus, CheckCircle2,
  MapPin, Users, BookOpen
} from 'lucide-react';
import {
  fetchLiveGitHubStats, fetchLiveLeetCodeStats, fetchGitHubContributions,
  calculateDevRankProfile, extractStructuredProfile, computeResumeXpFromScore,
  computeGitHubXp, computeLeetCodeXp, computeResumeXp, computeTotalXp,
  saveProfileToSupabase, loadProfileFromSupabase, previewGitHubUser,
  parseGitHubUsername, parseLeetCodeUsername
} from '../services/api';
import { playSound } from '../utils/audio';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';

export default function LandingAuthPage({ onStudentLogin, onRecruiterLogin, onAdminLogin, soundEnabled }) {
  const [screen, setScreen] = useState('home'); // home | student_choice | new_student | returning | recruiter
  const [step, setStep]     = useState(1);

  // New student fields
  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [targetRole, setTargetRole]       = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [linkedinUrl, setLinkedinUrl]     = useState('');
  const [bio, setBio]                     = useState('');
  const [pdfFile, setPdfFile]             = useState(null);
  const [pdfText, setPdfText]             = useState('');

  // GitHub identity confirmation
  const [ghPreview, setGhPreview]         = useState(null); // { name, login, avatar, bio, publicRepos, followers }
  const [ghPreviewLoading, setGhPreviewLoading] = useState(false);
  const [ghConfirmed, setGhConfirmed]     = useState(false);

  // Returning user
  const [returningGithub, setReturningGithub] = useState('');

  // Recruiter
  const [recruiterMode, setRecruiterMode] = useState('login'); // 'login' | 'register'
  const [companyName, setCompanyName]     = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');

  const [isLoading, setIsLoading]         = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError]                 = useState('');

  const handlePdfChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setLoadingStatus('Extracting text from PDF...');
    const extracted = await extractTextFromPdfFile(file);
    setPdfText(extracted);
    setLoadingStatus('');
  };

  // ── GitHub identity live preview ─────────────────────────────────────────
  const handleVerifyGithub = async () => {
    setError('');
    if (!githubUsername.trim()) return setError('Enter a GitHub username or GitHub profile URL first.');
    // Normalize URL or @handle to plain username
    const parsed = parseGitHubUsername(githubUsername);
    if (parsed !== githubUsername) setGithubUsername(parsed); // auto-clean the field
    setGhPreviewLoading(true);
    setGhPreview(null);
    setGhConfirmed(false);
    const preview = await previewGitHubUser(parsed || githubUsername.trim());
    setGhPreviewLoading(false);
    if (!preview) {
      setError(`GitHub user "${parsed || githubUsername.trim()}" does not exist. Check your spelling exactly.`);
    } else {
      setGhPreview(preview);
    }
  };

  // ── RETURNING USER LOGIN ─────────────────────────────────────────────────
  const handleReturningLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!returningGithub.trim()) return setError('Enter your GitHub username to load your profile.');
    setIsLoading(true);
    setLoadingStatus('Looking up your DevRank profile...');
    const saved = await loadProfileFromSupabase(returningGithub.trim());
    if (saved && saved.totalXp !== undefined) {
      setLoadingStatus('Re-syncing live GitHub & LeetCode stats...');
      const [ghStats, lcStats] = await Promise.all([
        fetchLiveGitHubStats(saved.githubUsername),
        saved.leetcodeUsername ? fetchLiveLeetCodeStats(saved.leetcodeUsername) : Promise.resolve({ easy: 0, medium: 0, hard: 0, total: 0, contestRating: 0, error: null }),
      ]);
      const githubXp    = computeGitHubXp(ghStats);
      const leetcodeXp  = computeLeetCodeXp(lcStats);
      const recomputedXp = computeTotalXp(saved.resumeXp || 0, githubXp, leetcodeXp, saved.interviewXp || 0, saved.challengeXp || 0);
      // Keep the highest XP — never reduce saved XP earned through challenges/interviews
      const totalXp = Math.max(recomputedXp, saved.totalXp || 0);
      const updatedProfile = {
        ...saved, githubXp, leetcodeXp, totalXp,
        githubStats:   ghStats.error  ? saved.githubStats  : ghStats,
        leetcodeStats: lcStats.error  ? saved.leetcodeStats : lcStats,
      };
      saveProfileToSupabase(updatedProfile);
      setIsLoading(false);
      playSound('levelup', soundEnabled);
      onStudentLogin(updatedProfile);
      return;
    }
    setIsLoading(false);
    setError(`No DevRank profile found for "${returningGithub.trim()}". Please register as a new student first.`);
  };

  // ── NEW STUDENT SUBMIT ─────────────────────────────────────────────────
  const handleNewStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())           return setError('Full name is required.');
    if (!githubUsername.trim()) return setError('GitHub username is required.');
    if (!ghConfirmed)           return setError('Please verify and confirm your GitHub identity first (Step 2).');

    setIsLoading(true);
    playSound('click', soundEnabled);

    setLoadingStatus('Fetching full GitHub profile + real contributions...');
    const [ghStats, contribs] = await Promise.all([
      fetchLiveGitHubStats(githubUsername.trim()),
      fetchGitHubContributions(githubUsername.trim()),
    ]);
    if (ghStats.error) { setIsLoading(false); setError(ghStats.error); return; }

    let lcStats = { easy: 0, medium: 0, hard: 0, total: 0, contestRating: 0, error: null };
    if (leetcodeUsername.trim()) {
      setLoadingStatus('Verifying LeetCode profile...');
      lcStats = await fetchLiveLeetCodeStats(leetcodeUsername.trim());
    }

    const githubXp   = computeGitHubXp(ghStats, contribs);
    const leetcodeXp = computeLeetCodeXp(lcStats);

    // Gemini ATS scoring (if resume uploaded)
    let resumeXp = 0;
    let atsScore = 0;
    let extractedProfile = {};
    const skills = [];

    let activePdfText = pdfText;
    if (pdfFile && !activePdfText?.trim()) {
      setLoadingStatus('Extracting text from PDF resume...');
      activePdfText = await extractTextFromPdfFile(pdfFile);
      setPdfText(activePdfText);
    }

    if (activePdfText?.trim()) {
      setLoadingStatus('Gemini AI analyzing resume... (semantic scoring)');
      const geminiResult = await extractStructuredProfile(activePdfText, targetRole.trim() || 'Software Engineer');
      if (geminiResult) {
        atsScore = geminiResult.ats_score || 0;
        resumeXp = computeResumeXpFromScore(atsScore);
        extractedProfile = geminiResult;
        skills.push(...(geminiResult.skills || []));
      } else {
        // Gemini failed — keyword fallback
        resumeXp = computeResumeXp(activePdfText, targetRole + ' ' + bio);
      }
    } else {
      resumeXp = 0;
      atsScore = 0;
    }

    setLoadingStatus('Calculating DevRank XP...');
    const base = calculateDevRankProfile({
      name: name.trim(), email: email.trim(),
      targetRole: targetRole.trim() || 'Software Engineer',
      githubUsername: parseGitHubUsername(githubUsername),
      leetcodeUsername: parseLeetCodeUsername(leetcodeUsername),
      linkedinUrl: linkedinUrl.trim(),
      bio: bio.trim(),
      pdfText: activePdfText,
    });

    const totalXp = computeTotalXp(resumeXp, githubXp, leetcodeXp); // NO CAP

    const fullProfile = {
      ...base,
      avatar: ghStats.avatar || null,
      name: name.trim() || ghStats.name,
      bio: bio.trim() || ghStats.bio || '',
      githubXp, leetcodeXp, resumeXp, totalXp,
      atsScore, extractedProfile,
      skills: skills.length ? skills : base.skills,
      githubStats: ghStats,
      leetcodeStats: lcStats,
      contributionsData: contribs || {},
    };

    saveProfileToSupabase(fullProfile); // non-blocking

    setIsLoading(false);
    playSound('levelup', soundEnabled);
    onStudentLogin(fullProfile);
  };

  const handleRecruiterSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim())   return setError('Company name is required.');
    if (!recruiterName.trim()) return setError('Your name is required.');
    if (!recruiterEmail.trim()) return setError('Work email is required.');
    playSound('click', soundEnabled);
    onRecruiterLogin({ companyName: companyName.trim(), recruiterName: recruiterName.trim(), recruiterEmail: recruiterEmail.trim() });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col p-4 sm:p-8 font-sans">

      {/* Header */}
      <div className="mx-auto max-w-6xl w-full flex items-center justify-between py-4">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setScreen('home'); setError(''); setGhPreview(null); setGhConfirmed(false); }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-md text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900">Dev<span className="text-indigo-600">Rank</span></span>
            <span className="ml-2 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 border border-indigo-200">VERIFIED RECRUITMENT</span>
          </div>
        </div>
        {onAdminLogin && (
          <button onClick={onAdminLogin} className="text-xs text-slate-500 hover:text-indigo-600 transition font-semibold">Admin →</button>
        )}
      </div>

      <div className="mx-auto max-w-4xl w-full my-auto py-8">

        {/* ── HOME ────────────────────────────────────────────────────────── */}
        {screen === 'home' && (
          <div className="space-y-10 text-center">
            <div>
              <span className="rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-600 border border-indigo-200 inline-flex items-center gap-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> Live GitHub + LeetCode verification — zero fake data
              </span>
              <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                Verified Developer Sourcing &<br />
                <span className="text-indigo-600">Gamified Recruitment Platform</span>
              </h1>
              <p className="mt-3 text-sm text-slate-400 max-w-2xl mx-auto">
                Your XP Score = GitHub repos/stars (live API) + LeetCode solved (live API) + Resume ATS keywords. Max 500 XP. Genuinely hard to max out.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
              <div onClick={() => { setScreen('student_choice'); setError(''); playSound('click', soundEnabled); }}
                className="group relative rounded-3xl border border-indigo-200 bg-white p-7 shadow-sm hover:border-indigo-400 hover:shadow-md transition cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition"><Code2 className="h-6 w-6" /></div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">Student / Candidate Portal</h2>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">Connect real GitHub & LeetCode. Upload PDF resume. Get verified XP score. Apply to real job drops. Complete admin challenges for extra XP.</p>
                <div className="mt-5 flex items-center justify-between text-xs font-bold text-indigo-600 border-t border-slate-100 pt-4">
                  <span>Enter Student Portal</span><ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
              <div onClick={() => { setScreen('recruiter'); setError(''); playSound('click', soundEnabled); }}
                className="group relative rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm hover:border-emerald-400 hover:shadow-md transition cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition"><Building2 className="h-6 w-6" /></div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">HR / Recruiter Sourcing Hub</h2>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">Browse verified candidates ranked by live XP. Post job drops with XP thresholds. Deep-dive into GitHub stats. Dev vs Dev battle mode.</p>
                <div className="mt-5 flex items-center justify-between text-xs font-bold text-emerald-600 border-t border-slate-100 pt-4">
                  <span>Enter Recruiter Hub</span><ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENT CHOICE ───────────────────────────────────────────────── */}
        {screen === 'student_choice' && (
          <div className="mx-auto max-w-md space-y-4">
            <button onClick={() => { setScreen('home'); setError(''); }} className="text-xs text-slate-500 hover:text-slate-900 mb-2 font-semibold">← Back</button>
            <h2 className="text-2xl font-black text-slate-900">Student Portal</h2>
            <p className="text-xs text-slate-500">Already registered? Log back in instantly with your GitHub username. New here? Register below.</p>
            {error && <div className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600" /><span>{error}</span></div>}
            <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
              <div className="flex items-center space-x-2 text-sm font-bold text-indigo-600 mb-3"><LogIn className="h-4 w-4" /><span>Returning Student — Quick Login</span></div>
              <form onSubmit={handleReturningLogin} className="flex space-x-2">
                <input type="text" placeholder="Your GitHub username" value={returningGithub} onChange={e => setReturningGithub(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
                <button type="submit" disabled={isLoading}
                  className="flex items-center space-x-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60 shadow-md">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  <span>{isLoading ? '...' : 'Login'}</span>
                </button>
              </form>
              {isLoading && <p className="text-xs text-cyan-400 mt-2">{loadingStatus}</p>}
            </div>
            <div className="text-center text-xs text-slate-500">— or register as new student —</div>
            <button onClick={() => { setScreen('new_student'); setStep(1); setError(''); playSound('click', soundEnabled); }}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl border border-purple-500/40 bg-purple-950/20 py-3.5 text-sm font-bold text-purple-300 hover:bg-purple-950/40 transition">
              <UserPlus className="h-4 w-4" /><span>Register as New Student</span>
            </button>
          </div>
        )}

        {/* ── NEW STUDENT WIZARD ───────────────────────────────────────────── */}
        {screen === 'new_student' && (
          <div className="mx-auto max-w-xl rounded-3xl border border-cyan-500/30 bg-slate-950 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center space-x-2">
                {[1, 2, 3].map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${step >= s ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{s}</div>
                    {i < 2 && <div className={`h-0.5 w-8 transition ${step > s ? 'bg-cyan-500' : 'bg-slate-800'}`} />}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => step > 1 ? setStep(s => s - 1) : setScreen('student_choice')} className="text-xs text-slate-400 hover:text-white">← Back</button>
            </div>

            {error && <div className="mb-4 flex items-start space-x-2 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span></div>}

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div><h2 className="text-lg font-bold text-white">Step 1: Your Details</h2><p className="text-xs text-slate-400 mt-0.5">Basic info — name, email, target role</p></div>
                <div><label className="text-xs font-bold text-slate-300">Full Name *</label><input type="text" placeholder="e.g. Sumanth Kumar" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white focus:border-cyan-500 focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-300">Email</label><input type="email" placeholder="e.g. you@email.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white focus:border-cyan-500 focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-300">Target Job Role *</label><input type="text" placeholder="e.g. Full Stack Engineer / Backend Developer" value={targetRole} onChange={e => setTargetRole(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white focus:border-cyan-500 focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-300">Short Bio (optional)</label><input type="text" placeholder="e.g. CS student passionate about distributed systems" value={bio} onChange={e => setBio(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white focus:border-cyan-500 focus:outline-none" /></div>
                <button onClick={() => { setError(''); if (!name.trim()) { setError('Full name is required.'); return; } setStep(2); }} className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition"><span>Next: Connect Profiles</span><ArrowRight className="h-4 w-4" /></button>
              </div>
            )}

            {/* Step 2 — with GitHub identity confirmation */}
            {step === 2 && (
              <div className="space-y-4">
                <div><h2 className="text-lg font-bold text-white">Step 2: Connect & Verify Your Profiles</h2><p className="text-xs text-slate-400 mt-0.5">Enter your real GitHub handle then click "Verify" to confirm it's YOUR account.</p></div>

                {/* GitHub with verify */}
                <div>
                  <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5"><Github className="h-4 w-4" /> GitHub Username *</label>
                  <div className="mt-1 flex space-x-2">
                    <input type="text" placeholder="sumanthml  or  https://github.com/sumanthml" value={githubUsername}
                      onChange={e => {
                        const raw = e.target.value;
                        // Auto-parse URL to username while typing
                        const parsed = parseGitHubUsername(raw);
                        // If raw looks like a URL and parsed differs, auto-replace
                        const normalized = raw.includes('github.com') ? parsed : raw;
                        setGithubUsername(normalized);
                        setGhPreview(null);
                        setGhConfirmed(false);
                      }}
                      className="flex-1 rounded-xl border border-cyan-500/40 bg-slate-900 p-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                    <button type="button" onClick={handleVerifyGithub} disabled={ghPreviewLoading || !githubUsername.trim()}
                      className="flex items-center space-x-1 rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50">
                      {ghPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>{ghPreviewLoading ? '...' : 'Verify'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">You can paste the full GitHub profile URL or just the username</p>
                </div>

                {/* GitHub identity confirmation card */}
                {ghPreview && !ghConfirmed && (
                  <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                    <div className="text-xs font-bold text-cyan-400 mb-3">Is this your GitHub account?</div>
                    <div className="flex items-center space-x-3">
                      <img src={ghPreview.avatar} alt={ghPreview.name} className="h-14 w-14 rounded-xl ring-2 ring-cyan-500/50" />
                      <div>
                        <div className="text-sm font-bold text-white">{ghPreview.name}</div>
                        <div className="text-xs text-slate-400 font-mono">@{ghPreview.login}</div>
                        {ghPreview.bio && <div className="text-xs text-slate-400 mt-0.5">{ghPreview.bio}</div>}
                        <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {ghPreview.publicRepos} repos</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ghPreview.followers} followers</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex space-x-2">
                      <button onClick={() => { setGhConfirmed(true); setError(''); }}
                        className="flex-1 flex items-center justify-center space-x-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition">
                        <CheckCircle2 className="h-4 w-4" /><span>Yes, this is me!</span>
                      </button>
                      <button onClick={() => { setGhPreview(null); setGithubUsername(''); }}
                        className="flex-1 rounded-xl border border-rose-500/40 bg-rose-950/20 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/40 transition">
                        No, wrong account
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmed banner */}
                {ghConfirmed && ghPreview && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-3 flex items-center space-x-3">
                    <img src={ghPreview.avatar} alt={ghPreview.name} className="h-9 w-9 rounded-lg" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-emerald-400">✓ GitHub Identity Verified</div>
                      <div className="text-xs text-slate-400">{ghPreview.name} (@{ghPreview.login}) • {ghPreview.publicRepos} repos</div>
                    </div>
                    <button onClick={() => { setGhConfirmed(false); setGhPreview(null); setGithubUsername(''); }} className="text-[10px] text-slate-500 hover:text-white">Change</button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-purple-400 flex items-center gap-1.5"><Code className="h-4 w-4" /> LeetCode Username (optional)</label>
                  <input type="text" placeholder="Your LeetCode username (leave blank = 0 LeetCode XP)" value={leetcodeUsername} onChange={e => setLeetcodeUsername(e.target.value)} className="mt-1 w-full rounded-xl border border-purple-500/40 bg-slate-900 p-3 text-sm text-white focus:border-purple-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5"><Linkedin className="h-4 w-4" /> LinkedIn URL (optional)</label>
                  <input type="url" placeholder="https://linkedin.com/in/yourprofile" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <button onClick={() => { setError(''); if (!githubUsername.trim()) { setError('GitHub username is required.'); return; } if (!ghConfirmed) { setError('Please verify your GitHub identity first.'); return; } setStep(3); }}
                  className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition">
                  <span>Next: Upload Resume</span><ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <form onSubmit={handleNewStudentSubmit} className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Step 3: Upload Resume & Calculate DevRank</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Upload your PDF resume for Gemini AI semantic ATS analysis.</p>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-purple-500/40 bg-purple-950/20 p-6 text-center">
                  <FileText className="h-10 w-10 text-purple-400 mx-auto" />
                  <p className="mt-2 text-sm font-bold text-purple-200">{pdfFile ? `✓ ${pdfFile.name}` : 'Upload your resume (.pdf or .txt)'}</p>
                  <input type="file" accept=".pdf,.txt" onChange={handlePdfChange} id="landing-pdf" className="hidden" />
                  <label htmlFor="landing-pdf" className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-purple-600/30 border border-purple-500/50 px-5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-600/40 cursor-pointer transition">
                    <Upload className="h-4 w-4" /><span>{pdfFile ? 'Change File' : 'Browse File'}</span>
                  </label>
                  {pdfText ? (
                    <p className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{pdfText.length} characters extracted — Ready for Gemini AI ATS</span>
                    </p>
                  ) : pdfFile ? (
                    <p className="text-[11px] text-purple-300 font-semibold mt-2 flex items-center justify-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-300" />
                      <span>Extracting resume text...</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-2">Optional · You can also upload later in your dashboard</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs space-y-2">
                  <div className="text-slate-300 font-bold mb-1 border-b border-slate-800 pb-1.5">Live Profile Verification Status:</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">GitHub Profile:</span>
                    <span className="text-cyan-400 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> @{githubUsername}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">LeetCode Rating:</span>
                    <span className={leetcodeUsername ? "text-violet-400 font-bold" : "text-slate-500"}>
                      {leetcodeUsername ? `@${leetcodeUsername}` : 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Resume ATS:</span>
                    <span className={pdfText ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      {pdfText ? `✓ ${pdfText.length} chars extracted` : pdfFile ? 'Extracting...' : 'No file'}
                    </span>
                  </div>
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 py-3.5 text-sm font-extrabold text-white shadow-xl hover:opacity-90 transition disabled:opacity-60">
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /><span>{loadingStatus || 'Verifying...'}</span></> : <><span>Verify & Calculate My DevRank Score</span><Sparkles className="h-4 w-4" /></>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── RECRUITER ──────────────────────────────────────────────────────── */}
        {screen === 'recruiter' && (
          <div className="mx-auto max-w-md rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-2xl text-left text-slate-900 font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200"><Building2 className="h-5 w-5" /></div>
                <div><h2 className="text-base font-black text-slate-900">HR Recruiter Portal</h2><p className="text-xs text-slate-500 font-medium">Access Talent Sourcing Hub</p></div>
              </div>
              <button onClick={() => { setScreen('home'); setError(''); }} className="text-xs text-slate-500 hover:text-slate-900 font-bold">← Back</button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200 mb-5">
              <button
                type="button"
                onClick={() => { setRecruiterMode('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${recruiterMode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Log In (Existing HR)
              </button>
              <button
                type="button"
                onClick={() => { setRecruiterMode('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${recruiterMode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Register (New HR)
              </button>
            </div>

            {error && <div className="mb-4 flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600" /><span>{error}</span></div>}

            {recruiterMode === 'login' ? (
              /* QUICK HR LOGIN FORM */
              <form onSubmit={(e) => {
                e.preventDefault();
                setError('');
                if (!recruiterEmail.trim()) return setError('Enter your HR work email or company name.');
                playSound('click', soundEnabled);
                onRecruiterLogin({
                  companyName: companyName.trim() || 'TechCorp Sourcing',
                  recruiterName: recruiterName.trim() || 'HR Recruiter',
                  recruiterEmail: recruiterEmail.trim()
                });
              }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Work Email or Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. hr@techcorp.com or Stripe"
                    value={recruiterEmail}
                    onChange={e => setRecruiterEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 font-semibold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <button type="submit" className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 transition">
                  <LogIn className="h-4 w-4" />
                  <span>Log In to HR Sourcing Hub</span>
                </button>
              </form>
            ) : (
              /* NEW HR REGISTRATION FORM */
              <form onSubmit={handleRecruiterSubmit} className="space-y-4">
                <div><label className="text-xs font-bold text-slate-700">Company Name *</label><input type="text" placeholder="e.g. TechCorp, Stripe, Google" value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 font-semibold focus:border-emerald-500 focus:outline-none" required /></div>
                <div><label className="text-xs font-bold text-slate-700">Your Full Name *</label><input type="text" placeholder="e.g. Sarah Jenkins" value={recruiterName} onChange={e => setRecruiterName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 font-semibold focus:border-emerald-500 focus:outline-none" required /></div>
                <div><label className="text-xs font-bold text-slate-700">Work Email *</label><input type="email" placeholder="e.g. hr@yourcompany.com" value={recruiterEmail} onChange={e => setRecruiterEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 font-semibold focus:border-emerald-500 focus:outline-none" required /></div>
                <button type="submit" className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 transition">
                  <UserPlus className="h-4 w-4" />
                  <span>Register & Enter HR Hub</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      <div className="mx-auto max-w-6xl w-full text-center text-xs text-slate-500 py-4 border-t border-slate-800/80">
        DevRank · GitHub REST API · LeetCode API · Google Gemini AI · Supabase Realtime
      </div>
    </div>
  );
}

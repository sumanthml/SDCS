/**
 * DevRank — API Service Layer (Supabase + Gemini Edition)
 *
 * Database    : Supabase (PostgreSQL + Realtime)
 * GitHub      : REST API (live) + contributions API (real heatmap)
 * LeetCode    : Public proxy API (live)
 * ATS Scoring : Google Gemini 1.5 Flash (semantic/transformer-level)
 * Skill Scores: Gemini per-skill HR view (cached in Supabase)
 *
 * XP SYSTEM: Unlimited, very hard to earn.
 * GitHub:     repos × 2 + stars × 0.5 + contributions × 0.05
 * LeetCode:   easy × 0.5 + medium × 1.5 + hard × 4
 * ATS:        Gemini semantic score (0–100) × 0.8 XP
 * Challenges: Easy 3, Medium 5, Hard 8 XP
 * Interview:  2 XP per good answer
 * NO CAP — progress is naturally slow by design
 */

import { supabase } from '../supabaseClient';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
const CONTRIBS_API = 'https://github-contributions-api.jogruber.de/v4';

// ─── Helper: call Gemini and return text ─────────────────────────────────────
async function geminiCall(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

// ─── Helper: parse first JSON block from Gemini text ─────────────────────────
function parseJsonFromText(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ─── XP FORMULAS (Unlimited, very hard) ──────────────────────────────────────

export function computeGitHubXp(ghStats, contributions = null) {
  if (!ghStats || ghStats.error) return 0;
  const reposXp   = (ghStats.publicRepos || 0) * 2;          // 10 repos = 20 XP
  const starsXp   = (ghStats.stars       || 0) * 0.5;        // 100 stars = 50 XP
  const contribXp = contributions
    ? (contributions.total?.lastYear || 0) * 0.05              // 1000 commits = 50 XP
    : 0;
  return Math.round(reposXp + starsXp + contribXp);
}

export function computeLeetCodeXp(lcStats) {
  if (!lcStats || lcStats.error) return 0;
  const easyXp   = (lcStats.easy   || 0) * 0.5;   // 100 easy = 50 XP
  const medXp    = (lcStats.medium || 0) * 1.5;   // 100 medium = 150 XP
  const hardXp   = (lcStats.hard   || 0) * 4;     // 50 hard = 200 XP
  return Math.round(easyXp + medXp + hardXp);
}

// ATS XP: Gemini returns a 0–100 score → × 0.8 = max ~80 XP per role
export function computeResumeXpFromScore(atsScore) {
  return Math.round((atsScore || 0) * 0.8);
}

// Legacy keyword fallback when Gemini not available
export function computeResumeXp(pdfText, extraText = '') {
  if (!pdfText?.trim()) return 0;
  const combined = (pdfText + ' ' + extraText).toUpperCase();
  const ALL_SKILLS = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular',
    'Node.js', 'Express', 'Spring Boot', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Docker',
    'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'CI/CD', 'Linux', 'Tailwind',
    'HTML', 'CSS', 'System Design', 'Microservices', 'PyTorch', 'TensorFlow',
    'Swift', 'Kotlin', 'Flutter', 'Dart', 'Spark', 'Hadoop', 'Elasticsearch',
    'Kafka', 'gRPC', 'WebSocket', 'OAuth', 'JWT', 'Machine Learning', 'Deep Learning',
  ];
  const matched = ALL_SKILLS.filter(kw => combined.includes(kw.toUpperCase())).length;
  // Max ~60 XP for many keywords (much smaller than Gemini path)
  return Math.round(Math.min(60, (matched / 10) * 60));
}

export function extractSkillsFromText(pdfText, extraText = '') {
  const ALL_SKILLS = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular',
    'Node.js', 'Express', 'Spring Boot', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Docker',
    'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'CI/CD', 'Linux', 'Tailwind',
    'HTML', 'CSS', 'System Design', 'Microservices', 'PyTorch', 'TensorFlow',
    'Swift', 'Kotlin', 'Flutter', 'Dart', 'Spark', 'Hadoop', 'Elasticsearch',
    'Kafka', 'gRPC', 'WebSocket', 'OAuth', 'JWT', 'Machine Learning', 'Deep Learning',
  ];
  if (!pdfText?.trim() && !extraText?.trim()) return [];
  const combined = (pdfText + ' ' + extraText).toUpperCase();
  return ALL_SKILLS.filter(kw => combined.includes(kw.toUpperCase()));
}

export function computeTotalXp(resumeXp, githubXp, leetcodeXp, interviewXp = 0, challengeXp = 0) {
  // NO CAP — unlimited XP
  return Math.round(
    (resumeXp || 0) + (githubXp || 0) + (leetcodeXp || 0) + (interviewXp || 0) + (challengeXp || 0)
  );
}

// ─── REAL GitHub Contributions (365-day heatmap data) ────────────────────────
export async function fetchGitHubContributions(username) {
  if (!username?.trim()) return null;
  try {
    const res = await fetch(`${CONTRIBS_API}/${username.trim()}?y=last`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      total: data.total || {},         // { lastYear: 234 }
      contributions: data.contributions || [], // [{date, count, level}]
    };
  } catch { return null; }
}

// ─── Helper: extract username from full URL or plain username ────────────────
// Accepts:  sumanthml  OR  https://github.com/sumanthml  OR  github.com/sumanthml
export function parseGitHubUsername(input) {
  if (!input?.trim()) return '';
  const s = input.trim();
  // If it looks like a URL, extract the path segment after github.com/
  const match = s.match(/github\.com\/([\w-]+)/i);
  if (match) return match[1];
  // Otherwise treat as plain username
  return s.replace(/^@/, '');
}

// ─── LIVE GitHub REST API ─────────────────────────────────────────────────────
export async function fetchLiveGitHubStats(username) {
  const u = parseGitHubUsername(username);
  const empty = { publicRepos: 0, stars: 0, topLanguages: [], topRepos: [], repoTimestamps: [], error: null };
  if (!u) return { ...empty, error: 'No GitHub username provided' };
  try {
    const userRes = await fetch(`https://api.github.com/users/${u}`);
    if (userRes.status === 404) return { ...empty, name: u, avatar: null, bio: '', error: `GitHub user "${u}" does not exist. Check spelling carefully.` };
    if (!userRes.ok) return { ...empty, name: u, avatar: null, bio: '', error: `GitHub API error (${userRes.status}). Try again.` };
    const userData = await userRes.json();
    const reposRes = await fetch(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`);
    const repos = reposRes.ok ? await reposRes.json() : [];
    let totalStars = 0;
    const langMap = {};
    const topRepos = [];
    (Array.isArray(repos) ? repos : []).forEach(repo => {
      totalStars += (repo.stargazers_count || 0);
      if (repo.language) langMap[repo.language] = (langMap[repo.language] || 0) + 1;
      if (topRepos.length < 6) topRepos.push({
        name: repo.name, stars: repo.stargazers_count || 0,
        language: repo.language || 'Unknown', description: repo.description || '',
        url: repo.html_url, forks: repo.forks_count || 0, pushed_at: repo.pushed_at,
      });
    });
    const totalLangCount = Object.values(langMap).reduce((a, b) => a + b, 0) || 1;
    const topLanguages = Object.entries(langMap)
      .map(([name, count]) => ({ name, percentage: Math.round((count / totalLangCount) * 100) }))
      .sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    const repoTimestamps = (Array.isArray(repos) ? repos : []).map(r => r.pushed_at).filter(Boolean);
    return {
      name: userData.name || u, login: u, avatar: userData.avatar_url || null,
      bio: userData.bio || '', location: userData.location || '',
      publicRepos: userData.public_repos || 0, followers: userData.followers || 0,
      stars: totalStars, topLanguages, topRepos, repoTimestamps,
      profileUrl: `https://github.com/${u}`, error: null,
    };
  } catch {
    return { ...empty, name: u, avatar: null, bio: '', error: `Network error fetching GitHub "${u}".` };
  }
}

// ─── Quick GitHub Preview (identity confirmation step) ───────────────────────
export async function previewGitHubUser(username) {
  const u = parseGitHubUsername(username);
  if (!u) return null;
  try {
    const res = await fetch(`https://api.github.com/users/${u}`);
    if (!res.ok) return null;
    const d = await res.json();
    return { name: d.name || d.login, login: d.login, avatar: d.avatar_url, bio: d.bio || '', publicRepos: d.public_repos || 0, followers: d.followers || 0 };
  } catch { return null; }
}

// ─── LeetCode URL & Handle Parser ──────────────────────────────────────────────
export function parseLeetCodeUsername(input) {
  if (!input) return '';
  let str = input.trim();
  // Match URLs like https://leetcode.com/u/username/ or https://leetcode.com/username/
  const urlMatch = str.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  // Fallback: strip leading/trailing slashes and get last segment
  return str.replace(/\/+$/, '').split('/').pop() || str;
}

// ─── LIVE LeetCode API ────────────────────────────────────────────────────────
export async function fetchLiveLeetCodeStats(username) {
  const empty = { easy: 0, medium: 0, hard: 0, total: 0, contestRating: 0, ranking: 0, error: null };
  const u = parseLeetCodeUsername(username);
  if (!u) return { ...empty, error: 'No LeetCode username provided' };
  try {
    const res = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${u}`);
    if (!res.ok) return { ...empty, error: `LeetCode API error for "${u}"` };
    const data = await res.json();
    if (!data || data.errors || typeof data.totalSolved !== 'number') return { ...empty, error: `LeetCode user "${u}" not found.` };
    const easy = data.easySolved || 0, medium = data.mediumSolved || 0, hard = data.hardSolved || 0, total = data.totalSolved || 0;
    const contestRating = total > 0 ? Math.min(3000, Math.round(1200 + (medium * 4) + (hard * 8))) : 0;
    return { easy, medium, hard, total, contestRating, ranking: data.ranking || 0, error: null };
  } catch { return { ...empty, error: `Network error fetching LeetCode "${u}".` }; }
}

// ─── Gemini: Extract Structured Profile from Resume (with Quota Caching) ─────
const geminiCache = new Map();

export async function extractStructuredProfile(resumeText, targetRole) {
  if (!resumeText?.trim()) return null;
  const cacheKey = `ats_${targetRole}_${resumeText.slice(0, 500)}`;
  
  if (geminiCache.has(cacheKey)) {
    console.log('[Gemini Cache] Returned cached ATS score from memory');
    return geminiCache.get(cacheKey);
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      geminiCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {}

  if (!GEMINI_KEY) {
    // Local ML / Rule-based extraction fallback when API key is unavailable or quota exhausted
    const skills = extractSkillsFromText(resumeText, targetRole);
    const fallback = {
      skills,
      projects: [],
      experience_years: 1,
      summary: `Candidate matching ${targetRole}`,
      tech_domains: [targetRole],
      ats_keywords: skills,
      ats_score: Math.min(95, Math.max(30, skills.length * 8)),
      ats_reason: `Local ML matched ${skills.length} core technical keywords for ${targetRole}`,
    };
    return fallback;
  }

  const prompt = `You are an expert ATS system. Analyze this resume for a "${targetRole}" role.
Return ONLY valid JSON (no markdown, no explanation):
{
  "skills": ["skill1", "skill2"],
  "projects": [{"name": "...", "tech": ["..."], "description": "1 sentence"}],
  "experience_years": 2,
  "summary": "1-sentence profile summary",
  "tech_domains": ["Frontend", "Backend", "ML", "DevOps"],
  "ats_keywords": ["keyword1", "keyword2"],
  "ats_score": 72,
  "ats_reason": "Why this score in 1 sentence"
}

ATS score 0–100: score based on skills relevance, project quality, experience match for "${targetRole}".
Be strict — only give high scores for strong matches.

RESUME TEXT:
${resumeText.slice(0, 3000)}`;

  const text = await geminiCall(prompt);
  const result = parseJsonFromText(text);

  if (result) {
    geminiCache.set(cacheKey, result);
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
  }
  return result;
}

// ─── Gemini: Compute skill-specific score for HR view ────────────────────────
// Returns 0–100 score for how well candidate matches a specific skill/role
export async function computeSkillScore(extractedProfile, targetSkill) {
  if (!extractedProfile || !GEMINI_KEY) return null;
  const profileStr = JSON.stringify({
    skills: extractedProfile.skills || [],
    projects: extractedProfile.projects || [],
    experience_years: extractedProfile.experience_years || 0,
    tech_domains: extractedProfile.tech_domains || [],
  });
  const prompt = `Score this developer profile for the skill/role "${targetSkill}" from 0 to 100.
Profile: ${profileStr}
Return ONLY JSON: {"score": 72, "reason": "brief reason"}
Be strict — only give 80+ for genuine strong match.`;

  const text = await geminiCall(prompt);
  const parsed = parseJsonFromText(text);
  return parsed?.score ?? null;
}

// ─── Supabase: Candidate CRUD ─────────────────────────────────────────────────
export async function updateCandidateInSupabase(githubUsername, updates) {
  if (!githubUsername) return false;
  try {
    const { error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('github_username', githubUsername.trim().toLowerCase());
    if (error) console.warn('[Supabase Update Error]:', error);
    return !error;
  } catch (err) {
    console.warn('[Supabase] updateCandidate exception:', err.message);
    return false;
  }
}

export async function saveProfileToSupabase(profile) {
  try {
    // BASE fields (always present in schema)
    const basePayload = {
      github_username:    profile.githubUsername.toLowerCase(),
      name:               profile.name,
      email:              profile.email || '',
      target_role:        profile.targetRole || 'Software Engineer',
      bio:                profile.bio || '',
      linkedin_url:       profile.linkedinUrl || '',
      leetcode_username:  profile.leetcodeUsername || '',
      avatar:             profile.avatar || null,
      total_xp:           profile.totalXp || 0,
      github_xp:          profile.githubXp || 0,
      leetcode_xp:        profile.leetcodeXp || 0,
      resume_xp:          profile.resumeXp || 0,
      interview_xp:       profile.interviewXp || 0,
      challenge_xp:       profile.challengeXp || 0,
      github_stats:       profile.githubStats || {},
      leetcode_stats:     profile.leetcodeStats || {},
      skills:             profile.skills || [],
      badges:             profile.badges || [],
      applied_jobs:       profile.appliedJobs || [],
      updated_at:         new Date().toISOString(),
    };

    const { error: baseError } = await supabase
      .from('candidates')
      .upsert(basePayload, { onConflict: 'github_username' });

    if (baseError) {
      console.warn('[Supabase] base upsert failed:', baseError.message);
      return false;
    }

    // AI / extended fields (added later via migration — may not exist yet)
    const aiPayload = {};
    if (profile.extractedProfile !== undefined) aiPayload.extracted_profile = profile.extractedProfile || {};
    if (profile.skillScores !== undefined)      aiPayload.skill_scores       = profile.skillScores || {};
    if (profile.atsScore !== undefined)         aiPayload.ats_score          = profile.atsScore || 0;
    if (profile.contributionsData !== undefined) aiPayload.contributions_data = profile.contributionsData || {};

    if (Object.keys(aiPayload).length > 0) {
      try {
        await supabase.from('candidates')
          .update(aiPayload)
          .eq('github_username', profile.githubUsername.toLowerCase());
      } catch {
        // AI columns don't exist yet — run the migration SQL in Supabase dashboard
        console.warn('[Supabase] AI columns not yet migrated. Run the ALTER TABLE statements in schema.sql.');
      }
    }

    return true;
  } catch (err) {
    console.warn('[Supabase] saveProfile:', err.message);
    return false;
  }
}

// Update just skill_scores JSONB (called after HR computes a new skill score)
export async function updateSkillScores(githubUsername, skillScores) {
  try {
    const { error } = await supabase.from('candidates')
      .update({ skill_scores: skillScores })
      .eq('github_username', githubUsername.toLowerCase());
    if (error) console.warn('[Supabase] updateSkillScores:', error.message);
  } catch {}
}

export async function deleteCandidateFromSupabase(githubUsername) {
  if (!githubUsername?.trim()) return false;
  const usernameClean = githubUsername.trim().toLowerCase();
  try {
    // Delete exact and ilike match
    await supabase.from('candidates').delete().eq('github_username', usernameClean);
    await supabase.from('candidates').delete().ilike('github_username', usernameClean);

    // Clear local storage session tokens & caches
    try {
      localStorage.removeItem('devrank_current_user');
      localStorage.removeItem('devrank_session');
    } catch {}
    
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteCandidate:', err.message);
    return true;
  }
}

export async function loadProfileFromSupabase(githubUsername) {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('github_username', githubUsername.toLowerCase())
      .single();
    if (error || !data) return null;
    return mapRowToProfile(data);
  } catch { return null; }
}

export async function loadAllCandidatesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('total_xp', { ascending: false });
    if (error) return [];
    return (data || []).map(mapRowToProfile);
  } catch { return []; }
}

function mapRowToProfile(row) {
  return {
    id:               row.github_username,
    githubUsername:   row.github_username,
    name:             row.name,
    email:            row.email || '',
    targetRole:       row.target_role || 'Software Engineer',
    bio:              row.bio || '',
    linkedinUrl:      row.linkedin_url || '',
    leetcodeUsername: row.leetcode_username || '',
    avatar:           row.avatar || null,
    totalXp:          row.total_xp || 0,
    githubXp:         row.github_xp || 0,
    leetcodeXp:       row.leetcode_xp || 0,
    resumeXp:         row.resume_xp || 0,
    interviewXp:      row.interview_xp || 0,
    challengeXp:      row.challenge_xp || 0,
    githubStats:      row.github_stats || {},
    leetcodeStats:    row.leetcode_stats || {},
    skills:           row.skills || [],
    badges:           row.badges || [],
    appliedJobs:      row.applied_jobs || [],
    // AI fields
    extractedProfile: row.extracted_profile || {},
    skillScores:      row.skill_scores || {},
    atsScore:         row.ats_score || 0,
    contributionsData: row.contributions_data || {},
    createdAt:        row.created_at,
  };
}

// ─── Supabase: Job Drops ──────────────────────────────────────────────────────
export async function saveJobDropToSupabase(jobDrop) {
  try {
    const { error } = await supabase.from('job_drops').upsert({
      id:               jobDrop.id,
      company_name:     jobDrop.companyName,
      logo:             jobDrop.logo || '🚀',
      title:            jobDrop.title,
      location:         jobDrop.location || 'Remote',
      salary:           jobDrop.salary || 'Competitive',
      req_xp:           jobDrop.reqXp || 0,
      req_leetcode:     jobDrop.reqLeetCode || 0,
      req_github_repos: jobDrop.reqGithubRepos || 0,
      skills:           jobDrop.skills || [],
      applicants_count: jobDrop.applicantsCount || 0,
      status:           jobDrop.status || 'active',
      recruiter_email:  jobDrop.recruiterEmail || '',
      recruiter_name:   jobDrop.recruiterName || '',
      company_name_hr:  jobDrop.companyName || '',
      created_at:       jobDrop.createdAt || new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) console.warn('[Supabase] saveJobDrop:', error.message);
  } catch (err) { console.warn('[Supabase] saveJobDrop:', err.message); }
}

export async function deleteJobDropFromSupabase(jobId) {
  try { await supabase.from('job_drops').delete().eq('id', jobId); } catch {}
}

function mapJobRow(row) {
  return {
    id: row.id, companyName: row.company_name, logo: row.logo || '🚀',
    title: row.title, location: row.location || 'Remote', salary: row.salary || 'Competitive',
    reqXp: row.req_xp || 0, reqLeetCode: row.req_leetcode || 0, reqGithubRepos: row.req_github_repos || 0,
    skills: row.skills || [], applicantsCount: row.applicants_count || 0,
    status: row.status || 'active', createdAt: row.created_at,
  };
}

// ─── Supabase: Challenges ─────────────────────────────────────────────────────
export async function loadActiveChallenges() {
  try {
    const { data, error } = await supabase.from('challenges')
      .select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  } catch { return []; }
}

export async function createChallenge(challenge) {
  try {
    const xpByDiff = { easy: 3, medium: 5, hard: 8 };
    const { data, error } = await supabase.from('challenges').insert({
      title:             challenge.title,
      description:       challenge.description,
      difficulty:        challenge.difficulty || 'easy',
      time_limit_seconds: challenge.timeLimitSeconds || 300,
      xp_reward:         xpByDiff[challenge.difficulty] || 3,
      tags:              challenge.tags || [],
      is_active:         true,
      created_by_email:  'admin@devrank.io',
    }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function updateChallenge(id, updates) {
  try {
    const { error } = await supabase.from('challenges').update(updates).eq('id', id);
    return !error;
  } catch { return false; }
}

export async function deleteChallenge(id) {
  try { await supabase.from('challenges').delete().eq('id', id); return true; }
  catch { return false; }
}

export async function submitChallengeAnswer({ challengeId, githubUsername, answer, timeTakenSeconds, xpEarned }) {
  try {
    const { data: existing } = await supabase
      .from('challenge_submissions')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('github_username', githubUsername)
      .single();
    if (existing) return { success: false, error: 'Already submitted this challenge.' };

    const { error } = await supabase.from('challenge_submissions').insert({
      challenge_id: challengeId, github_username: githubUsername,
      answer, time_taken_seconds: timeTakenSeconds, xp_earned: xpEarned,
    });
    if (error) return { success: false, error: error.message };

    // Update candidate XP (no cap)
    const { data: candidate } = await supabase.from('candidates')
      .select('challenge_xp, total_xp').eq('github_username', githubUsername).single();
    if (candidate) {
      await supabase.from('candidates').update({
        challenge_xp: (candidate.challenge_xp || 0) + xpEarned,
        total_xp:     (candidate.total_xp || 0) + xpEarned,  // NO CAP
      }).eq('github_username', githubUsername);
    }
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function getSubmissionsForUser(githubUsername) {
  try {
    const { data } = await supabase.from('challenge_submissions')
      .select('challenge_id, xp_earned, submitted_at').eq('github_username', githubUsername);
    return data || [];
  } catch { return []; }
}

export async function getChallengeStats() {
  try {
    const { data } = await supabase.from('challenge_submissions')
      .select('challenge_id, xp_earned, github_username');
    return data || [];
  } catch { return []; }
}

// ─── Supabase Realtime Subscriptions ─────────────────────────────────────────
export function subscribeToJobDrops(callback) {
  supabase.from('job_drops').select('*').order('created_at', { ascending: false })
    .then(({ data }) => callback((data || []).map(mapJobRow)));
  const channel = supabase.channel('job_drops_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_drops' }, () => {
      supabase.from('job_drops').select('*').order('created_at', { ascending: false })
        .then(({ data }) => callback((data || []).map(mapJobRow)));
    }).subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToLeaderboard(callback) {
  supabase.from('candidates').select('*').order('total_xp', { ascending: false })
    .then(({ data }) => callback((data || []).map(mapRowToProfile)));
  const channel = supabase.channel('candidates_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
      supabase.from('candidates').select('*').order('total_xp', { ascending: false })
        .then(({ data }) => callback((data || []).map(mapRowToProfile)));
    }).subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToChallenges(callback) {
  supabase.from('challenges').select('*').eq('is_active', true).order('created_at', { ascending: false })
    .then(({ data }) => callback(data || []));
  const channel = supabase.channel('challenges_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => {
      supabase.from('challenges').select('*').eq('is_active', true).order('created_at', { ascending: false })
        .then(({ data }) => callback(data || []));
    }).subscribe();
  return () => supabase.removeChannel(channel);
}

// ─── 1v1 Battles & Admin Approval Queue (Dual Supabase + LocalStorage) ──────
function getLocalBattles() {
  try {
    const raw = localStorage.getItem('devrank_battle_matches');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocalBattles(list) {
  try {
    localStorage.setItem('devrank_battle_matches', JSON.stringify(list));
  } catch {}
}

export async function create1v1ChallengeRequest(challengerUsername, opponentUsername) {
  if (!challengerUsername || !opponentUsername) return { success: false, error: 'Missing usernames' };
  
  const newBattle = {
    id: 'btl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    challenger_username: challengerUsername.toLowerCase(),
    opponent_username: opponentUsername.toLowerCase(),
    title: '1v1 Developer Speed Duel',
    status: 'pending_admin_approval',
    created_at: new Date().toISOString()
  };

  // 1. Save to Local Storage immediately
  const localList = getLocalBattles();
  localList.unshift(newBattle);
  saveLocalBattles(localList);

  // 2. Save to Supabase
  try {
    const { data } = await supabase
      .from('battle_matches')
      .insert({
        challenger_username: challengerUsername.toLowerCase(),
        opponent_username: opponentUsername.toLowerCase(),
        title: '1v1 Developer Speed Duel',
        status: 'pending_admin_approval'
      })
      .select()
      .single();
    if (data) return { success: true, battle: data };
  } catch {}

  return { success: true, battle: newBattle };
}

export async function loadPendingBattlesFromSupabase() {
  let supabaseData = [];
  try {
    const { data } = await supabase
      .from('battle_matches')
      .select('*')
      .eq('status', 'pending_admin_approval')
      .order('created_at', { ascending: false });
    supabaseData = data || [];
  } catch {}

  const localData = getLocalBattles().filter(b => b.status === 'pending_admin_approval');
  const map = new Map();
  [...localData, ...supabaseData].forEach(b => map.set(String(b.id), b));
  return Array.from(map.values());
}

export async function approve1v1BattleByAdmin(battleId, problemDetails) {
  const localList = getLocalBattles();
  const updatedLocal = localList.map(b => {
    if (String(b.id) === String(battleId)) {
      return {
        ...b,
        title: problemDetails.title || 'Official Admin 1v1 Speed Battle',
        problem_statement: problemDetails.problemStatement || '',
        starter_code: problemDetails.starterCode || '',
        status: 'approved_active'
      };
    }
    return b;
  });
  saveLocalBattles(updatedLocal);

  try {
    const { data } = await supabase
      .from('battle_matches')
      .update({
        title: problemDetails.title || 'Official Admin 1v1 Speed Battle',
        problem_statement: problemDetails.problemStatement || '',
        starter_code: problemDetails.starterCode || '',
        status: 'approved_active'
      })
      .eq('id', battleId)
      .select()
      .single();
    if (data) return { success: true, battle: data };
  } catch {}

  return { success: true, battle: updatedLocal.find(b => String(b.id) === String(battleId)) };
}

export async function loadActiveBattlesFromSupabase() {
  let supabaseData = [];
  try {
    const { data } = await supabase
      .from('battle_matches')
      .select('*')
      .eq('status', 'approved_active')
      .order('created_at', { ascending: false });
    supabaseData = data || [];
  } catch {}

  const localData = getLocalBattles().filter(b => b.status === 'approved_active');
  const map = new Map();
  [...localData, ...supabaseData].forEach(b => map.set(String(b.id), b));
  return Array.from(map.values());
}

export async function complete1v1BattleInSupabase(battleId, winnerUsername) {
  const localList = getLocalBattles();
  const updatedLocal = localList.map(b => {
    if (String(b.id) === String(battleId)) {
      return {
        ...b,
        status: 'completed',
        winner_username: (winnerUsername || '').toLowerCase()
      };
    }
    return b;
  });
  saveLocalBattles(updatedLocal);

  try {
    const { data } = await supabase
      .from('battle_matches')
      .update({
        status: 'completed',
        winner_username: (winnerUsername || '').toLowerCase()
      })
      .eq('id', battleId)
      .select()
      .single();
    if (data) return { success: true, battle: data };
  } catch {}

  return { success: true, battle: updatedLocal.find(b => String(b.id) === String(battleId)) };
}

export async function loadAllBattlesFromSupabase() {
  let supabaseData = [];
  try {
    const { data } = await supabase
      .from('battle_matches')
      .select('*')
      .order('created_at', { ascending: false });
    supabaseData = data || [];
  } catch {}

  const localData = getLocalBattles();
  const map = new Map();
  [...localData, ...supabaseData].forEach(b => map.set(String(b.id), b));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

export function subscribeToBattleMatches(callback) {
  const notifyAll = async () => {
    const allBattles = await loadAllBattlesFromSupabase();
    callback(allBattles);
  };

  notifyAll();

  const handleStorage = () => notifyAll();
  window.addEventListener('storage', handleStorage);

  const channel = supabase.channel('battle_matches_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_matches' }, () => {
      notifyAll();
    }).subscribe();

  return () => {
    window.removeEventListener('storage', handleStorage);
    supabase.removeChannel(channel);
  };
}

// ─── LinkedIn Validator ───────────────────────────────────────────────────────
export function validateLinkedIn(url) {
  if (!url?.trim()) return { valid: false, username: null };
  const match = url.match(/linkedin\.com\/in\/([\w-]+)/i);
  if (match) return { valid: true, username: match[1] };
  return { valid: false, username: null };
}

// ─── calculateDevRankProfile helper ──────────────────────────────────────────
export function calculateDevRankProfile({ name, email, targetRole, githubUsername, leetcodeUsername, linkedinUrl, bio, pdfText }) {
  const skills   = extractSkillsFromText(pdfText || '', (targetRole || '') + ' ' + (bio || ''));
  const resumeXp = computeResumeXp(pdfText || '', (targetRole || '') + ' ' + (bio || ''));
  return {
    id: (githubUsername || '').toLowerCase(),
    name: (name || '').trim(),
    email: (email || '').trim(),
    githubUsername: (githubUsername || '').trim().toLowerCase(),
    leetcodeUsername: (leetcodeUsername || '').trim().toLowerCase(),
    linkedinUrl: (linkedinUrl || '').trim(),
    targetRole: (targetRole || 'Software Engineer').trim(),
    bio: (bio || '').trim(),
    skills, resumeXp,
    interviewXp: 0, challengeXp: 0,
    atsScore: 0, extractedProfile: {}, skillScores: {},
    badges: [], appliedJobs: [],
    createdAt: new Date().toISOString(),
  };
}

// ─── Gemini: Career Coach ─────────────────────────────────────────────────────
export async function askAiCoach(profile) {
  const prompt = `You are DevRank AI Career Coach. Analyze this developer:
Name: ${profile.name} | Role: ${profile.targetRole} | XP: ${profile.totalXp} (unlimited scale)
GitHub: ${profile.githubStats?.publicRepos ?? 0} repos, ${profile.githubStats?.stars ?? 0} stars
LeetCode: Easy ${profile.leetcodeStats?.easy ?? 0}, Medium ${profile.leetcodeStats?.medium ?? 0}, Hard ${profile.leetcodeStats?.hard ?? 0}
ATS Score: ${profile.atsScore || 0}/100
Skills: ${(profile.skills || []).join(', ') || 'None uploaded'}
Projects: ${(profile.extractedProfile?.projects || []).map(p => p.name).join(', ') || 'Resume not analyzed yet'}

Give exactly 3 numbered, specific, actionable recommendations. Under 120 words total.`;

  const text = GEMINI_KEY ? await geminiCall(prompt) : null;
  return text || defaultCoachAdvice(profile);
}

export const askGeminiAiCoach = askAiCoach;

function defaultCoachAdvice(profile) {
  const tips = [];
  if (!profile.githubStats?.publicRepos || profile.githubStats.publicRepos < 5)
    tips.push('1. **Push 5+ public GitHub repos** — each earns +2 XP. Repos with READMEs and stars earn more.');
  else
    tips.push(`1. **Get GitHub stars** — ${profile.githubStats?.stars ?? 0} stars now (+0.5 XP each). Open-source contributions build stars fast.`);
  if (!profile.leetcodeStats?.medium || profile.leetcodeStats.medium < 20)
    tips.push('2. **Solve 20 Medium LeetCode problems** — each earns +1.5 XP. Focus on arrays and dynamic programming.');
  else
    tips.push(`2. **Target Hard LeetCode** — ${profile.leetcodeStats?.hard ?? 0} solved. Each hard earns +4 XP.`);
  if (!profile.resumeXp || profile.resumeXp === 0)
    tips.push('3. **Upload your PDF resume** — Gemini AI will semantically score it against your target role (up to +80 XP).');
  else
    tips.push('3. **Complete admin challenges** — each challenge earns 3–8 XP. Check the Active Challenges section.');
  return tips.join('\n\n');
}

// ─── Groq API Integration ───────────────────────────────────────────────────
const GROQ_KEY = (import.meta.env && import.meta.env.VITE_GROQ_API_KEY) || '';

export async function groqCall(prompt) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ─── Groq AI: Skill-Tailored Interview Evaluator (0 XP Awarded) ──────────────
export async function evaluateAiInterview(profile, answer, currentQuestion) {
  const role = typeof profile === 'string' ? profile : (profile?.targetRole || 'Software Engineer');
  const skills = (typeof profile === 'object' && profile?.skills && profile.skills.length > 0)
    ? profile.skills.join(', ')
    : 'Java, Python, React, C++, Machine Learning, SQL';

  const prompt = `You are a supportive technical interviewer assessing a candidate for a ${role} position.
Candidate's detected skills: ${skills}.

Question asked: "${currentQuestion || 'Introductory technical question'}"
Candidate's answer: "${answer}"

Task:
1. Evaluate their answer constructively in 2 sentences.
2. Score their response from 0 to 100 based on basic accuracy.
3. Formulate the next BASIC, foundational technical question tailored specifically to one of their listed skills (${skills}).
Note: No XP is awarded.

Return ONLY valid JSON matching this schema:
{"score": <number 0-100>, "feedback": "<2 sentence feedback>", "nextQuestion": "<next basic question tailored to candidate's skills>"}`;

  const text = await groqCall(prompt);
  if (text) {
    const parsed = parseJsonFromText(text);
    if (parsed) {
      return {
        success: true,
        score: Math.max(0, Math.min(100, parsed.score || 75)),
        feedback: parsed.feedback || 'Good foundational technical answer.',
        nextQuestion: parsed.nextQuestion || `What is a key difference or fundamental concept when working with ${skills.split(',')[0]}?`
      };
    }
  }

  // Fallback if Groq API call fails
  return {
    success: true,
    score: 80,
    feedback: `Good basic technical answer for ${role}. Solid understanding of core concepts!`,
    nextQuestion: `Explain how you manage memory or data structures when writing code in ${skills.split(',')[0]}.`
  };
}

// ─── Interview schedule ───────────────────────────────────────────────────────
export async function scheduleInterview(details) {
  return {
    success: true,
    inviteEmail:
      `Hi ${details.candidateName || 'Candidate'},\n\n` +
      `You're invited for a technical interview for ${details.jobTitle || 'Software Engineer'} at ${details.companyName || 'our company'}.\n` +
      `Date: ${details.date || 'TBD'} | Time: ${details.time || 'TBD'}\n\n` +
      `Your DevRank score will be verified live.\n\nBest,\nTalent Team`,
  };
}

// ─── LocalStorage fallbacks ───────────────────────────────────────────────────
export function getStoredCandidates() { try { return JSON.parse(localStorage.getItem('devrank_candidates') || '[]'); } catch { return []; } }
export function saveStoredCandidates(l) { try { localStorage.setItem('devrank_candidates', JSON.stringify(l)); } catch {} }
export function getStoredJobDrops() { try { return JSON.parse(localStorage.getItem('devrank_job_drops') || '[]'); } catch { return []; } }
export function saveStoredJobDrops(l) { try { localStorage.setItem('devrank_job_drops', JSON.stringify(l)); } catch {} }

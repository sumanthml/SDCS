import React, { useState } from 'react';
import { X, User, Github, Code, FileText, Upload, Linkedin, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { playSound } from '../utils/audio';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import { parseGitHubUsername, parseLeetCodeUsername } from '../services/api';

export default function StudentProfileModal({ isOpen, onClose, onSaveProfile, currentUser, soundEnabled, showToast }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [targetRole, setTargetRole] = useState(currentUser?.targetRole || 'Software Engineer');
  const [githubUsername, setGithubUsername] = useState(currentUser?.githubUsername || '');
  const [leetcodeUsername, setLeetcodeUsername] = useState(currentUser?.leetcodeUsername || '');
  const [linkedinUrl, setLinkedinUrl] = useState(currentUser?.linkedinUrl || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setIsExtractingPdf(true);
    const extracted = await extractTextFromPdfFile(file);
    setPdfText(extracted);
    setIsExtractingPdf(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !githubUsername.trim()) {
      if (showToast) showToast('Please provide your Name and GitHub Username.', 'error');
      return;
    }

    playSound('click', soundEnabled);
    setIsSubmitting(true);

    let activePdfText = pdfText;
    if (pdfFile && !activePdfText) {
      activePdfText = await extractTextFromPdfFile(pdfFile);
      setPdfText(activePdfText);
    }

    const cleanGh = parseGitHubUsername(githubUsername);
    const cleanLc = parseLeetCodeUsername(leetcodeUsername);

    const result = await onSaveProfile({
      name,
      email,
      targetRole,
      githubUsername: cleanGh,
      leetcodeUsername: cleanLc,
      linkedinUrl: linkedinUrl.trim(),
      bio,
      pdfFile,
      pdfText: activePdfText
    });

    setIsSubmitting(false);

    if (result && result.error) {
      if (showToast) showToast(result.error, 'error');
    } else {
      playSound('levelup', soundEnabled);
      if (showToast) showToast('DevRank Profile & Gemini ATS Score Synced!', 'success');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-xl rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 sm:p-8 shadow-2xl shadow-cyan-500/20 text-slate-100 my-auto">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Student Live Profile Setup</h2>
              <p className="text-xs text-slate-400">Connect your real GitHub, LeetCode, and PDF resume</p>
            </div>
          </div>
          {currentUser && (
            <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Sumanth Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">Target Role *</label>
              <input
                type="text"
                placeholder="e.g. Full Stack Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <Github className="h-4 w-4" /> GitHub Username *
              </label>
              <input
                type="text"
                placeholder="e.g. torvalds, gaearon, or your_github"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cyan-500/30 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Verified via live GitHub REST API</p>
            </div>

            <div>
              <label className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Code className="h-4 w-4" /> LeetCode Username
              </label>
              <input
                type="text"
                placeholder="e.g. your_leetcode_username"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                className="mt-1 w-full rounded-xl border border-purple-500/30 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Verified via LeetCode API</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              <Linkedin className="h-4 w-4" /> LinkedIn Profile URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300">Short Bio / Headline</label>
            <input
              type="text"
              placeholder="e.g. CS student passionate about React and distributed systems."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* PDF Resume Dropzone */}
          <div className="rounded-2xl border border-dashed border-purple-500/40 bg-purple-950/20 p-4 text-center">
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-purple-300">
              <FileText className="h-4 w-4" />
              <span>Upload PDF Resume for Gemini AI Semantic ATS Match</span>
            </div>
            
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              id="pdf-upload"
              className="hidden"
            />
            <label
              htmlFor="pdf-upload"
              className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-purple-600/30 border border-purple-500/50 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-600/40 transition cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>{pdfFile ? pdfFile.name : 'Select Resume File (.pdf or .txt)'}</span>
            </label>
            {isExtractingPdf && (
              <div className="mt-2 text-xs text-purple-400 font-semibold flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting resume text...
              </div>
            )}
            {!isExtractingPdf && pdfText && (
              <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{pdfText.length} characters extracted — ready for Gemini AI ATS</span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !githubUsername.trim()}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 py-3.5 text-xs font-extrabold text-white shadow-xl shadow-cyan-500/25 hover:from-cyan-400 hover:to-purple-500 transition disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying GitHub & LeetCode Live APIs...' : 'Calculate & Sync My Real DevRank XP'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, Lock, Download, Check, Sparkles, FileText } from 'lucide-react';
import { playSound } from '../utils/audio';

const TEMPLATES = [
  { id: 1, name: 'Minimalist Tech ATS', reqXp: 0, description: 'Single column, high parser compatibility for Fortune 500 ATS systems.', badge: 'Free Standard Template' },
  { id: 2, name: 'Executive Developer ATS', reqXp: 50, description: 'Highlights verified GitHub stats, LeetCode rating, & top tech stack.', badge: 'Unlocked at 50 XP' },
  { id: 3, name: 'FAANG Lead Developer', reqXp: 150, description: 'Ultra premium multi-page layout with verified code proof QR links.', badge: 'Unlocked at 150 XP' }
];

export default function AtsResumeBuilderModal({ isOpen, onClose, currentUser, soundEnabled }) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const userXp = currentUser?.totalXp || 0;

  if (!isOpen) return null;

  const handleDownload = (t) => {
    playSound('click', soundEnabled);
    // Create printable resume snapshot
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>DevRank Verified Resume - ${currentUser.name}</title>
            <style>
              body { font-family: Inter, system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; line-height: 1.5; }
              h1 { font-size: 28px; margin-bottom: 4px; color: #0f172a; font-weight: 800; }
              .role { font-size: 15px; color: #4f46e5; font-weight: 700; margin-bottom: 16px; }
              .badge-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; margin-bottom: 24px; color: #166534; font-size: 13px; }
              .section { margin-bottom: 24px; }
              .section-title { font-size: 13px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
              ul { padding-left: 20px; margin: 6px 0; }
              li { margin-bottom: 6px; font-size: 13.5px; color: #334155; }
            </style>
          </head>
          <body>
            <h1>${currentUser.name}</h1>
            <div class="role">${currentUser.targetRole || 'Software Engineer'} | DevRank Verified Score: ${currentUser.totalXp} XP</div>
            <div class="badge-box">
              <strong>DevRank Verified Live Proof Summary:</strong> GitHub Repos: ${currentUser.githubStats?.publicRepos || 0} | Total Stars: ${currentUser.githubStats?.stars || 0} | LeetCode Solved: ${currentUser.leetcodeStats?.total || 0}
            </div>
            <div class="section">
              <div class="section-title">Verified Core Technical Skills</div>
              <p style="font-size: 13.5px; font-weight: 600; color: #1e293b;">${currentUser.skills?.join(' • ') || 'React • Node.js • TypeScript • SQL • Docker'}</p>
            </div>
            <div class="section">
              <div class="section-title">Top Verified GitHub Repositories</div>
              <ul>
                ${(currentUser.githubStats?.topRepos || []).map(r => `<li><strong>${r.name}</strong> (${r.language}) - ${r.description}</li>`).join('')}
              </ul>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-3xl rounded-3xl border border-indigo-200 bg-white p-6 sm:p-8 shadow-2xl shadow-indigo-500/10 text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                ATS Template Locker & Resume Builder
              </h2>
              <p className="text-xs text-slate-500 font-medium">Unlock high-converting ATS resume templates as your DevRank XP increases</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {TEMPLATES.map(t => {
            const isUnlocked = userXp >= t.reqXp;
            return (
              <div
                key={t.id}
                onClick={() => { if (isUnlocked) { setSelectedTemplate(t); playSound('click', soundEnabled); } }}
                className={`relative flex flex-col justify-between rounded-2xl p-5 border transition cursor-pointer ${
                  selectedTemplate.id === t.id && isUnlocked
                    ? 'border-indigo-500 bg-indigo-50/60 shadow-md font-bold'
                    : isUnlocked
                    ? 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">{t.name}</h3>
                    {isUnlocked ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Unlocked
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">{t.description}</p>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-600">{t.badge}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (isUnlocked) handleDownload(t); }}
                    disabled={!isUnlocked}
                    className="flex items-center space-x-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

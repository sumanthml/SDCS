import React, { useState } from 'react';
import { X, Building2, Plus, Loader2 } from 'lucide-react';
import { playSound } from '../utils/audio';
import { saveJobDropToSupabase } from '../services/api';

export default function CreateJobDropModal({ isOpen, onClose, onCreateDrop, soundEnabled }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    title: '',
    salary: '',
    location: '',
    reqXp: 100,
    reqLeetCode: 0,
    reqGithubRepos: 0,
    skills: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.title.trim()) return;
    setSaving(true);
    try {
      const drop = {
        id: `j_${Date.now()}`,
        companyName: formData.companyName.trim(),
        logo: '🚀',
        title: formData.title.trim(),
        location: formData.location.trim() || 'Remote',
        salary: formData.salary.trim() || 'Competitive',
        reqXp: Number(formData.reqXp) || 0,
        reqLeetCode: Number(formData.reqLeetCode) || 0,
        reqGithubRepos: Number(formData.reqGithubRepos) || 0,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        applicantsCount: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      await saveJobDropToSupabase(drop);
      playSound('success', soundEnabled);
      if (onCreateDrop) onCreateDrop(drop);
      setFormData({ companyName: '', title: '', salary: '', location: '', reqXp: 100, reqLeetCode: 0, reqGithubRepos: 0, skills: '' });
      onClose();
    } catch (err) {
      console.error('Failed to save job drop:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-950 p-6 shadow-2xl shadow-emerald-500/10 text-slate-100">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Publish New Job Drop</h2>
              <p className="text-xs text-slate-400">Set custom minimum eligibility thresholds for candidates</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-300">Company Name</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300">Role Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300">Salary Range</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300">Minimum DevRank XP</label>
              <input
                type="number"
                value={formData.reqXp}
                onChange={(e) => setFormData({ ...formData, reqXp: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-semibold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300">Required Skills (Comma separated)</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="mt-5 border-t border-slate-800 pt-3">
            <button
              type="submit"
              disabled={saving || !formData.companyName.trim() || !formData.title.trim()}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-bold text-white shadow-lg hover:from-emerald-400 hover:to-teal-500 transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{saving ? 'Publishing to Supabase...' : 'Publish Job Drop Live'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

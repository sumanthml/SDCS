import React, { useState } from 'react';
import { X, Bot, Sparkles, Send, Award, CheckCircle2, RefreshCw } from 'lucide-react';
import { askAiCoach, evaluateAiInterview } from '../services/api';
import { playSound } from '../utils/audio';

export default function AiInterviewDrawer({ isOpen, onClose, currentUser, soundEnabled, onAwardXp }) {
  const [tab, setTab] = useState('interview'); // 'interview' | 'coach'
  const [userAnswer, setUserAnswer] = useState('');
  const firstSkill = currentUser?.skills?.[0] || 'Software Engineering';
  const [interviewState, setInterviewState] = useState({
    currentQuestion: `Explain the core concepts and best practices when working with ${firstSkill} in a production environment.`,
    score: null,
    feedback: null,
    loading: false
  });
  const [coachingAdvice, setCoachingAdvice] = useState(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  if (!isOpen) return null;

  const handleInterviewSubmit = async (e) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    playSound('click', soundEnabled);
    setInterviewState(prev => ({ ...prev, loading: true }));

    const res = await evaluateAiInterview(currentUser, userAnswer, interviewState.currentQuestion);

    setInterviewState({
      currentQuestion: res.nextQuestion,
      score: res.score,
      feedback: res.feedback,
      loading: false
    });

    setUserAnswer('');
    playSound('success', soundEnabled);
    // 0 XP awarded as per requirements (purely for practice & knowledge check)
  };

  const handleFetchCoachAdvice = async () => {
    playSound('click', soundEnabled);
    setCoachingLoading(true);
    const advice = await askAiCoach({
      currentXP: currentUser?.totalXp || 750,
      foundSkills: currentUser?.skills || ['React', 'Node.js'],
      targetRole: currentUser?.targetRole || 'Full Stack Engineer'
    });
    setCoachingAdvice(advice);
    setCoachingLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm font-sans">
      <div className="relative w-full max-w-lg border-l border-indigo-200 bg-white p-6 text-slate-900 shadow-2xl flex flex-col h-full overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-md text-white">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                DevRank AI Intelligence <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-200">Groq Powered</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">AI Technical Interviewer & Personal Career Coach</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => { setTab('interview'); playSound('click', soundEnabled); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              tab === 'interview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Technical Interviewer
          </button>
          <button
            onClick={() => { setTab('coach'); playSound('click', soundEnabled); if (!coachingAdvice) handleFetchCoachAdvice(); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              tab === 'coach' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Career Coach
          </button>
        </div>

        {/* Tab Content: Interviewer */}
        {tab === 'interview' && (
          <div className="mt-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                  <span>Technical Scenario ({currentUser?.targetRole || 'Software Engineer'})</span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-900 leading-relaxed">
                  {interviewState.currentQuestion}
                </p>
              </div>

              {interviewState.score !== null && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Evaluation Scorecard
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-200">
                      {interviewState.score}/100 (Knowledge Practice)
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                    {interviewState.feedback}
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleInterviewSubmit} className="mt-6 space-y-3">
              <label className="text-xs font-bold text-slate-700">Your Technical Answer</label>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Explain your technical approach, code design, or architecture..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none resize-none shadow-sm"
              />
              <button
                type="submit"
                disabled={interviewState.loading || !userAnswer.trim()}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {interviewState.loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Submit Answer for AI Evaluation</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab Content: Career Coach */}
        {tab === 'coach' && (
          <div className="mt-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 flex items-center gap-1">
                    <Sparkles className="h-4 w-4" /> Customized Career Growth Roadmap
                  </span>
                  <button
                    onClick={handleFetchCoachAdvice}
                    disabled={coachingLoading}
                    className="flex items-center space-x-1 text-[11px] font-bold text-sky-600 hover:underline"
                  >
                    <RefreshCw className={`h-3 w-3 ${coachingLoading ? 'animate-spin' : ''}`} />
                    <span>Re-analyze</span>
                  </button>
                </div>

                {coachingLoading ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">Analyzing GitHub repos & LeetCode rating...</div>
                ) : (
                  <div className="mt-3 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-mono">
                    {coachingAdvice}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

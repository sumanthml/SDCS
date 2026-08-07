import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Zap, CheckCircle2, AlertCircle, Loader2, Tag, Send } from 'lucide-react';
import { submitChallengeAnswer } from '../services/api';

const DIFFICULTY_COLORS = {
  easy:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
  medium: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20' },
  hard:   { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',     badge: 'bg-rose-500/20' },
};

export default function ChallengeModal({ challenge, githubUsername, onClose, onXpEarned, alreadySubmitted }) {
  const [answer, setAnswer]         = useState('');
  const [timeLeft, setTimeLeft]     = useState(challenge?.time_limit_seconds || 300);
  const [submitted, setSubmitted]   = useState(alreadySubmitted || false);
  const [xpEarned, setXpEarned]     = useState(0);
  const [timedOut, setTimedOut]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const startTime                   = useRef(Date.now());
  const timerRef                    = useRef(null);

  useEffect(() => {
    if (submitted || timedOut) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimedOut(true);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [submitted, timedOut]);

  const handleAutoSubmit = async () => {
    clearInterval(timerRef.current);
    const taken = Math.round((Date.now() - startTime.current) / 1000);
    await submitChallengeAnswer({
      challengeId: challenge.id,
      githubUsername,
      answer: answer || '(Time expired — no answer submitted)',
      timeTakenSeconds: taken,
      xpEarned: 0,
    });
    setXpEarned(0);
    setSubmitted(true);
    setTimedOut(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!answer.trim()) return setError('Please write your answer before submitting.');
    clearInterval(timerRef.current);
    setSubmitting(true);
    const taken = Math.round((Date.now() - startTime.current) / 1000);
    const xp = challenge?.xp_reward || 5;
    const result = await submitChallengeAnswer({
      challengeId: challenge.id,
      githubUsername,
      answer: answer.trim(),
      timeTakenSeconds: taken,
      xpEarned: xp,
    });
    setSubmitting(false);
    if (result.success) {
      setXpEarned(xp);
      setSubmitted(true);
      if (onXpEarned) onXpEarned(xp);
    } else {
      setError(result.error || 'Submission failed. Try again.');
    }
  };

  const dc = DIFFICULTY_COLORS[challenge?.difficulty] || DIFFICULTY_COLORS.easy;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerPct = (timeLeft / (challenge?.time_limit_seconds || 300)) * 100;
  const timerColor = timerPct > 50 ? 'bg-emerald-500' : timerPct > 20 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onKeyDown={e => e.key === 'Escape' && !submitted && onClose()}>
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b border-slate-800 ${dc.bg} rounded-t-3xl`}>
          <div className="flex items-center space-x-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dc.badge} ${dc.text}`}>
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white">{challenge?.title}</div>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercase ${dc.text}`}>{challenge?.difficulty}</span>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] font-bold text-amber-400">+{challenge?.xp_reward} XP on submit</span>
              </div>
            </div>
          </div>

          {/* Live timer */}
          {!submitted && (
            <div className="flex flex-col items-end">
              <div className={`font-mono text-xl font-black ${timeLeft <= 30 ? 'text-rose-400 animate-pulse' : timeLeft <= 60 ? 'text-amber-400' : 'text-white'}`}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
              <div className="w-24 h-1.5 rounded-full bg-slate-800 mt-1 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${timerColor}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          )}

          <button onClick={onClose} className="ml-3 rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Problem Statement */}
          <div className={`rounded-2xl border ${dc.border} bg-slate-900/60 p-4`}>
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Problem Statement
            </div>
            <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{challenge?.description}</pre>
            {(challenge?.tags || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(challenge.tags || []).map(t => (
                  <span key={t} className="flex items-center gap-0.5 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                    <Tag className="h-2.5 w-2.5" />{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Already submitted or timed out */}
          {submitted ? (
            <div className={`rounded-2xl border p-6 text-center ${timedOut && xpEarned === 0 ? 'border-rose-500/40 bg-rose-950/20' : 'border-emerald-500/40 bg-emerald-950/20'}`}>
              {timedOut && xpEarned === 0 ? (
                <>
                  <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
                  <div className="mt-3 text-base font-bold text-white">Time Expired!</div>
                  <div className="text-xs text-slate-400 mt-1">0 XP earned — answer not submitted in time.</div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                  <div className="mt-3 text-base font-bold text-white">Challenge Submitted!</div>
                  <div className="text-2xl font-black text-amber-400 mt-2">+{xpEarned} XP Earned</div>
                  <div className="text-xs text-slate-400 mt-1">XP added to your DevRank score.</div>
                </>
              )}
              <button onClick={onClose} className="mt-5 rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
                Close
              </button>
            </div>
          ) : alreadySubmitted ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <div className="mt-3 text-base font-bold text-white">Already Completed</div>
              <div className="text-xs text-slate-400 mt-1">You've already submitted this challenge.</div>
              <button onClick={onClose} className="mt-5 rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">Close</button>
            </div>
          ) : (
            /* Answer form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start space-x-2 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-300">Your Answer / Solution</label>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-2">Write your approach, pseudo-code, or actual code. Be specific — explain your logic clearly.</p>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  rows={8}
                  placeholder="Write your solution here...

Example:
1. Start with approach description
2. Walk through your logic step by step
3. Mention time/space complexity
4. Write the code if needed"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-white focus:border-cyan-500 focus:outline-none resize-none font-mono"
                />
              </div>
              <button type="submit" disabled={submitting || !answer.trim()}
                className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{submitting ? 'Submitting...' : `Submit Answer (+${challenge?.xp_reward || 5} XP)`}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

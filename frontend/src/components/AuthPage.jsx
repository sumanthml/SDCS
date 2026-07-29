import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Factory, Zap, Lock, Mail, User, ShieldCheck, Cpu } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'Planner' });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password);
        if (error) throw error;
        toast('Welcome back! Loading your dashboard…', 'success');
      } else {
        const { error } = await signUp(form.email, form.password, form.fullName, form.role);
        if (error) throw error;
        toast('Account created! Check your email to confirm.', 'success');
      }
    } catch (err) {
      toast(err.message || 'Authentication failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card animate-in">
        {/* Logo */}
        <div className="flex items-center gap-sm" style={{ marginBottom: '2rem' }}>
          <div className="sidebar-logo-icon">
            <Factory size={20} color="#fff" />
          </div>
          <div>
            <div className="font-display fw-700" style={{ fontSize: '1.2rem' }}>ShopFlowAI</div>
            <div className="text-xs text-muted">Smart Manufacturing Scheduler</div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex gap-xs" style={{ flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {['FCFS', 'SPT', 'CP-SAT', 'AI Analysis'].map(feat => (
            <span key={feat} className="badge badge-info">{feat}</span>
          ))}
        </div>

        <h2 style={{ marginBottom: '0.5rem' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="text-sm text-secondary" style={{ marginBottom: '1.5rem' }}>
          {mode === 'login'
            ? 'Sign in to access your shop-floor scheduling dashboard.'
            : 'Set up your account and start optimizing your manufacturing floor.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="auth-fullname">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)', pointerEvents: 'none' }} />
                <input id="auth-fullname" name="fullName" type="text" required placeholder="Jane Doe"
                  value={form.fullName} onChange={handleChange}
                  style={{ paddingLeft: '36px' }} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)', pointerEvents: 'none' }} />
              <input id="auth-email" name="email" type="email" required placeholder="you@company.com"
                value={form.email} onChange={handleChange}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)', pointerEvents: 'none' }} />
              <input id="auth-password" name="password" type="password" required placeholder="••••••••"
                value={form.password} onChange={handleChange} minLength={6}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="auth-role">Your Role</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)', pointerEvents: 'none' }} />
                <select id="auth-role" name="role" value={form.role} onChange={handleChange}
                  style={{ paddingLeft: '36px' }}>
                  <option value="Planner">Shop Floor Planner (Operator)</option>
                  <option value="Manager">Plant Manager (Admin)</option>
                </select>
              </div>
            </div>
          )}

          <button id="auth-submit-btn" type="submit" className="btn btn-primary btn-lg w-full"
            disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing…</>
            ) : (
              <><Zap size={16} /> {mode === 'login' ? 'Sign In' : 'Create Account'}</>
            )}
          </button>
        </form>

        <div className="divider" style={{ marginTop: '1.5rem' }} />

        <p className="text-sm text-center text-secondary">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            id="auth-toggle-mode"
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{ color: 'var(--clr-indigo-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            {mode === 'login' ? 'Create account →' : '← Sign in'}
          </button>
        </p>

        <div className="flex items-center gap-xs" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
          <Cpu size={12} style={{ color: 'var(--clr-text-muted)' }} />
          <span className="text-xs text-muted">Powered by Google OR-Tools CP-SAT & Groq AI</span>
        </div>
      </div>
    </div>
  );
}

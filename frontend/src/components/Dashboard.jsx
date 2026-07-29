import { Factory, BarChart3, Activity, Clock, Cpu, Zap, ArrowRight } from 'lucide-react';

export default function Dashboard({ machines, jobs, simResults, onNavigate }) {
  const totalJobs = jobs.length;
  const activeMachines = machines.filter(m => m.status === 'Active').length;
  const totalOps = jobs.reduce((s, j) => s + (j.operations?.length || 0), 0);
  const hasResults = simResults && Object.keys(simResults).length > 0;
  const bestAlgo = hasResults ? Object.keys(simResults).reduce((best, k) =>
    simResults[k].makespan < simResults[best].makespan ? k : best, Object.keys(simResults)[0]) : null;

  const quickActions = [
    { icon: <Factory size={18} />, label: 'Configure Machines', page: 'machines', color: 'var(--clr-indigo)' },
    { icon: <Activity size={18} />, label: 'Build Jobs', page: 'jobs', color: 'var(--clr-cyan)' },
    { icon: <Zap size={18} />, label: 'Run Simulation', page: 'simulate', color: 'var(--clr-violet)' },
    { icon: <Cpu size={18} />, label: 'AI Analysis', page: 'ai', color: 'var(--clr-success)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
      {/* Welcome */}
      <div className="glass-card" style={{ padding: 'var(--sp-xl)', background: 'linear-gradient(135deg, hsla(243,75%,59%,0.12) 0%, hsla(270,72%,62%,0.08) 100%)', borderColor: 'var(--clr-border-glow)' }}>
        <div className="flex items-center gap-md" style={{ marginBottom: 'var(--sp-md)' }}>
          <div className="sidebar-logo-icon" style={{ width: 48, height: 48 }}>
            <Factory size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ marginBottom: 2 }}>ShopFlowAI Dashboard</h2>
            <p className="text-sm text-secondary">Intelligent Smart Manufacturing Job Scheduling & Optimization Simulator</p>
          </div>
        </div>
        <div className="grid-4" style={{ gap: 'var(--sp-sm)' }}>
          {[
            { label: 'Active Machines', value: activeMachines, total: machines.length, icon: '⚙' },
            { label: 'Job Orders', value: totalJobs, icon: '📋' },
            { label: 'Operations', value: totalOps, icon: '🔗' },
            { label: 'Algorithms Run', value: hasResults ? Object.keys(simResults).length : 0, icon: '🧮' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', padding: 'var(--sp-md)', background: 'var(--clr-bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 2 }}>{stat.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--clr-indigo-light)' }}>{stat.value}</div>
              <div className="text-xs text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div className="section-title">Quick Actions</div>
        <div className="grid-4">
          {quickActions.map(action => (
            <button
              key={action.page}
              id={`dash-nav-${action.page}`}
              className="glass-card"
              onClick={() => onNavigate(action.page)}
              style={{ padding: 'var(--sp-lg)', cursor: 'pointer', border: 'none', textAlign: 'left', transition: 'var(--transition-normal)' }}
            >
              <div style={{ color: action.color, marginBottom: 'var(--sp-sm)' }}>{action.icon}</div>
              <div className="fw-600" style={{ fontFamily: 'var(--font-display)', marginBottom: 2 }}>{action.label}</div>
              <div className="flex items-center gap-xs" style={{ color: action.color, fontSize: '0.78rem', fontWeight: 600, marginTop: 6 }}>
                Go <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Latest results snapshot */}
      {hasResults && (
        <div>
          <div className="section-title">Latest Simulation Snapshot</div>
          <div className="grid-3" style={{ gap: 'var(--sp-sm)' }}>
            {Object.entries(simResults).map(([algo, res]) => (
              <div key={algo} className="glass-card" style={{ padding: 'var(--sp-md)', borderColor: algo === bestAlgo ? 'var(--clr-indigo)' : 'var(--clr-border)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span className="fw-600 font-display" style={{ fontSize: '0.9rem' }}>{algo}</span>
                  {algo === bestAlgo && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>BEST</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--clr-indigo-light)' }}>
                  {res.makespan} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--clr-text-muted)' }}>min</span>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Bottleneck: {res.bottleneck_machine || 'N/A'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--sp-md)', textAlign: 'right' }}>
            <button id="dash-view-results" className="btn btn-primary btn-sm" onClick={() => onNavigate('results')}>
              View Full Results & Gantt <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Getting started checklist */}
      {!hasResults && (
        <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
          <div className="section-title">Getting Started</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {[
              { step: 1, done: activeMachines > 0, label: 'Add at least one active machine', page: 'machines' },
              { step: 2, done: totalJobs > 0, label: 'Create job orders with operations', page: 'jobs' },
              { step: 3, done: false, label: 'Run simulation to compare algorithms', page: 'simulate' },
              { step: 4, done: false, label: 'Analyze results with AI', page: 'ai' },
            ].map(step => (
              <div key={step.step}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: 'var(--sp-sm) var(--sp-md)', borderRadius: 'var(--radius-sm)', background: step.done ? 'var(--clr-success-dim)' : 'var(--clr-bg-elevated)', cursor: 'pointer' }}
                onClick={() => onNavigate(step.page)}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step.done ? 'var(--clr-success)' : 'var(--clr-bg-glass)', border: `2px solid ${step.done ? 'var(--clr-success)' : 'var(--clr-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: step.done ? '#fff' : 'var(--clr-text-muted)', flexShrink: 0 }}>
                  {step.done ? '✓' : step.step}
                </div>
                <span style={{ fontSize: '0.875rem', color: step.done ? 'var(--clr-success)' : 'var(--clr-text-secondary)', textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </span>
                {!step.done && <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--clr-text-muted)' }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

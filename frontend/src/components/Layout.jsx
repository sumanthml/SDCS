import { useAuth } from '../context/AuthContext';
import {
  Factory, LayoutDashboard, Cog, BriefcaseBusiness,
  FlaskConical, BarChart3, Cpu, LogOut, ChevronRight,
  Shield, TrendingUp, Database, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';

const PLANNER_NAV = [
  { id: 'dashboard',   label: 'Dashboard',          icon: LayoutDashboard, section: 'Overview' },
  { id: 'machines',    label: 'Machines',            icon: Cog,             section: 'Setup' },
  { id: 'jobs',        label: 'Jobs & Operations',   icon: BriefcaseBusiness, section: 'Setup' },
  { id: 'simulate',    label: 'Run Simulation',      icon: FlaskConical,    section: 'Simulate' },
  { id: 'results',     label: 'Results & Gantt',     icon: BarChart3,       section: 'Simulate' },
  { id: 'ai',          label: 'AI Analyst',          icon: Cpu,             section: 'Intelligence' },
];

const MANAGER_NAV = [
  { id: 'dashboard',   label: 'Overview',            icon: LayoutDashboard, section: 'Overview' },
  { id: 'analytics',   label: 'Analytics',           icon: TrendingUp,      section: 'Reports' },
  { id: 'history',     label: 'Simulation History',  icon: Database,        section: 'Reports' },
  { id: 'machines',    label: 'Fleet Status',        icon: Cog,             section: 'Operations' },
  { id: 'simulate',    label: 'Run Simulation',      icon: FlaskConical,    section: 'Operations' },
  { id: 'results',     label: 'Results & Gantt',     icon: BarChart3,       section: 'Operations' },
  { id: 'ai',          label: 'AI Analyst',          icon: Cpu,             section: 'Intelligence' },
];

export default function Layout({ children, activePage, onNavigate, backendOnline }) {
  const { profile, signOut, updateRole } = useAuth();
  const isManager = profile?.role === 'Manager';
  const navItems  = isManager ? MANAGER_NAV : PLANNER_NAV;
  const sections  = [...new Set(navItems.map(n => n.section))];

  const roleColor = isManager ? 'var(--clr-violet)' : 'var(--clr-indigo-light)';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Factory size={20} color="#fff" />
          </div>
          <div>
            <div className="sidebar-logo-text">ShopFlowAI</div>
            <div className="sidebar-logo-sub">Scheduling Optimizer v2</div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            background: isManager ? 'hsla(270,72%,62%,0.12)' : 'var(--clr-indigo-dim)',
            border: `1px solid ${isManager ? 'hsla(270,72%,62%,0.3)' : 'var(--clr-border-glow)'}`,
          }}>
            <Shield size={11} style={{ color: roleColor }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: roleColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {isManager ? 'Plant Manager' : 'Shop Floor Planner'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {navItems.filter(n => n.section === section).map(item => (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  aria-current={activePage === item.id ? 'page' : undefined}
                >
                  <item.icon size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {activePage === item.id && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Backend status indicator */}
        <div style={{ padding: '8px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            background: backendOnline ? 'var(--clr-success-dim)' : 'var(--clr-danger-dim)',
            border: `1px solid ${backendOnline ? 'hsla(152,69%,46%,0.3)' : 'hsla(355,80%,60%,0.3)'}`,
          }}>
            {backendOnline
              ? <Wifi size={11} style={{ color: 'var(--clr-success)' }} />
              : <WifiOff size={11} style={{ color: 'var(--clr-danger)' }} />
            }
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: backendOnline ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
              API {backendOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        {/* User profile */}
        <div style={{ padding: 'var(--sp-md)', borderTop: '1px solid var(--clr-border)' }}>
          <div className="glass-card" style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
            <div className="flex items-center gap-sm">
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${isManager ? 'var(--clr-violet)' : 'var(--clr-indigo)'}, ${isManager ? 'hsl(320,70%,58%)' : 'var(--clr-cyan)'})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 700, color: '#fff',
              }}>
                {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                </div>
                <button
                  title="Click to switch role"
                  onClick={() => updateRole(isManager ? 'Planner' : 'Manager')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.68rem', color: roleColor, fontWeight: 600 }}
                >
                  Switch → {isManager ? 'Planner' : 'Manager'}
                </button>
              </div>
              <button id="nav-signout" className="btn btn-secondary btn-icon"
                onClick={signOut} title="Sign out" style={{ width: 30, height: 30 }}>
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="flex items-center gap-sm">
            {(() => {
              const item = [...PLANNER_NAV, ...MANAGER_NAV].find(n => n.id === activePage);
              return item ? <><item.icon size={16} style={{ color: 'var(--clr-indigo)' }} /><span className="font-display fw-600" style={{ fontSize: '0.9rem' }}>{item.label}</span></> : null;
            })()}
          </div>
          <div className="flex items-center gap-sm">
            {!backendOnline && (
              <span className="badge badge-danger">
                <AlertTriangle size={10} /> Backend Offline
              </span>
            )}
            <span className={`badge ${backendOnline ? 'badge-success' : 'badge-warning'}`}>
              <span className={`status-dot ${backendOnline ? 'active' : 'maintenance'}`} />
              {isManager ? 'Manager View' : 'Planner View'}
            </span>
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

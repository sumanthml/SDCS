import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import './index.css';
import './firebaseClient.js';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import AuthPage       from './components/AuthPage';
import Layout         from './components/Layout';
import Dashboard      from './components/Dashboard';
import MachineBuilder from './components/MachineBuilder';
import JobBuilder     from './components/JobBuilder';
import SimulationPanel from './components/SimulationPanel';
import ResultsView    from './components/ResultsView';
import AiAnalystPanel from './components/AiAnalystPanel';
import DisruptionPanel from './components/DisruptionPanel';
import AnalyticsPage  from './components/AnalyticsPage';
import HistoryPage    from './components/HistoryPage';

// ─── localStorage helpers ─────────────────────────────────────
const persist  = (key, val)  => { try { localStorage.setItem(`shopflow_${key}`, JSON.stringify(val)); } catch (_) {} };
const retrieve = (key, def)  => { try { return JSON.parse(localStorage.getItem(`shopflow_${key}`)) ?? def; } catch { return def; } };

// ─── Backend health polling ───────────────────────────────────
function useBackendHealth() {
  const [online, setOnline] = useState(false);
  const check = useCallback(async () => {
    try { await api.health(); setOnline(true); } catch { setOnline(false); }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [check]);

  return online;
}

// ─── App content ─────────────────────────────────────────────
function AppContent() {
  const { user, loading, profile } = useAuth();
  const backendOnline = useBackendHealth();
  const [page, setPage] = useState('dashboard');

  // Core application state — persisted in localStorage
  const [machines, setMachines]         = useState(() => retrieve('machines', []));
  const [jobs, setJobs]                 = useState(() => retrieve('jobs', []));
  const [disruptions, setDisruptions]   = useState({ downtime_events: [], emergency_jobs: [] });
  const [simResults, setSimResults]     = useState(() => retrieve('last_results', null));
  const [bestAlgorithm, setBestAlgo]    = useState(() => retrieve('best_algo', null));

  // Auto-persist on state changes
  useEffect(() => persist('machines', machines),      [machines]);
  useEffect(() => persist('jobs', jobs),              [jobs]);
  useEffect(() => persist('last_results', simResults), [simResults]);
  useEffect(() => persist('best_algo', bestAlgorithm), [bestAlgorithm]);

  const handleResults = useCallback((data) => {
    setSimResults(data.results);
    setBestAlgo(data.best_algorithm);
    setPage('results');
  }, []);

  // ── Loading screen
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div className="sidebar-logo-icon" style={{ width: 52, height: 52 }}>
        <span style={{ fontSize: '1.4rem' }}>🏭</span>
      </div>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <p className="text-secondary text-sm">Loading ShopFlowAI…</p>
    </div>
  );

  if (!user) return <AuthPage />;

  const renderPage = () => {
    const isManager = profile?.role === 'Manager';
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            machines={machines} jobs={jobs} simResults={simResults}
            backendOnline={backendOnline} isManager={isManager}
            onNavigate={setPage}
          />
        );
      case 'machines':
        return <MachineBuilder machines={machines} onChange={setMachines} />;

      case 'jobs':
        return <JobBuilder jobs={jobs} machines={machines} onChange={setJobs} />;

      case 'simulate':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
            <SimulationPanel
              machines={machines} jobs={jobs} disruptions={disruptions}
              backendOnline={backendOnline} onResults={handleResults}
            />
            <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
              <h4 style={{ marginBottom: 'var(--sp-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚡ What-If Disruption Scenarios
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Optional</span>
              </h4>
              <DisruptionPanel machines={machines} disruptions={disruptions} onChange={setDisruptions} />
            </div>
          </div>
        );

      case 'results':
        return (
          <ResultsView
            results={simResults} bestAlgorithm={bestAlgorithm}
            onNavigate={setPage}
          />
        );

      case 'ai':
        return <AiAnalystPanel results={simResults} bestAlgorithm={bestAlgorithm} backendOnline={backendOnline} />;

      case 'analytics':
        return isManager ? <AnalyticsPage /> : <Dashboard machines={machines} jobs={jobs} simResults={simResults} backendOnline={backendOnline} isManager={false} onNavigate={setPage} />;

      case 'history':
        return <HistoryPage />;

      default:
        return <Dashboard machines={machines} jobs={jobs} simResults={simResults} backendOnline={backendOnline} isManager={isManager} onNavigate={setPage} />;
    }
  };

  return (
    <Layout activePage={page} onNavigate={setPage} backendOnline={backendOnline}>
      <div className="animate-in" key={page}>
        {renderPage()}
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

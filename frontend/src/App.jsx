import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import './index.css';
import './firebaseClient.js';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { supabase, isSupabaseEnabled } from './supabaseClient';

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
  const toast = useToast();
  const backendOnline = useBackendHealth();
  const [page, setPage] = useState('dashboard');

  // Core application state
  const [machines, setMachines]         = useState(() => retrieve('machines', []));
  const [jobs, setJobs]                 = useState(() => retrieve('jobs', []));
  const [disruptions, setDisruptions]   = useState({ downtime_events: [], emergency_jobs: [] });
  const [simResults, setSimResults]     = useState(() => retrieve('last_results', null));
  const [bestAlgorithm, setBestAlgo]    = useState(() => retrieve('best_algo', null));

  // Sync state with cloud when user logs in
  useEffect(() => {
    if (!user) {
      setMachines(retrieve('machines', []));
      setJobs(retrieve('jobs', []));
      return;
    }

    if (!isSupabaseEnabled) return;

    const loadUserData = async () => {
      try {
        // 1. Fetch machines
        const { data: dbMachines, error: mErr } = await supabase
          .from('machines')
          .select('*')
          .eq('user_id', user.id);
        if (mErr) throw mErr;

        const mappedMachines = (dbMachines || []).map(m => ({
          machine_id: m.id,
          machine_code: m.machine_code,
          name: m.name,
          status: m.status,
          shift_hours: m.shift_hours
        }));

        // 2. Fetch jobs
        const { data: dbJobs, error: jErr } = await supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id);
        if (jErr) throw jErr;

        // 3. Fetch operations
        const jobIds = (dbJobs || []).map(j => j.id);
        let mappedJobs = [];

        if (jobIds.length > 0) {
          const { data: dbOps, error: oErr } = await supabase
            .from('job_operations')
            .select('*')
            .in('job_id', jobIds);
          if (oErr) throw oErr;

          mappedJobs = (dbJobs || []).map(j => {
            const ops = (dbOps || [])
              .filter(op => op.job_id === j.id)
              .map(op => {
                const mach = mappedMachines.find(m => m.machine_id === op.machine_id);
                return {
                  step_number: op.step_number,
                  machine_id: op.machine_id,
                  machine_name: mach ? mach.name : '',
                  duration_mins: op.duration_mins
                };
              })
              .sort((a, b) => a.step_number - b.step_number);

            return {
              job_id: j.id,
              job_name: j.job_name,
              priority: j.priority,
              arrival_time: j.arrival_time,
              due_date: j.due_date,
              operations: ops
            };
          });
        }

        setMachines(mappedMachines);
        setJobs(mappedJobs);
        persist('machines', mappedMachines);
        persist('jobs', mappedJobs);
      } catch (e) {
        console.warn('[Supabase Sync Load] Failed:', e.message);
      }
    };

    loadUserData();
  }, [user]);

  // Auto-persist local changes
  useEffect(() => persist('last_results', simResults), [simResults]);
  useEffect(() => persist('best_algo', bestAlgorithm), [bestAlgorithm]);

  // Cloud Save for Machines
  const saveMachines = async (updatedMachines) => {
    if (!user) return;
    if (!isSupabaseEnabled) {
      setMachines(updatedMachines);
      persist('machines', updatedMachines);
      toast('Saved locally (Offline mode)', 'success');
      return;
    }

    try {
      const dbRows = updatedMachines.map(m => {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.machine_id);
        const id = isValidUuid ? m.machine_id : crypto.randomUUID();
        return {
          id,
          user_id: user.id,
          machine_code: m.machine_code,
          name: m.name,
          status: m.status,
          shift_hours: m.shift_hours
        };
      });

      const localIds = dbRows.map(r => r.id);

      // 1. Delete removed machines
      if (localIds.length > 0) {
        await supabase
          .from('machines')
          .delete()
          .eq('user_id', user.id)
          .not('id', 'in', `(${localIds.map(x => `'${x}'`).join(',')})`);
      } else {
        await supabase
          .from('machines')
          .delete()
          .eq('user_id', user.id);
      }

      // 2. Upsert machines
      if (dbRows.length > 0) {
        const { error } = await supabase
          .from('machines')
          .upsert(dbRows, { onConflict: 'id' });
        if (error) throw error;
      }

      const newLocalMachines = updatedMachines.map((m, idx) => ({
        ...m,
        machine_id: dbRows[idx].id
      }));

      setMachines(newLocalMachines);
      persist('machines', newLocalMachines);
      toast('Fleet status synchronized with cloud!', 'success');
    } catch (e) {
      toast(`Cloud save failed: ${e.message}`, 'error');
    }
  };

  // Cloud Save for Jobs
  const saveJobs = async (updatedJobs) => {
    if (!user) return;
    if (!isSupabaseEnabled) {
      setJobs(updatedJobs);
      persist('jobs', updatedJobs);
      toast('Saved locally (Offline mode)', 'success');
      return;
    }

    try {
      const dbJobs = updatedJobs.map(j => {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(j.job_id);
        const id = isValidUuid ? j.job_id : crypto.randomUUID();
        return {
          id,
          user_id: user.id,
          job_name: j.job_name,
          priority: j.priority,
          arrival_time: j.arrival_time,
          due_date: j.due_date || null
        };
      });

      const localJobIds = dbJobs.map(r => r.id);

      // 1. Delete removed jobs
      if (localJobIds.length > 0) {
        await supabase
          .from('jobs')
          .delete()
          .eq('user_id', user.id)
          .not('id', 'in', `(${localJobIds.map(x => `'${x}'`).join(',')})`);
      } else {
        await supabase
          .from('jobs')
          .delete()
          .eq('user_id', user.id);
      }

      // 2. Upsert jobs
      if (dbJobs.length > 0) {
        const { error: jErr } = await supabase
          .from('jobs')
          .upsert(dbJobs, { onConflict: 'id' });
        if (jErr) throw jErr;

        // 3. Clear existing operations for these jobs to rebuild
        await supabase
          .from('job_operations')
          .delete()
          .in('job_id', localJobIds);

        // 4. Build operation rows
        const dbOps = [];
        updatedJobs.forEach((j, idx) => {
          const jobId = dbJobs[idx].id;
          (j.operations || []).forEach(op => {
            dbOps.push({
              job_id: jobId,
              machine_id: op.machine_id,
              step_number: op.step_number,
              duration_mins: op.duration_mins
            });
          });
        });

        // 5. Insert operations
        if (dbOps.length > 0) {
          const { error: oErr } = await supabase
            .from('job_operations')
            .insert(dbOps);
          if (oErr) throw oErr;
        }
      }

      const newLocalJobs = updatedJobs.map((j, idx) => ({
        ...j,
        job_id: dbJobs[idx].id
      }));

      setJobs(newLocalJobs);
      persist('jobs', newLocalJobs);
      toast('Jobs synchronized with cloud!', 'success');
    } catch (e) {
      toast(`Cloud save failed: ${e.message}`, 'error');
    }
  };

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
        return <MachineBuilder machines={machines} onChange={setMachines} onSave={saveMachines} />;

      case 'jobs':
        return <JobBuilder jobs={jobs} machines={machines} onChange={setJobs} onSave={saveJobs} />;

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

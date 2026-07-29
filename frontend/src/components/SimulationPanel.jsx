import { useState } from 'react';
import { FlaskConical, PlayCircle, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { supabase, isSupabaseEnabled } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const ALGORITHMS = [
  { id: 'FCFS',     label: 'First-Come First-Served', desc: 'Sequence by arrival time — simple and fair',          color: 'var(--clr-info)'    },
  { id: 'SPT',      label: 'Shortest Processing Time', desc: 'Min avg flow time by prioritizing short ops',          color: 'var(--clr-success)' },
  { id: 'Priority', label: 'Priority Dispatching',     desc: 'Customer priority rating (1–5) drives order',         color: 'var(--clr-warning)' },
  { id: 'CP-SAT',   label: 'CP-SAT Optimal Solver',   desc: 'Google OR-Tools: mathematical minimum makespan (≤15s)', color: 'var(--clr-violet)' },
];

export default function SimulationPanel({ machines, jobs, disruptions, onResults, backendOnline }) {
  const { user } = useAuth();
  const toast = useToast();
  const [selectedAlgos, setSelectedAlgos] = useState(['FCFS', 'SPT', 'Priority', 'CP-SAT']);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [pct, setPct] = useState(0);

  const toggleAlgo = (id) =>
    setSelectedAlgos(p => p.includes(id) ? p.filter(a => a !== id) : [...p, id]);

  const activeMachines = machines.filter(m => m.status === 'Active');
  const totalOps = jobs.reduce((s, j) => s + (j.operations?.length || 0), 0);

  const validate = () => {
    if (!activeMachines.length)     { toast('No active machines configured.', 'error'); return false; }
    if (!jobs.length)               { toast('No jobs added yet.', 'error'); return false; }
    if (!selectedAlgos.length)      { toast('Select at least one algorithm.', 'error'); return false; }
    if (!backendOnline)             { toast('Backend is offline. Start it with: uvicorn main:app --port 8000', 'error'); return false; }

    for (const j of jobs) {
      if (!j.job_name?.trim())      { toast(`Job has no name.`, 'error'); return false; }
      if (!j.operations?.length)    { toast(`Job "${j.job_name}" has no operations.`, 'error'); return false; }
      for (const op of j.operations) {
        if (!op.machine_id)         { toast(`Job "${j.job_name}" step ${op.step_number} has no machine.`, 'error'); return false; }
        if (!(op.duration_mins > 0)){ toast(`Job "${j.job_name}" step ${op.step_number} duration must be > 0.`, 'error'); return false; }
        if (!activeMachines.find(m => m.machine_id === op.machine_id)) {
          toast(`Job "${j.job_name}" step ${op.step_number} uses an inactive/unknown machine.`, 'error');
          return false;
        }
      }
    }
    return true;
  };

  const saveToSupabase = async (results, bestAlgo) => {
    const userId = user?.id;
    if (!userId) return;
    try {
      const best = results[bestAlgo];
      const utilMap = {};
      (best.machine_metrics || []).forEach(m => { utilMap[m.machine_id] = m.utilization_pct; });

      const record = {
        user_id: userId,
        algorithm_used: bestAlgo,
        makespan: best.makespan,
        avg_flow_time: best.avg_flow_time,
        total_idle_time: best.total_idle_time,
        machine_utilization: utilMap,
        schedule_logs: best.schedule,
        bottleneck_machine_id: best.bottleneck_machine,
        disruptions: disruptions,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseEnabled) {
        await supabase.from('simulation_runs').insert(record);
      } else {
        // Mock: save to localStorage
        const history = JSON.parse(localStorage.getItem('shopflow_sim_history') || '[]');
        history.unshift({ id: `local-${Date.now()}`, ...record });
        localStorage.setItem('shopflow_sim_history', JSON.stringify(history.slice(0, 50)));
      }
    } catch (e) {
      console.warn('[Supabase] Failed to save run:', e.message);
    }
  };

  const run = async () => {
    if (!validate()) return;
    setLoading(true); setPct(5); setStep('Validating inputs…');

    const payload = {
      machines: activeMachines.map(m => ({
        machine_id: m.machine_id,
        machine_code: m.machine_code,
        name: m.name,
        status: m.status,
        shift_hours: m.shift_hours,
      })),
      jobs: jobs.map(j => ({
        job_id: j.job_id,
        job_name: j.job_name.trim(),
        priority: j.priority || 3,
        arrival_time: parseFloat(j.arrival_time) || 0,
        due_date: j.due_date ? parseFloat(j.due_date) : null,
        operations: [...(j.operations || [])].sort((a, b) => a.step_number - b.step_number).map(op => ({
          step_number: op.step_number,
          machine_id: op.machine_id,
          machine_name: op.machine_name || activeMachines.find(m => m.machine_id === op.machine_id)?.name || '',
          duration_mins: parseFloat(op.duration_mins) || 1,
        })),
      })),
      algorithms: selectedAlgos,
      downtime_events: (disruptions?.downtime_events || [])
        .filter(d => d.machine_id && d.start_time !== '' && d.end_time !== '' && parseFloat(d.end_time) > parseFloat(d.start_time))
        .map(d => ({ machine_id: d.machine_id, start_time: parseFloat(d.start_time), end_time: parseFloat(d.end_time) })),
      emergency_jobs: (disruptions?.emergency_jobs || [])
        .filter(e => e.job?.job_name?.trim() && e.job?.operations?.[0]?.machine_id)
        .map(e => ({ job: e.job, insert_at_time: parseFloat(e.insert_at_time) || 0 })),
    };

    try {
      setPct(20); setStep('Sending to simulation engine…');
      if (selectedAlgos.includes('CP-SAT')) setStep('Running CP-SAT optimal solver (up to 15s)…');
      setPct(40);
      const result = await api.simulate(payload);
      setPct(85); setStep('Processing results…');
      await saveToSupabase(result.results, result.best_algorithm);
      setPct(100); setStep('Done!');
      onResults(result);
      toast(`✓ Best algorithm: ${result.best_algorithm} (${result.results[result.best_algorithm]?.makespan}min makespan)`, 'success');
    } catch (err) {
      toast(`Simulation error: ${err.message}`, 'error');
      setStep('');
    } finally {
      setLoading(false); setPct(0);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
      <div>
        <h3 style={{ marginBottom: 4 }}>Run Simulation</h3>
        <p className="text-sm text-secondary">
          Configure your algorithms and run all selected in one click. Results auto-save to your history.
        </p>
      </div>

      {/* Backend offline warning */}
      {!backendOnline && (
        <div className="glass-card" style={{ padding: 'var(--sp-md)', borderColor: 'var(--clr-danger)', background: 'var(--clr-danger-dim)' }}>
          <div className="flex items-center gap-sm">
            <WifiOff size={16} style={{ color: 'var(--clr-danger)' }} />
            <div>
              <p className="fw-600" style={{ fontSize: '0.875rem', color: 'var(--clr-danger)' }}>Simulation Backend is Offline</p>
              <p className="text-xs text-secondary" style={{ marginTop: 2 }}>
                Open a terminal and run: <code style={{ background: 'var(--clr-bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid-3" style={{ gap: 'var(--sp-sm)' }}>
        {[
          { label: 'Active Machines', value: activeMachines.length, total: machines.length, color: 'var(--clr-success)' },
          { label: 'Job Orders',      value: jobs.length,           color: 'var(--clr-indigo-light)' },
          { label: 'Total Operations',value: totalOps,              color: 'var(--clr-violet)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: 'var(--sp-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.value}</div>
            {s.total !== undefined && <div className="text-xs text-muted" style={{ marginTop: 2 }}>of {s.total} total</div>}
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Algorithm selection */}
      <div>
        <div className="section-title">Select Algorithms to Compare</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--sp-sm)' }}>
          {ALGORITHMS.map(algo => {
            const sel = selectedAlgos.includes(algo.id);
            return (
              <div key={algo.id} id={`algo-${algo.id}`}
                role="checkbox" aria-checked={sel} tabIndex={0}
                onKeyDown={e => e.key === ' ' && toggleAlgo(algo.id)}
                onClick={() => toggleAlgo(algo.id)}
                style={{
                  padding: 'var(--sp-md)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${sel ? algo.color : 'var(--clr-border)'}`,
                  background: sel ? `${algo.color}15` : 'var(--clr-bg-elevated)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-sm)',
                  userSelect: 'none',
                }}>
                <div style={{ marginTop: 3, flexShrink: 0 }}>
                  {sel
                    ? <CheckCircle2 size={16} style={{ color: algo.color }} />
                    : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--clr-border)' }} />
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: sel ? algo.color : 'var(--clr-text-primary)' }}>{algo.label}</div>
                  <div className="text-xs text-muted" style={{ marginTop: 2, lineHeight: 1.5 }}>{algo.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Run button */}
      <button id="run-simulation-btn" className="btn btn-primary btn-lg" onClick={run}
        disabled={loading || !backendOnline} style={{ fontSize: '1rem' }}>
        {loading
          ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> {step}</>
          : <><PlayCircle size={20} /> Run {selectedAlgos.length} Algorithm{selectedAlgos.length !== 1 ? 's' : ''}</>
        }
      </button>

      {/* Progress bar */}
      {loading && (
        <div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>
          <p className="text-xs text-muted" style={{ marginTop: 6, textAlign: 'center' }}>{step}</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Database, Trash2, Eye, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function HistoryPage({ onViewResult }) {
  const { user } = useAuth();
  const toast = useToast();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (!isSupabaseEnabled) {
        const stored = localStorage.getItem('shopflow_sim_history');
        setRuns(stored ? JSON.parse(stored) : []);
        return;
      }
      const { data } = await supabase
        .from('simulation_runs')
        .select('id, algorithm_used, makespan, avg_flow_time, bottleneck_machine_id, created_at, run_name')
        .order('created_at', { ascending: false })
        .limit(100);
      setRuns(data || []);
    } finally {
      setLoading(false);
    }
  };

  const deleteRun = async (id) => {
    if (!window.confirm('Delete this run?')) return;
    if (isSupabaseEnabled) {
      await supabase.from('simulation_runs').delete().eq('id', id);
    } else {
      const stored = JSON.parse(localStorage.getItem('shopflow_sim_history') || '[]');
      localStorage.setItem('shopflow_sim_history', JSON.stringify(stored.filter(r => r.id !== id)));
    }
    setRuns(prev => prev.filter(r => r.id !== id));
    toast('Run deleted.', 'info');
  };

  const ALGO_COLOR = { FCFS: 'badge-info', SPT: 'badge-success', Priority: 'badge-warning', 'CP-SAT': 'badge-info' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ marginBottom: 4 }}>Simulation History</h2>
          <p className="text-sm text-secondary">All saved scheduling runs with full result logs.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchHistory}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-2xl)' }}>
          <span className="spinner" />
        </div>
      ) : runs.length === 0 ? (
        <div className="glass-card empty-state">
          <Database size={48} />
          <h4>No Saved Runs</h4>
          <p className="text-sm">Simulation results will appear here after you run them.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Algorithm</th>
                  <th>Makespan</th>
                  <th>Avg Flow</th>
                  <th>Bottleneck</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td>
                      <div className="flex items-center gap-xs">
                        <Clock size={12} style={{ color: 'var(--clr-text-muted)' }} />
                        <span className="font-mono text-xs">{new Date(run.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ALGO_COLOR[run.algorithm_used] || 'badge-info'}`}>
                        {run.algorithm_used}
                      </span>
                    </td>
                    <td className="font-mono fw-600">{run.makespan} min</td>
                    <td className="font-mono">{run.avg_flow_time} min</td>
                    <td className="text-xs text-secondary">{run.bottleneck_machine_id || '—'}</td>
                    <td>
                      <div className="flex gap-xs">
                        <button className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => deleteRun(run.id)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

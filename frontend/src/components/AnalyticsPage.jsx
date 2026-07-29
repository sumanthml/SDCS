import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Clock, Zap, Target, Activity, Trophy, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Analytics page for Plant Managers.
 * Fetches historical simulation runs from Supabase and shows trends.
 */
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseEnabled) {
        // Load from localStorage mock
        const stored = localStorage.getItem('shopflow_sim_history');
        setRuns(stored ? JSON.parse(stored) : []);
        return;
      }
      const { data, error: err } = await supabase
        .from('simulation_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) throw err;
      setRuns(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate stats
  const totalRuns = runs.length;
  const algoCounts = runs.reduce((acc, r) => {
    acc[r.algorithm_used] = (acc[r.algorithm_used] || 0) + 1;
    return acc;
  }, {});
  const bestAlgoOverall = Object.entries(algoCounts).sort((a, b) => b[1] - a[1])[0];
  const avgMakespan = runs.length ? (runs.reduce((s, r) => s + r.makespan, 0) / runs.length).toFixed(1) : 0;
  const avgFlow = runs.length ? (runs.reduce((s, r) => s + r.avg_flow_time, 0) / runs.length).toFixed(1) : 0;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-2xl)' }}>
      <span className="spinner" />
    </div>
  );

  if (error) return (
    <div className="glass-card" style={{ padding: 'var(--sp-xl)', textAlign: 'center' }}>
      <AlertTriangle size={32} style={{ color: 'var(--clr-danger)', marginBottom: 12 }} />
      <p className="text-sm" style={{ color: 'var(--clr-danger)' }}>Failed to load analytics: {error}</p>
      <button className="btn btn-secondary btn-sm" onClick={fetchHistory} style={{ marginTop: 12 }}>Retry</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Performance Analytics</h2>
        <p className="text-sm text-secondary">Historical simulation trends and algorithm performance benchmarks.</p>
      </div>

      {/* KPI overview */}
      <div className="grid-4">
        {[
          { icon: <BarChart3 size={18}/>, label: 'Total Simulations',   value: totalRuns,              color: 'var(--clr-indigo-light)' },
          { icon: <Trophy size={18}/>,   label: 'Top Algorithm',        value: bestAlgoOverall?.[0] || '—', color: 'var(--clr-success)' },
          { icon: <Clock size={18}/>,    label: 'Avg Makespan',         value: avgMakespan ? `${avgMakespan}m` : '—', color: 'var(--clr-cyan)' },
          { icon: <Activity size={18}/>, label: 'Avg Flow Time',        value: avgFlow ? `${avgFlow}m` : '—',    color: 'var(--clr-warning)' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card metric-card">
            <div style={{ color: kpi.color }}>{kpi.icon}</div>
            <div className="metric-value" style={{ fontSize: '1.6rem' }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Algorithm win rates */}
      {Object.keys(algoCounts).length > 0 && (
        <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
          <div className="section-title">Algorithm Usage Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {Object.entries(algoCounts).sort((a,b) => b[1]-a[1]).map(([algo, count]) => {
              const pct = Math.round(count / totalRuns * 100);
              const colors = { FCFS: 'var(--clr-info)', SPT: 'var(--clr-success)', Priority: 'var(--clr-warning)', 'CP-SAT': 'var(--clr-violet)' };
              const color = colors[algo] || 'var(--clr-indigo)';
              return (
                <div key={algo}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <span className="fw-600" style={{ fontSize: '0.85rem', color }}>{algo}</span>
                    <span className="font-mono text-xs text-muted">{count} runs ({pct}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent runs table */}
      {runs.length > 0 ? (
        <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
          <div className="section-title">Recent Simulation Runs</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Algorithm</th>
                  <th>Makespan</th>
                  <th>Avg Flow</th>
                  <th>Bottleneck</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 20).map(run => (
                  <tr key={run.id}>
                    <td className="font-mono text-xs">{new Date(run.created_at).toLocaleString()}</td>
                    <td><span className="badge badge-info">{run.algorithm_used}</span></td>
                    <td className="font-mono fw-600">{run.makespan} min</td>
                    <td className="font-mono">{run.avg_flow_time} min</td>
                    <td className="text-xs">{run.bottleneck_machine_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card empty-state">
          <BarChart3 size={48} />
          <h4>No History Yet</h4>
          <p className="text-sm">Run simulations to build your analytics history.</p>
        </div>
      )}
    </div>
  );
}

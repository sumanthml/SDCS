import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import GanttChart from './GanttChart';
import { Download, Trophy, Clock, Activity, Zap, Target, BarChart3 } from 'lucide-react';

const ALGO_COLORS = { FCFS: 'var(--clr-info)', SPT: 'var(--clr-success)', Priority: 'var(--clr-warning)', 'CP-SAT': 'var(--clr-violet)' };

export default function ResultsView({ results, bestAlgorithm }) {
  const toast = useToast();
  
  const algos = results ? Object.keys(results) : [];
  const initialAlgo = (bestAlgorithm && algos.includes(bestAlgorithm)) ? bestAlgorithm : algos[0];
  const [activeAlgo, setActiveAlgo] = useState(initialAlgo);
  const [exporting, setExporting] = useState(false);

  if (!results || algos.length === 0) {
    return (
      <div className="glass-card empty-state">
        <BarChart3 size={48} />
        <h4>No Results Yet</h4>
        <p className="text-sm">Run a simulation to see the Gantt chart and metrics here.</p>
      </div>
    );
  }

  // Ensure active exists, fallback to first key if not found
  const active = results[activeAlgo] || results[algos[0]];
  const safeBestAlgo = (bestAlgorithm && algos.includes(bestAlgorithm)) ? bestAlgorithm : algos[0];

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportCsv(active);
      toast('Schedule exported as CSV!', 'success');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Full results exported as JSON.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>

      {/* Best algorithm banner */}
      <div className="glass-card" style={{ padding: 'var(--sp-lg)', borderColor: ALGO_COLORS[safeBestAlgo] || 'var(--clr-indigo)', background: `${ALGO_COLORS[safeBestAlgo] || 'var(--clr-indigo)'}14` }}>
        <div className="flex items-center gap-sm">
          <Trophy size={22} style={{ color: ALGO_COLORS[safeBestAlgo] || 'var(--clr-indigo)' }} />
          <div>
            <h4 style={{ color: ALGO_COLORS[safeBestAlgo] }}>Best Algorithm: {safeBestAlgo}</h4>
            <p className="text-xs text-secondary">Lowest makespan: {results[safeBestAlgo]?.makespan} minutes</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-sm)' }}>
            <button id="export-csv-btn" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> Export CSV
            </button>
            <button id="export-json-btn" className="btn btn-secondary btn-sm" onClick={exportJson}>
              <Download size={14} /> Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Comparison metric cards */}
      <div>
        <div className="section-title">Algorithm Comparison</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${algos.length}, 1fr)`, gap: 'var(--sp-sm)' }}>
          {algos.map(algo => {
            const res = results[algo];
            const isBest = algo === safeBestAlgo;
            const color = ALGO_COLORS[algo] || 'var(--clr-indigo)';
            return (
              <button
                key={algo}
                id={`algo-result-${algo}`}
                onClick={() => setActiveAlgo(algo)}
                style={{
                  padding: 'var(--sp-md)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${activeAlgo === algo ? color : 'var(--clr-border)'}`,
                  background: activeAlgo === algo ? `${color}18` : 'var(--clr-bg-elevated)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  textAlign: 'left',
                }}
              >
                <div className="flex items-center gap-xs" style={{ marginBottom: 8 }}>
                  {isBest && <Trophy size={12} style={{ color }} />}
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: activeAlgo === algo ? color : 'var(--clr-text-primary)', fontFamily: 'var(--font-display)' }}>{algo}</span>
                  {isBest && <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>BEST</span>}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>{res.makespan}<span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', fontWeight: 400, marginLeft: 2 }}>min</span></div>
                <div className="text-xs text-muted">Makespan</div>
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--clr-text-secondary)' }}>
                  Idle: {res.total_idle_time}m · Flow: {res.avg_flow_time}m
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active algo details */}
      {active && (
        <>
          {/* KPI cards */}
          <div className="grid-4">
            {[
              { icon: <Clock size={18} />, label: 'Makespan', value: `${active.makespan} min`, color: ALGO_COLORS[activeAlgo] },
              { icon: <Activity size={18} />, label: 'Avg Flow Time', value: `${active.avg_flow_time} min`, color: 'var(--clr-cyan)' },
              { icon: <Zap size={18} />, label: 'Total Idle Time', value: `${active.total_idle_time} min`, color: 'var(--clr-warning)' },
              { icon: <Target size={18} />, label: 'Avg Tardiness', value: `${active.avg_tardiness} min`, color: 'var(--clr-danger)' },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-card metric-card">
                <div className="flex items-center gap-sm" style={{ color: kpi.color }}>{kpi.icon}</div>
                <div className="metric-value">{kpi.value}</div>
                <div className="metric-label">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Machine utilization table */}
          {active.machine_metrics && (
            <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
              <div className="section-title">Machine Utilization</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Busy Time</th>
                    <th>Idle Time</th>
                    <th>Utilization</th>
                    <th>Queue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...active.machine_metrics].sort((a, b) => b.utilization_pct - a.utilization_pct).map(m => {
                    const isBottleneck = m.machine_name === active.bottleneck_machine;
                    return (
                      <tr key={m.machine_id}>
                        <td>
                          <div className="flex items-center gap-sm">
                            {isBottleneck && <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>⚠ Bottleneck</span>}
                            <span className="fw-600">{m.machine_name}</span>
                          </div>
                        </td>
                        <td className="font-mono">{m.total_busy_time} min</td>
                        <td className="font-mono">{m.idle_time} min</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <div className="progress-bar" style={{ flex: 1, height: 5 }}>
                              <div className="progress-bar-fill" style={{
                                width: `${m.utilization_pct}%`,
                                background: m.utilization_pct > 85
                                  ? 'linear-gradient(90deg, var(--clr-warning), var(--clr-danger))'
                                  : 'linear-gradient(90deg, var(--clr-indigo), var(--clr-violet))',
                              }} />
                            </div>
                            <span className="font-mono text-xs">{m.utilization_pct}%</span>
                          </div>
                        </td>
                        <td className="font-mono">{m.queue_length}</td>
                        <td>
                          <span className={`badge ${m.utilization_pct > 85 ? 'badge-danger' : m.utilization_pct > 60 ? 'badge-warning' : 'badge-success'}`}>
                            {m.utilization_pct > 85 ? 'Overloaded' : m.utilization_pct > 60 ? 'Busy' : 'Optimal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Gantt chart */}
          <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                Gantt Chart — {activeAlgo}
              </div>
              {active.solver_status && (
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                  Solver: {active.solver_status}
                </span>
              )}
            </div>
            <GanttChart
              schedule={active.schedule}
              makespan={active.makespan}
              algorithmName={activeAlgo}
            />
          </div>
        </>
      )}
    </div>
  );
}

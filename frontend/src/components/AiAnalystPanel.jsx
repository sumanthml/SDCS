import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { Cpu, Sparkles, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

export default function AiAnalystPanel({ results, bestAlgorithm }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [userContext, setUserContext] = useState('');

  const hasResults = results && Object.keys(results).length > 0;

  const runAnalysis = async () => {
    if (!hasResults) { toast('Run a simulation first.', 'error'); return; }
    setLoading(true);
    try {
      // Serialize results (remove large schedule arrays to keep payload lean)
      const slim = Object.fromEntries(
        Object.entries(results).map(([algo, res]) => [
          algo,
          {
            makespan: res.makespan,
            avg_flow_time: res.avg_flow_time,
            total_idle_time: res.total_idle_time,
            avg_tardiness: res.avg_tardiness,
            bottleneck_machine: res.bottleneck_machine,
            machine_metrics: res.machine_metrics,
            solver_status: res.solver_status,
          },
        ])
      );

      const data = await api.analyze({
        simulation_results: slim,
        best_algorithm: bestAlgorithm,
        user_context: userContext || null,
      });
      setAnalysis(data);
      toast('AI analysis complete!', 'success');
    } catch (err) {
      toast(`AI analysis failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <div>
        <h3 className="flex items-center gap-sm" style={{ marginBottom: 4 }}>
          <Cpu size={20} style={{ color: 'var(--clr-indigo)' }} />
          AI Schedule Analyst
        </h3>
        <p className="text-sm text-secondary">
          Powered by Groq Llama 3 — analyzes your simulation results and provides expert manufacturing recommendations.
        </p>
      </div>

      {!hasResults && (
        <div className="glass-card" style={{ padding: 'var(--sp-lg)', borderColor: 'var(--clr-indigo)', background: 'var(--clr-indigo-dim)' }}>
          <div className="flex items-center gap-sm">
            <AlertCircle size={16} style={{ color: 'var(--clr-indigo-light)' }} />
            <p className="text-sm" style={{ color: 'var(--clr-indigo-light)' }}>
              Run a simulation first to enable AI analysis.
            </p>
          </div>
        </div>
      )}

      {hasResults && (
        <>
          <div className="form-group">
            <label htmlFor="ai-context">Additional Context (optional)</label>
            <textarea
              id="ai-context"
              placeholder="e.g. We have a tight 480-minute shift window, customer orders are urgent, Machine M2 has had repeated issues this week…"
              value={userContext}
              onChange={e => setUserContext(e.target.value)}
              rows={3}
            />
          </div>

          <button
            id="ai-analyze-btn"
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing with Groq AI…</>
            ) : (
              <><Sparkles size={16} /> Analyze Schedule with AI</>
            )}
          </button>
        </>
      )}

      {analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', animation: 'fadeInUp 0.4s ease' }}>
          {/* Full analysis */}
          <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
            <div className="section-title">Executive Analysis</div>
            <div className="ai-message">{analysis.analysis}</div>
            <div className="flex items-center gap-xs" style={{ marginTop: 'var(--sp-sm)' }}>
              <Cpu size={12} style={{ color: 'var(--clr-text-muted)' }} />
              <span className="text-xs text-muted">Model: {analysis.model_used}</span>
            </div>
          </div>

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
              <div className="section-title">Actionable Recommendations</div>
              <div className="ai-rec-list">
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} className="ai-rec-item">
                    <div className="ai-rec-num">{i + 1}</div>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottleneck advice */}
          {analysis.bottleneck_advice && (
            <div className="glass-card" style={{ padding: 'var(--sp-lg)', borderColor: 'var(--clr-warning)' }}>
              <div className="section-title" style={{ color: 'var(--clr-warning)' }}>
                Bottleneck Analysis
              </div>
              <p className="text-sm" style={{ lineHeight: 1.7 }}>{analysis.bottleneck_advice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

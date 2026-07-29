import { useState } from 'react';
import { Plus, Trash2, BriefcaseBusiness, ChevronDown, ChevronUp, Save, Copy } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const EMPTY_OP = (step) => ({ step_number: step, machine_id: '', machine_name: '', duration_mins: 30 });
const EMPTY_JOB = () => ({
  job_id: `JOB-${Date.now()}`,
  job_name: '',
  priority: 3,
  arrival_time: 0,
  due_date: '',
  operations: [EMPTY_OP(1)],
});

const PRIORITY_LABELS = { 1: 'Low', 2: 'Below Normal', 3: 'Normal', 4: 'High', 5: 'Critical' };
const PRIORITY_COLORS = { 1: 'badge-info', 2: 'badge-info', 3: 'badge-success', 4: 'badge-warning', 5: 'badge-danger' };

export default function JobBuilder({ jobs, machines, onChange }) {
  const toast = useToast();
  const [expandedJob, setExpandedJob] = useState(null);

  const activeMachines = machines.filter(m => m.status === 'Active');

  const addJob = () => {
    const newJob = EMPTY_JOB();
    onChange([...jobs, newJob]);
    setExpandedJob(newJob.job_id);
  };

  const removeJob = (jobId) => {
    onChange(jobs.filter(j => j.job_id !== jobId));
    toast('Job removed', 'info');
  };

  const duplicateJob = (job) => {
    const dup = { ...job, job_id: `JOB-${Date.now()}`, job_name: `${job.job_name} (copy)` };
    onChange([...jobs, dup]);
    toast('Job duplicated', 'success');
  };

  const updateJob = (jobId, field, value) => {
    onChange(jobs.map(j => j.job_id === jobId ? { ...j, [field]: value } : j));
  };

  const addOp = (jobId) => {
    const job = jobs.find(j => j.job_id === jobId);
    const nextStep = (job.operations?.length || 0) + 1;
    onChange(jobs.map(j => j.job_id === jobId
      ? { ...j, operations: [...(j.operations || []), EMPTY_OP(nextStep)] }
      : j
    ));
  };

  const removeOp = (jobId, stepNum) => {
    onChange(jobs.map(j => j.job_id === jobId
      ? { ...j, operations: j.operations.filter(op => op.step_number !== stepNum).map((op, i) => ({ ...op, step_number: i + 1 })) }
      : j
    ));
  };

  const updateOp = (jobId, stepNum, field, value) => {
    onChange(jobs.map(j => {
      if (j.job_id !== jobId) return j;
      return {
        ...j,
        operations: j.operations.map(op => {
          if (op.step_number !== stepNum) return op;
          let updated = { ...op, [field]: value };
          if (field === 'machine_id') {
            const mach = activeMachines.find(m => m.machine_id === value);
            updated.machine_name = mach?.name || '';
          }
          return updated;
        }),
      };
    }));
  };

  const handleSave = () => {
    const invalid = jobs.filter(j => !j.job_name.trim() || !j.operations?.length);
    if (invalid.length) return toast('All jobs need a name and at least one operation.', 'error');
    const opsInvalid = jobs.some(j => j.operations?.some(op => !op.machine_id || !op.duration_mins));
    if (opsInvalid) return toast('All operations need a machine and duration.', 'error');
    localStorage.setItem('shopflow_jobs', JSON.stringify(jobs));
    toast(`${jobs.length} job(s) saved.`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h3 style={{ marginBottom: 4 }}>Jobs & Operations Builder</h3>
          <p className="text-sm text-secondary">
            Create multi-stage jobs with sequential machine operations.
          </p>
        </div>
        <button id="job-add-btn" className="btn btn-primary" onClick={addJob}>
          <Plus size={15} /> Add Job
        </button>
      </div>

      {activeMachines.length === 0 && (
        <div className="glass-card" style={{ padding: 'var(--sp-md)', borderColor: 'var(--clr-warning)', background: 'var(--clr-warning-dim)' }}>
          <p className="text-sm" style={{ color: 'var(--clr-warning)' }}>
            ⚠ No active machines found. Add machines in the Machines tab first.
          </p>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="glass-card empty-state">
          <BriefcaseBusiness size={48} />
          <h4>No Jobs Yet</h4>
          <p className="text-sm">Create your first job order with multi-step operations.</p>
          <button id="job-first-add" className="btn btn-primary" onClick={addJob}>
            <Plus size={16} /> Add First Job
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          {jobs.map((job, jIdx) => {
            const isExpanded = expandedJob === job.job_id;
            return (
              <div key={job.job_id} className="glass-card animate-in" style={{ animationDelay: `${jIdx * 0.04}s`, overflow: 'hidden' }}>
                {/* Job header row */}
                <div style={{ padding: 'var(--sp-md) var(--sp-lg)' }}
                  className="flex items-center gap-md">
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--sp-md)', alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor={`job-name-${jIdx}`}>Job Name</label>
                      <input id={`job-name-${jIdx}`} placeholder="Order #A1 — Steel Frame"
                        value={job.job_name} onChange={e => updateJob(job.job_id, 'job_name', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor={`job-prio-${jIdx}`}>Priority (1–5)</label>
                      <select id={`job-prio-${jIdx}`} value={job.priority}
                        onChange={e => updateJob(job.job_id, 'priority', parseInt(e.target.value))}>
                        {[1,2,3,4,5].map(p => <option key={p} value={p}>{p} — {PRIORITY_LABELS[p]}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor={`job-arrival-${jIdx}`}>Arrival Time (min)</label>
                      <input id={`job-arrival-${jIdx}`} type="number" min="0" value={job.arrival_time}
                        onChange={e => updateJob(job.job_id, 'arrival_time', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor={`job-due-${jIdx}`}>Due Date (min)</label>
                      <input id={`job-due-${jIdx}`} type="number" min="0" placeholder="Optional"
                        value={job.due_date || ''} onChange={e => updateJob(job.job_id, 'due_date', e.target.value ? parseFloat(e.target.value) : null)} />
                    </div>
                  </div>
                  <div className="flex gap-xs items-center" style={{ flexShrink: 0 }}>
                    <span className={`badge ${PRIORITY_COLORS[job.priority]}`}>P{job.priority}</span>
                    <button id={`job-dup-${jIdx}`} className="btn btn-secondary btn-icon" onClick={() => duplicateJob(job)} title="Duplicate job">
                      <Copy size={13} />
                    </button>
                    <button id={`job-expand-${jIdx}`} className="btn btn-secondary btn-icon"
                      onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button id={`job-remove-${jIdx}`} className="btn btn-danger btn-icon"
                      onClick={() => removeJob(job.job_id)} title="Remove job">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Operations section */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--clr-border)', padding: 'var(--sp-md) var(--sp-lg)', background: 'hsla(228,20%,8%,0.4)' }}>
                    <div className="section-title">Operations Sequence</div>
                    {(job.operations || []).map((op, opIdx) => (
                      <div key={op.step_number} className="flex items-center gap-sm" style={{ marginBottom: 'var(--sp-sm)' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--clr-indigo), var(--clr-violet))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                        }}>
                          {op.step_number}
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-sm)' }}>
                          <select id={`op-machine-${jIdx}-${opIdx}`}
                            value={op.machine_id}
                            onChange={e => updateOp(job.job_id, op.step_number, 'machine_id', e.target.value)}>
                            <option value="">— Select Machine —</option>
                            {activeMachines.map(m => (
                              <option key={m.machine_id} value={m.machine_id}>
                                [{m.machine_code}] {m.name}
                              </option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
                            <input id={`op-dur-${jIdx}-${opIdx}`} type="number" min="1" max="9999"
                              value={op.duration_mins} placeholder="Duration (min)"
                              onChange={e => updateOp(job.job_id, op.step_number, 'duration_mins', parseFloat(e.target.value) || 0)} />
                            <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>min</span>
                          </div>
                        </div>
                        {(job.operations.length > 1) && (
                          <button id={`op-remove-${jIdx}-${opIdx}`} className="btn btn-danger btn-icon btn-sm"
                            onClick={() => removeOp(job.job_id, op.step_number)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button id={`op-add-${jIdx}`} className="btn btn-secondary btn-sm" onClick={() => addOp(job.job_id)} style={{ marginTop: 'var(--sp-sm)' }}>
                      <Plus size={13} /> Add Step
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted">{jobs.length} job(s) · {jobs.reduce((s, j) => s + (j.operations?.length || 0), 0)} total operations</span>
          <button id="job-save-btn" className="btn btn-success" onClick={handleSave}>
            <Save size={15} /> Save Jobs
          </button>
        </div>
      )}
    </div>
  );
}

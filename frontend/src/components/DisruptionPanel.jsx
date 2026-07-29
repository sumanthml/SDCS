import { useState } from 'react';
import { Plus, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const EMPTY_DOWNTIME = () => ({ machine_id: '', start_time: '', end_time: '' });
const EMPTY_EMERGENCY = () => ({
  insert_at_time: 0,
  job: {
    job_id: `EMG-${Date.now()}`,
    job_name: '',
    priority: 5,
    arrival_time: 0,
    operations: [{ step_number: 1, machine_id: '', machine_name: '', duration_mins: 20 }],
  },
});

export default function DisruptionPanel({ machines, disruptions, onChange }) {
  const toast = useToast();
  const activeMachines = machines.filter(m => m.status === 'Active');

  const addDowntime = () => onChange({ ...disruptions, downtime_events: [...(disruptions.downtime_events || []), EMPTY_DOWNTIME()] });
  const removeDowntime = (i) => onChange({ ...disruptions, downtime_events: disruptions.downtime_events.filter((_, idx) => idx !== i) });
  const updateDowntime = (i, field, value) => {
    const updated = [...(disruptions.downtime_events || [])];
    updated[i] = { ...updated[i], [field]: value };
    onChange({ ...disruptions, downtime_events: updated });
  };

  const addEmergency = () => onChange({ ...disruptions, emergency_jobs: [...(disruptions.emergency_jobs || []), EMPTY_EMERGENCY()] });
  const removeEmergency = (i) => onChange({ ...disruptions, emergency_jobs: disruptions.emergency_jobs.filter((_, idx) => idx !== i) });
  const updateEmergency = (i, field, value) => {
    const updated = [...(disruptions.emergency_jobs || [])];
    if (field === 'insert_at_time') updated[i] = { ...updated[i], insert_at_time: parseFloat(value) || 0 };
    else if (field === 'job_name') updated[i] = { ...updated[i], job: { ...updated[i].job, job_name: value } };
    else if (field === 'machine_id') {
      const mach = activeMachines.find(m => m.machine_id === value);
      updated[i] = {
        ...updated[i],
        job: {
          ...updated[i].job,
          operations: [{ step_number: 1, machine_id: value, machine_name: mach?.name || '', duration_mins: updated[i].job.operations[0]?.duration_mins || 20 }],
        },
      };
    }
    else if (field === 'duration_mins') {
      updated[i] = { ...updated[i], job: { ...updated[i].job, operations: [{ ...updated[i].job.operations[0], duration_mins: parseFloat(value) || 20 }] } };
    }
    onChange({ ...disruptions, emergency_jobs: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
      {/* Machine Downtime */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
          <div>
            <h4 className="flex items-center gap-sm">
              <AlertTriangle size={16} style={{ color: 'var(--clr-warning)' }} />
              Machine Downtime Events
            </h4>
            <p className="text-xs text-muted mt-sm">Simulate unexpected breakdowns during the simulation window.</p>
          </div>
          <button id="downtime-add-btn" className="btn btn-secondary btn-sm" onClick={addDowntime}>
            <Plus size={13} /> Add Downtime
          </button>
        </div>

        {(disruptions.downtime_events || []).length === 0 ? (
          <div className="glass-card" style={{ padding: 'var(--sp-lg)', textAlign: 'center' }}>
            <p className="text-sm text-muted">No downtime events configured — machines run uninterrupted.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {(disruptions.downtime_events || []).map((evt, i) => (
              <div key={i} className="glass-card" style={{ padding: 'var(--sp-md)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 'var(--sp-md)', alignItems: 'end' }}>
                <div className="form-group">
                  <label htmlFor={`dt-machine-${i}`}>Machine</label>
                  <select id={`dt-machine-${i}`} value={evt.machine_id} onChange={e => updateDowntime(i, 'machine_id', e.target.value)}>
                    <option value="">— Select Machine —</option>
                    {activeMachines.map(m => <option key={m.machine_id} value={m.machine_id}>[{m.machine_code}] {m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor={`dt-start-${i}`}>Start (min)</label>
                  <input id={`dt-start-${i}`} type="number" min="0" value={evt.start_time}
                    onChange={e => updateDowntime(i, 'start_time', parseFloat(e.target.value) || 0)} placeholder="100" />
                </div>
                <div className="form-group">
                  <label htmlFor={`dt-end-${i}`}>End (min)</label>
                  <input id={`dt-end-${i}`} type="number" min="0" value={evt.end_time}
                    onChange={e => updateDowntime(i, 'end_time', parseFloat(e.target.value) || 0)} placeholder="160" />
                </div>
                <button id={`dt-remove-${i}`} className="btn btn-danger btn-icon" onClick={() => removeDowntime(i)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Jobs */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
          <div>
            <h4 className="flex items-center gap-sm">
              <Clock size={16} style={{ color: 'var(--clr-danger)' }} />
              Emergency Job Insertions
            </h4>
            <p className="text-xs text-muted mt-sm">Insert rush orders into the active schedule mid-run.</p>
          </div>
          <button id="emg-add-btn" className="btn btn-secondary btn-sm" onClick={addEmergency}>
            <Plus size={13} /> Add Emergency Job
          </button>
        </div>

        {(disruptions.emergency_jobs || []).length === 0 ? (
          <div className="glass-card" style={{ padding: 'var(--sp-lg)', textAlign: 'center' }}>
            <p className="text-sm text-muted">No emergency jobs — running standard schedule.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {(disruptions.emergency_jobs || []).map((emg, i) => (
              <div key={i} className="glass-card" style={{ padding: 'var(--sp-md)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--sp-md)', alignItems: 'end', borderColor: 'var(--clr-danger)', background: 'hsla(355,80%,60%,0.05)' }}>
                <div className="form-group">
                  <label htmlFor={`emg-name-${i}`}>Job Name</label>
                  <input id={`emg-name-${i}`} placeholder="Rush Order #X" value={emg.job.job_name}
                    onChange={e => updateEmergency(i, 'job_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`emg-time-${i}`}>Insert At (min)</label>
                  <input id={`emg-time-${i}`} type="number" min="0" value={emg.insert_at_time}
                    onChange={e => updateEmergency(i, 'insert_at_time', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`emg-machine-${i}`}>Machine</label>
                  <select id={`emg-machine-${i}`} value={emg.job.operations[0]?.machine_id || ''}
                    onChange={e => updateEmergency(i, 'machine_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {activeMachines.map(m => <option key={m.machine_id} value={m.machine_id}>[{m.machine_code}] {m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor={`emg-dur-${i}`}>Duration (min)</label>
                  <input id={`emg-dur-${i}`} type="number" min="1" value={emg.job.operations[0]?.duration_mins || 20}
                    onChange={e => updateEmergency(i, 'duration_mins', e.target.value)} />
                </div>
                <button id={`emg-remove-${i}`} className="btn btn-danger btn-icon" onClick={() => removeEmergency(i)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

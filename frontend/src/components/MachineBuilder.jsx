import { useState } from 'react';
import { Plus, Trash2, Cog, Save, Upload } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CsvImporter from './CsvImporter';

const STATUS_OPTIONS = ['Active', 'Maintenance', 'Offline'];

const EMPTY_MACHINE = () => ({
  machine_id: crypto.randomUUID(),
  machine_code: '',
  name: '',
  status: 'Active',
  shift_hours: 8,
});

export default function MachineBuilder({ machines, onChange, onSave }) {
  const toast = useToast();
  const [showImport, setShowImport] = useState(false);

  const addMachine = () => onChange([...machines, EMPTY_MACHINE()]);

  const removeMachine = (idx) => {
    const updated = machines.filter((_, i) => i !== idx);
    onChange(updated);
    toast('Machine removed', 'info');
  };

  const updateMachine = (idx, field, value) => {
    const updated = machines.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    onChange(updated);
  };

  const handleSave = async () => {
    const invalid = machines.filter(m => !m.machine_code.trim() || !m.name.trim());
    if (invalid.length) return toast('All machines need a code and name.', 'error');
    
    if (onSave) {
      await onSave(machines);
    } else {
      localStorage.setItem('shopflow_machines', JSON.stringify(machines));
      toast(`${machines.length} machine(s) saved.`, 'success');
    }
  };

  const statusColor = { Active: 'success', Maintenance: 'warning', Offline: 'danger' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 style={{ marginBottom: 4 }}>Machine Registry</h3>
          <p className="text-sm text-secondary">
            Define shop-floor machines, their codes, statuses, and shift hours.
          </p>
        </div>
        <div className="flex gap-sm">
          <button id="machine-import-btn" className="btn btn-secondary btn-sm" onClick={() => setShowImport(!showImport)}>
            <Upload size={14} /> Import CSV
          </button>
          <button id="machine-add-btn" className="btn btn-primary btn-sm" onClick={addMachine}>
            <Plus size={14} /> Add Machine
          </button>
        </div>
      </div>

      {showImport && (
        <CsvImporter
          type="machines"
          onClose={() => setShowImport(false)}
          onImport={(rows) => {
            const newMachines = rows.map(r => ({
              machine_id: r.machine_code || `M${Date.now()}`,
              machine_code: r.machine_code || '',
              name: r.name || '',
              status: r.status || 'Active',
              shift_hours: parseFloat(r.shift_hours) || 8,
            }));
            onChange([...machines, ...newMachines]);
            setShowImport(false);
            toast(`Imported ${newMachines.length} machines.`, 'success');
          }}
        />
      )}

      {machines.length === 0 ? (
        <div className="glass-card empty-state">
          <Cog size={48} />
          <h4>No Machines Yet</h4>
          <p className="text-sm">Add your first machine to get started.</p>
          <button id="machine-first-add" className="btn btn-primary" onClick={addMachine}>
            <Plus size={16} /> Add First Machine
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          {machines.map((machine, idx) => (
            <div key={machine.machine_id} className="glass-card animate-in"
              style={{ padding: 'var(--sp-lg)', animationDelay: `${idx * 0.05}s` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: 'var(--sp-md)', alignItems: 'end' }}>
                <div className="form-group">
                  <label htmlFor={`mc-code-${idx}`}>Machine Code</label>
                  <input
                    id={`mc-code-${idx}`}
                    placeholder="M1"
                    value={machine.machine_code}
                    onChange={e => updateMachine(idx, 'machine_code', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`mc-name-${idx}`}>Machine Name</label>
                  <input
                    id={`mc-name-${idx}`}
                    placeholder="CNC Lathe #1"
                    value={machine.name}
                    onChange={e => updateMachine(idx, 'name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`mc-status-${idx}`}>Status</label>
                  <select
                    id={`mc-status-${idx}`}
                    value={machine.status}
                    onChange={e => updateMachine(idx, 'status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor={`mc-shift-${idx}`}>Shift Hours</label>
                  <input
                    id={`mc-shift-${idx}`}
                    type="number" min="1" max="24" step="0.5"
                    value={machine.shift_hours}
                    onChange={e => updateMachine(idx, 'shift_hours', parseFloat(e.target.value))}
                  />
                </div>
                <button
                  id={`mc-remove-${idx}`}
                  className="btn btn-danger btn-icon"
                  onClick={() => removeMachine(idx)}
                  title="Remove machine"
                  style={{ marginBottom: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-sm" style={{ marginTop: 'var(--sp-sm)' }}>
                <span className={`badge badge-${statusColor[machine.status]}`}>
                  <span className={`status-dot ${machine.status.toLowerCase()}`} />
                  {machine.status}
                </span>
                {machine.machine_code && (
                  <span className="text-xs text-muted font-mono">{machine.machine_code}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {machines.length > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted">{machines.length} machine(s) configured</span>
          <button id="machine-save-btn" className="btn btn-success" onClick={handleSave}>
            <Save size={15} /> Save Machines
          </button>
        </div>
      )}
    </div>
  );
}

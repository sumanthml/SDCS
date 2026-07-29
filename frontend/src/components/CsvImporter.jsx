import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

export default function CsvImporter({ type, onImport, onClose }) {
  const toast = useToast();
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      toast('Please upload a CSV or Excel file.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.importCsv(file);
      if (result.errors?.length) {
        toast(`Imported with ${result.errors.length} warnings.`, 'info');
      } else {
        toast(`Successfully imported ${result.imported_count} ${type}.`, 'success');
      }
      onImport(result.jobs || []);
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const sampleCsv = type === 'machines'
    ? `machine_code,name,status,shift_hours\nM1,CNC Lathe,Active,8\nM2,Drill Press,Active,8`
    : `job_name,priority,arrival_time,due_date,step_number,machine_code,machine_name,duration_mins\nJob A,3,0,480,1,M1,CNC Lathe,30\nJob A,3,0,480,2,M2,Drill Press,15\nJob B,5,10,,1,M1,CNC Lathe,20`;

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card" style={{ padding: 'var(--sp-lg)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
        <h5>Import {type} via CSV</h5>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose} aria-label="Close importer">
          <X size={14} />
        </button>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--clr-indigo)' : 'var(--clr-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-xl)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
          background: dragging ? 'var(--clr-indigo-dim)' : 'transparent',
        }}
      >
        <input
          ref={inputRef}
          id="csv-file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-md">
            <span className="spinner" />
            <span className="text-sm text-muted">Processing…</span>
          </div>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--clr-indigo)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            <p className="fw-600" style={{ marginBottom: 4 }}>Drop CSV here or click to browse</p>
            <p className="text-xs text-muted">.csv, .xlsx, .xls supported</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-sm" style={{ marginTop: 'var(--sp-md)' }}>
        <FileText size={14} style={{ color: 'var(--clr-text-muted)' }} />
        <button
          id="csv-sample-download"
          className="btn btn-secondary btn-sm"
          onClick={downloadSample}
          style={{ fontSize: '0.78rem' }}
        >
          Download Sample CSV
        </button>
      </div>
    </div>
  );
}

/**
 * api.js — Centralized API client with health check, retry, and timeout.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TIMEOUT_MS = 60_000; // 60s for CP-SAT

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        errMsg = body.detail || body.message || errMsg;
        if (body.errors?.length) errMsg += ': ' + body.errors.join('; ');
      } catch (_) {}
      throw new Error(errMsg);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out (60s). Backend may be slow or offline.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request('/health'),

  simulate: (payload) =>
    request('/api/simulate', { method: 'POST', body: JSON.stringify(payload) }),

  analyze: (payload) =>
    request('/api/analyze', { method: 'POST', body: JSON.stringify(payload) }),

  exportCsv: async (result) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${API_BASE}/api/export/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch_${result.algorithm}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      clearTimeout(timer);
    }
  },

  importCsv: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/api/import/csv`, { method: 'POST', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Import failed: HTTP ${res.status}`);
    }
    return res.json();
  },
};

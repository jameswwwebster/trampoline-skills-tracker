import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminClosures() {
  const [closures, setClosures] = useState([]);
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = () => bookingApi.getClosures().then(res => setClosures(res.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Create closure from ${form.startDate} to ${form.endDate}? This will cancel all sessions and issue credits.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.createClosure(form);
      setForm({ startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create closure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this closure period?')) return;
    await bookingApi.deleteClosure(id);
    load();
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      <h2>Closure Periods</h2>

      <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Add closure</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>Start date<br />
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required style={{ width: '100%', padding: '0.4rem' }} />
          </label>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>End date<br />
            <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required style={{ width: '100%', padding: '0.4rem' }} />
          </label>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>Reason<br />
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Christmas 2026" style={{ width: '100%', padding: '0.4rem' }} />
          </label>
        </div>
        {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer' }}>
          {submitting ? 'Creating...' : 'Create closure'}
        </button>
      </form>

      {closures.length === 0 && <p>No closure periods.</p>}
      {closures.map(c => (
        <div key={c.id} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{c.reason}</strong>
            <p style={{ margin: '0.2rem 0', color: '#666', fontSize: '0.85rem' }}>
              {new Date(c.startDate).toLocaleDateString('en-GB')} – {new Date(c.endDate).toLocaleDateString('en-GB')}
            </p>
          </div>
          <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer' }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

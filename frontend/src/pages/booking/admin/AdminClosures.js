import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

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
    <div className="bk-page bk-page--md">
      <h2>Closure Periods</h2>

      <form onSubmit={handleSubmit} className="bk-form-card">
        <h3 style={{ margin: '0 0 1rem' }}>Add closure</h3>
        <label className="bk-label">Start date
          <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label">End date
          <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label">Reason
          <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Christmas 2026" className="bk-input" style={{ marginTop: '0.25rem' }} />
        </label>
        {error && <p className="bk-error">{error}</p>}
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--danger">
          {submitting ? 'Creating...' : 'Create closure'}
        </button>
      </form>

      {closures.length === 0 && <p>No closure periods.</p>}
      {closures.map(c => (
        <div key={c.id} className="bk-card bk-row bk-row--between">
          <div>
            <strong>{c.reason}</strong>
            <p style={{ margin: '0.2rem 0', fontSize: '0.85rem' }} className="bk-muted">
              {new Date(c.startDate).toLocaleDateString('en-GB')} – {new Date(c.endDate).toLocaleDateString('en-GB')}
            </p>
          </div>
          <button onClick={() => handleDelete(c.id)} className="bk-btn bk-btn--outline-danger bk-btn--sm">Delete</button>
        </div>
      ))}
    </div>
  );
}

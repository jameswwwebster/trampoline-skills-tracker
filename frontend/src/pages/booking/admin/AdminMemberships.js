import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_LABELS = {
  PENDING_PAYMENT: { label: 'Awaiting payment setup', color: 'var(--booking-warning, #e67e22)' },
  ACTIVE: { label: 'Active', color: 'var(--booking-success)' },
  PAUSED: { label: 'Paused', color: 'var(--booking-text-muted)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--booking-danger)' },
};

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [form, setForm] = useState({ gymnastId: '', monthlyAmount: '', startDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    bookingApi.getMemberships().then(res => setMemberships(res.data));
    const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
    fetch(`${API_URL}/gymnasts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(data => setGymnasts(Array.isArray(data) ? data : data.gymnasts || []));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitMsg(null);
    try {
      const res = await bookingApi.createMembership({
        gymnastId: form.gymnastId,
        monthlyAmount: Math.round(parseFloat(form.monthlyAmount) * 100),

        startDate: form.startDate,
      });
      setForm({ gymnastId: '', monthlyAmount: '', startDate: '' });
      setSubmitMsg(res.data.clientSecret
        ? 'Membership created. The member will see a payment setup prompt in their account.'
        : 'Membership created.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create membership.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await bookingApi.updateMembership(id, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update membership.');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
    try {
      await bookingApi.deleteMembership(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel membership.');
    }
  };

  return (
    <div className="bk-page bk-page--lg">
      <h2>Memberships</h2>

      <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Add member</h3>
        <div className="bk-grid-2">
          <label className="bk-label">Gymnast
            <select value={form.gymnastId} onChange={e => setForm(f => ({ ...f, gymnastId: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }}>
              <option value="">Select gymnast</option>
              {gymnasts.filter(g => !g.isArchived).map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
            </select>
          </label>
          <label className="bk-label">Monthly amount (£)
            <input type="number" step="0.01" min="0" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} required placeholder="e.g. 40.00" className="bk-input" style={{ marginTop: '0.25rem' }} />
          </label>
        </div>
        <label className="bk-label">Start date
          <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }} />
        </label>
        {error && <p className="bk-error">{error}</p>}
        {submitMsg && <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem' }}>{submitMsg}</p>}
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
          {submitting ? 'Creating...' : 'Add member'}
        </button>
      </form>

      {memberships.length === 0 && <p className="bk-muted">No memberships.</p>}
      {memberships.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th style={{ textAlign: 'right' }}>Monthly</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map(m => {
              const s = STATUS_LABELS[m.status] || { label: m.status, color: 'inherit' };
              return (
                <tr key={m.id}>
                  <td>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                  <td style={{ textAlign: 'right' }}>£{(m.monthlyAmount / 100).toFixed(2)}</td>
                  <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                  <td>
                    <div className="bk-row">
                      {m.status === 'ACTIVE' && (
                        <button onClick={() => handleStatusChange(m.id, 'PAUSED')} className="bk-btn bk-btn--sm">Pause</button>
                      )}
                      {m.status === 'PAUSED' && (
                        <button onClick={() => handleStatusChange(m.id, 'ACTIVE')} className="bk-btn bk-btn--sm bk-btn--primary">Resume</button>
                      )}
                      {m.status !== 'CANCELLED' && (
                        <button onClick={() => handleCancel(m.id)} className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [form, setForm] = useState({ gymnastId: '', monthlyAmount: '', startDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    bookingApi.getMemberships().then(res => setMemberships(res.data));
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    fetch(`${API_URL}/gymnasts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(data => setGymnasts(Array.isArray(data) ? data : data.gymnasts || []));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await bookingApi.createMembership({
        gymnastId: form.gymnastId,
        monthlyAmount: Math.round(parseFloat(form.monthlyAmount) * 100),
        startDate: form.startDate,
      });
      setForm({ gymnastId: '', monthlyAmount: '', startDate: '' });
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    await bookingApi.updateMembership(id, { status });
    load();
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem' }}>
      <h2>Memberships</h2>

      <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Add member</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <label>Gymnast<br />
            <select value={form.gymnastId} onChange={e => setForm(f => ({ ...f, gymnastId: e.target.value }))} required style={{ width: '100%', padding: '0.4rem' }}>
              <option value="">Select gymnast</option>
              {gymnasts.map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
            </select>
          </label>
          <label>Monthly amount (£)<br />
            <input type="number" step="0.01" min="0" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} required placeholder="e.g. 40.00" style={{ width: '100%', padding: '0.4rem' }} />
          </label>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>Start date<br />
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required style={{ width: '100%', padding: '0.4rem' }} />
          </label>
        </div>
        <button type="submit" disabled={submitting} style={{ background: '#3498db', color: 'white', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer' }}>
          {submitting ? 'Adding...' : 'Add member'}
        </button>
      </form>

      {memberships.length === 0 && <p>No memberships.</p>}
      {memberships.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Gymnast</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Monthly</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>£{(m.monthlyAmount / 100).toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>{m.status}</td>
                <td style={{ padding: '0.5rem', display: 'flex', gap: '0.4rem' }}>
                  {m.status === 'ACTIVE' && (
                    <button onClick={() => handleStatusChange(m.id, 'PAUSED')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Pause</button>
                  )}
                  {m.status === 'PAUSED' && (
                    <button onClick={() => handleStatusChange(m.id, 'ACTIVE')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Resume</button>
                  )}
                  {m.status !== 'CANCELLED' && (
                    <button onClick={() => handleStatusChange(m.id, 'CANCELLED')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#e74c3c' }}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

export default function AdminCredits() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // user to assign credit to
  const [form, setForm] = useState({ amount: '', expiresInDays: 90 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const load = () =>
    bookingApi.getAllCredits()
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.assignCredit({
        userId: selected.id,
        amount: Math.round(parseFloat(form.amount) * 100),
        expiresInDays: parseInt(form.expiresInDays),
      });
      setSelected(null);
      setForm({ amount: '', expiresInDays: 90 });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign credit.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--lg">
      <h2>Credits</h2>

      {selected && (
        <div className="bk-form-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>
            Assign credit to {selected.firstName} {selected.lastName}
          </h3>
          <form onSubmit={handleAssign}>
            <div className="bk-grid-2">
              <label className="bk-label">Amount (£)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="bk-input"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
              <label className="bk-label">Expires after (days)
                <input
                  type="number"
                  min="1"
                  className="bk-input"
                  value={form.expiresInDays}
                  onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
            </div>
            {error && <p className="bk-error">{error}</p>}
            <div className="bk-row">
              <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
                {submitting ? 'Assigning...' : 'Assign credit'}
              </button>
              <button type="button" className="bk-btn" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setSelected(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        className="bk-input"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '1rem' }}
      />

      <table className="bk-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th style={{ textAlign: 'right' }}>Credits</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id}>
              <td>{u.firstName} {u.lastName}</td>
              <td className="bk-muted" style={{ fontSize: '0.85rem' }}>{u.email}</td>
              <td style={{ textAlign: 'right' }}>
                {u.totalCredits > 0 ? (
                  <strong style={{ color: 'var(--booking-accent)' }}>
                    £{(u.totalCredits / 100).toFixed(2)}
                  </strong>
                ) : (
                  <span className="bk-muted">—</span>
                )}
              </td>
              <td>
                <button
                  className="bk-btn bk-btn--sm bk-btn--primary"
                  onClick={() => setSelected(u)}
                >
                  Assign credit
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="bk-center">No users found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

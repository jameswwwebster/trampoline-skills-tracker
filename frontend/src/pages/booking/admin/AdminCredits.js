import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

function formatDate(iso) {
  if (!iso) return 'Indefinite';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCredits() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Recurring credits ─────────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [rules, setRules] = useState([]);
  const [rcForm, setRcForm] = useState({ userId: '', amount: '', endDate: '' });
  const [rcSubmitting, setRcSubmitting] = useState(false);
  const [rcError, setRcError] = useState(null);

  const loadCredits = () =>
    bookingApi.getAllCredits()
      .then(r => setUsers(r.data.filter(u => u.credits && u.credits.length > 0)))
      .finally(() => setLoading(false));

  const loadRecurring = () =>
    bookingApi.getRecurringCredits()
      .then(r => setRules(r.data))
      .catch(() => {});

  useEffect(() => {
    loadCredits();
    loadRecurring();
    bookingApi.getMembers()
      .then(r => setMembers(r.data.filter(m => m.role !== 'GYMNAST')))
      .catch(() => {});
  }, []);

  const handleAddRecurring = async (e) => {
    e.preventDefault();
    setRcSubmitting(true);
    setRcError(null);
    try {
      const payload = {
        userId: rcForm.userId,
        amountPence: Math.round(parseFloat(rcForm.amount) * 100),
      };
      if (rcForm.endDate) payload.endDate = rcForm.endDate;
      await bookingApi.createRecurringCredit(payload);
      setRcForm({ userId: '', amount: '', endDate: '' });
      loadRecurring();
    } catch (err) {
      setRcError(err.response?.data?.error || 'Failed to create recurring credit.');
    } finally {
      setRcSubmitting(false);
    }
  };

  const handleCancelRule = async (id) => {
    if (!window.confirm('Cancel this recurring credit? Future credits will no longer be issued.')) return;
    try {
      await bookingApi.deleteRecurringCredit(id);
      loadRecurring();
    } catch {
      alert('Failed to cancel rule.');
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--lg">
      <h2>Credits</h2>

      {users.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No active credits.</p>
      ) : (
        <table className="bk-table" style={{ marginBottom: '2.5rem' }}>
          <thead>
            <tr>
              <th>Member</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {users.flatMap(u =>
              u.credits.map(c => (
                <tr key={c.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td style={{ textAlign: 'right', color: 'var(--booking-accent)', fontWeight: 600 }}>
                    £{(c.amount / 100).toFixed(2)}
                  </td>
                  <td>{formatDate(c.expiresAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* ── Recurring credits ────────────────────────────────────────────── */}
      <h2>Recurring credits</h2>

      <div className="bk-form-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Add recurring credit</h3>
        <form onSubmit={handleAddRecurring}>
          <div className="bk-grid-2">
            <label className="bk-label">Member
              <select
                className="bk-input"
                value={rcForm.userId}
                onChange={e => setRcForm(f => ({ ...f, userId: e.target.value }))}
                required
                style={{ marginTop: '0.25rem' }}
              >
                <option value="">Select member…</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </label>
            <label className="bk-label">Monthly amount (£)
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="bk-input"
                value={rcForm.amount}
                onChange={e => setRcForm(f => ({ ...f, amount: e.target.value }))}
                required
                style={{ marginTop: '0.25rem' }}
              />
            </label>
            <label className="bk-label">End date (optional)
              <input
                type="date"
                className="bk-input"
                value={rcForm.endDate}
                onChange={e => setRcForm(f => ({ ...f, endDate: e.target.value }))}
                style={{ marginTop: '0.25rem' }}
              />
            </label>
          </div>
          {rcError && <p className="bk-error">{rcError}</p>}
          <button type="submit" disabled={rcSubmitting} className="bk-btn bk-btn--primary" style={{ marginTop: '0.5rem' }}>
            {rcSubmitting ? 'Saving…' : 'Add recurring credit'}
          </button>
        </form>
      </div>

      {rules.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Member</th>
              <th style={{ textAlign: 'right' }}>Monthly amount</th>
              <th>End date</th>
              <th>Last issued</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id}>
                <td>{r.userName}</td>
                <td style={{ textAlign: 'right' }}>£{(r.amountPence / 100).toFixed(2)}</td>
                <td>{formatDate(r.endDate)}</td>
                <td>{r.lastIssuedAt ? formatDate(r.lastIssuedAt) : '—'}</td>
                <td>
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ border: '1px solid var(--booking-border)' }}
                    onClick={() => handleCancelRule(r.id)}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

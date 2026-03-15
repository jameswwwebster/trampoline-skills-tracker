import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

function formatDate(iso) {
  if (!iso) return 'Indefinite';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCredits() {
  // ── One-time credits ──────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ amount: '', expiresInDays: 90 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // ── Recurring credits ─────────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [rules, setRules] = useState([]);
  const [rcForm, setRcForm] = useState({ userId: '', amount: '', endDate: '' });
  const [rcSubmitting, setRcSubmitting] = useState(false);
  const [rcError, setRcError] = useState(null);

  const loadCredits = () =>
    bookingApi.getAllCredits()
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false));

  const loadRecurring = () =>
    bookingApi.getRecurringCredits()
      .then(r => setRules(r.data))
      .catch(() => {});

  useEffect(() => {
    loadCredits();
    loadRecurring();
    bookingApi.getMembers()
      .then(r => setMembers(r.data))
      .catch(() => {});
  }, []);

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
      loadCredits();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign credit.');
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* ── Recurring credits ────────────────────────────────────────────── */}
      <h2 style={{ marginTop: '2.5rem' }}>Recurring credits</h2>

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

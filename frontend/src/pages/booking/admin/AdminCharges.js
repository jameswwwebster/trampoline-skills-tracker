import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminCharges() {
  const [charges, setCharges] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ userId: '', amount: '', description: '', dueDate: '' });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Note: bookingApi.getMembers() exists at line 74 of bookingApi.js
  // It calls GET /api/users and returns club members with a `role` field.
  // PARENT users have role === 'PARENT' — this filter is correct.
  useEffect(() => {
    Promise.all([
      bookingApi.getAdminCharges(),
      bookingApi.getMembers(),
    ])
      .then(([chargesRes, membersRes]) => {
        setCharges(chargesRes.data);
        setMembers(membersRes.data.filter(m => m.role === 'PARENT'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const amountPence = Math.round(parseFloat(form.amount) * 100);
      if (isNaN(amountPence) || amountPence < 1) {
        setFormError('Amount must be a positive number');
        return;
      }
      await bookingApi.createCharge({
        userId: form.userId,
        amount: amountPence,
        description: form.description,
        dueDate: new Date(form.dueDate).toISOString(),
      });
      const res = await bookingApi.getAdminCharges();
      setCharges(res.data);
      setForm({ userId: '', amount: '', description: '', dueDate: '' });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create charge');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this charge?')) return;
    try {
      await bookingApi.deleteCharge(id);
      setCharges(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete charge');
    }
  }

  if (loading) return <div className="bk-page"><p>Loading…</p></div>;

  return (
    <div className="bk-page">
      <h2>Charges</h2>

      <div className="bk-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Create charge</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label className="bk-label">Member</label>
            <select
              className="bk-input"
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              required
            >
              <option value="">Select member…</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="bk-label">Description</label>
            <input
              className="bk-input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Private session 10 March"
              required
            />
          </div>
          <div>
            <label className="bk-label">Amount (£)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="bk-input"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="15.00"
              required
            />
          </div>
          <div>
            <label className="bk-label">Due date</label>
            <input
              type="date"
              className="bk-input"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              required
            />
          </div>
          {formError && <p style={{ color: 'var(--booking-danger)', fontSize: '0.875rem' }}>{formError}</p>}
          <button type="submit" className="bk-btn bk-btn--primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create charge'}
          </button>
        </form>
      </div>

      <h3>All charges</h3>
      {charges.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No charges yet.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Due date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charges.map(c => (
              <tr key={c.id}>
                <td>{c.user.firstName} {c.user.lastName}</td>
                <td>{c.description}</td>
                <td>£{(c.amount / 100).toFixed(2)}</td>
                <td>{new Date(c.dueDate).toLocaleDateString('en-GB')}</td>
                <td>{c.paidAt ? <span style={{ color: 'var(--booking-success)' }}>Paid</span> : 'Unpaid'}</td>
                <td>
                  <button
                    className="bk-btn bk-btn--danger bk-btn--sm"
                    onClick={() => handleDelete(c.id)}
                    disabled={!!c.paidAt}
                    title={c.paidAt ? 'Cannot delete paid charge' : 'Delete'}
                  >
                    Delete
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

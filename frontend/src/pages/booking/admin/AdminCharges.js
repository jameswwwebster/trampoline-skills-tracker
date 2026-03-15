import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminCharges() {
  const [charges, setCharges] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bookingApi.getAdminCharges(),
      bookingApi.getAllCredits(),
    ])
      .then(([chargesRes, creditsRes]) => {
        setCharges(chargesRes.data);
        setCredits(creditsRes.data.filter(u => u.totalCredits > 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      <h2>Credits &amp; Charges</h2>

      <section style={{ marginBottom: '2.5rem' }}>
        <h3>Credits</h3>
        {credits.length === 0 ? (
          <p style={{ color: 'var(--booking-text-muted)' }}>No active credits.</p>
        ) : (
          <table className="bk-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Total credits</th>
              </tr>
            </thead>
            <tbody>
              {credits.map(u => (
                <tr key={u.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.email}</td>
                  <td style={{ textAlign: 'right', color: 'var(--booking-accent)', fontWeight: 600 }}>
                    £{(u.totalCredits / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Charges</h3>
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
      </section>
    </div>
  );
}

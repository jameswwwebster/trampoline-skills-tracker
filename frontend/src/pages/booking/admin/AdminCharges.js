import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminCharges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getAdminCharges()
      .then(r => setCharges(r.data))
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
      <h2>Charges</h2>

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

import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

export default function AdminCharges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.getAdminCharges()
      .then(r => setCharges(r.data))
      .catch(() => setError('Failed to load charges. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bk-page"><p>Loading…</p></div>;
  if (error) return <div className="bk-page" style={{ maxWidth: '800px' }}><p className="bk-error">{error}</p></div>;

  return (
    <div className="bk-page" style={{ maxWidth: '800px' }}>
      <h2>Charges</h2>

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
            </tr>
          </thead>
          <tbody>
            {charges.map(c => (
              <tr key={c.id}>
                <td>{c.user.firstName} {c.user.lastName}</td>
                <td>{c.description}</td>
                <td>£{(c.amount / 100).toFixed(2)}</td>
                <td>{new Date(c.dueDate).toLocaleDateString('en-GB')}</td>
                <td>
                  {c.paidAt
                    ? <span style={{ color: 'var(--booking-success)' }}>{c.paidWithCredit ? 'Paid (credit)' : 'Paid'}</span>
                    : 'Unpaid'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

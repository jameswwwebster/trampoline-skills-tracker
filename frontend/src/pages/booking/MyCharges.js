import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';

export default function MyCharges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const paid = searchParams.get('paid') === 'true';

  useEffect(() => {
    bookingApi.getMyCharges()
      .then(r => setCharges(r.data))
      .catch(() => setError('Failed to load charges. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bk-page"><p>Loading…</p></div>;
  if (error) return <div className="bk-page bk-page--sm"><p className="bk-error">{error}</p></div>;

  return (
    <div className="bk-page bk-page--sm">
      <h2>My Charges</h2>

      {paid && (
        <div style={{ background: 'var(--booking-success-bg, #d4edda)', color: 'var(--booking-success, #155724)', border: '1px solid var(--booking-success-border, #c3e6cb)', borderRadius: '0.375rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          Your charges have been settled. Thank you!
        </div>
      )}

      {charges.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No outstanding charges.</p>
      ) : (
        <>
          <Link
            to="/booking/cart"
            className="bk-btn bk-btn--primary"
            style={{ display: 'inline-block', marginBottom: '1rem' }}
          >
            Pay now →
          </Link>
          <table className="bk-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {charges.map(c => (
                <tr key={c.id}>
                  <td>{c.description}</td>
                  <td>£{(c.amount / 100).toFixed(2)}</td>
                  <td>{new Date(c.dueDate).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

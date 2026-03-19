import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function MyCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getMyCredits().then(res => setCredits(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bk-center">Loading...</p>;

  const total = credits.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="bk-page bk-page--md">
      <h2>My Credits</h2>
      {credits.length === 0 && <p>No credits available.</p>}
      {credits.length > 0 && (
        <>
          <p style={{ fontWeight: 600 }}>Total available: £{(total / 100).toFixed(2)}</p>
          {credits.map(c => (
            <div key={c.id} className="bk-card bk-row bk-row--between">
              <div>
                <span>£{(c.amount / 100).toFixed(2)}</span>
                {c.note && <span className="bk-muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>{c.note}</span>}
              </div>
              <span className="bk-muted" style={{ fontSize: '0.85rem' }}>
                Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

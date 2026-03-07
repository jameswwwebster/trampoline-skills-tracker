import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';

export default function MyCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getMyCredits().then(res => setCredits(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading...</p>;

  const total = credits.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      <h2>My Credits</h2>
      {credits.length === 0 && <p>No credits available.</p>}
      {credits.length > 0 && (
        <>
          <p style={{ fontWeight: 600 }}>Total available: £{(total / 100).toFixed(2)}</p>
          {credits.map(c => (
            <div key={c.id} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>£{(c.amount / 100).toFixed(2)}</span>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>
                Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

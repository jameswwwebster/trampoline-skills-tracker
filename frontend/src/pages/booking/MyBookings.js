import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const load = () => {
    bookingApi.getMyBookings().then(res => setBookings(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Cancel this booking? A credit will be issued for each gymnast.')) return;
    setCancelling(bookingId);
    try {
      await bookingApi.cancelBooking(bookingId);
      load();
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      <h2>My Bookings</h2>
      {bookings.length === 0 && <p>No upcoming bookings.</p>}
      {bookings.map(b => {
        const d = new Date(b.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        return (
          <div key={b.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem' }}>
            <strong>{dateStr} — {b.sessionInstance.template.startTime}–{b.sessionInstance.template.endTime}</strong>
            <p style={{ margin: '0.25rem 0', color: '#555' }}>
              {b.lines.map(l => `${l.gymnast.firstName} ${l.gymnast.lastName}`).join(', ')}
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
              Total: £{(b.totalAmount / 100).toFixed(2)} · Status: {b.status}
            </p>
            {b.status === 'CONFIRMED' && (
              <button
                onClick={() => handleCancel(b.id)}
                disabled={cancelling === b.id}
                style={{ marginTop: '0.5rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.8rem', cursor: 'pointer' }}
              >
                {cancelling === b.id ? 'Cancelling...' : 'Cancel booking'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

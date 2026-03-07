import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

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

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Bookings</h2>
      {bookings.length === 0 && <p>No upcoming bookings.</p>}
      {bookings.map(b => {
        const d = new Date(b.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        return (
          <div key={b.id} className="bk-card">
            <strong>{dateStr} — {b.sessionInstance.template.startTime}–{b.sessionInstance.template.endTime}</strong>
            <p style={{ margin: '0.25rem 0' }} className="bk-muted">
              {b.lines.map(l => `${l.gymnast.firstName} ${l.gymnast.lastName}`).join(', ')}
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
              Total: £{(b.totalAmount / 100).toFixed(2)} · Status: {b.status}
            </p>
            {b.status === 'CONFIRMED' && (
              <button
                onClick={() => handleCancel(b.id)}
                disabled={cancelling === b.id}
                className="bk-btn bk-btn--danger bk-btn--sm"
                style={{ marginTop: '0.5rem' }}
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

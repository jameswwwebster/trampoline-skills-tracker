import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

function isToday(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const COMMITMENT_STATUS_LABEL = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  WAITLISTED: 'Waitlisted',
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    Promise.all([
      bookingApi.getMyBookings(),
      bookingApi.getMyWaitlist().catch(() => ({ data: [] })),
      bookingApi.getMyCommitments().catch(() => ({ data: [] })),
    ]).then(([bRes, wRes, cRes]) => {
      setBookings(bRes.data.filter(b => b.status === 'CONFIRMED'));
      setWaitlist(wRes.data);
      setCommitments(cRes.data);
    }).catch(() => {
      setError('Failed to load bookings. Please refresh.');
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCancel = async (bookingId, sessionDate) => {
    const dayOf = isToday(sessionDate);
    const msg = dayOf
      ? 'Cancel this booking? Same-day cancellations do not receive a credit refund.'
      : 'Cancel this booking? A credit will be issued for each gymnast.';
    if (!window.confirm(msg)) return;
    setCancelling(bookingId);
    setCancelError(null);
    try {
      await bookingApi.cancelBooking(bookingId);
      load();
    } catch {
      setCancelError('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;
  if (error) return <div className="bk-page bk-page--md"><p className="bk-error">{error}</p></div>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Bookings</h2>
      {cancelError && <p className="bk-error">{cancelError}</p>}

      {waitlist.filter(e => e.status === 'OFFERED').map(e => {
        const d = new Date(e.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        return (
          <div key={e.id} className="bk-card" style={{ borderColor: 'var(--booking-accent)', borderWidth: 2 }}>
            <p style={{ fontWeight: 700, color: 'var(--booking-accent)', marginBottom: '0.25rem' }}>
              A slot opened up for you!
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              {dateStr} — {e.sessionInstance.template.startTime}–{e.sessionInstance.template.endTime}
            </p>
            {e.offerExpiresAt && (
              <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Offer expires at {new Date(e.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button
              className="bk-btn bk-btn--primary bk-btn--sm"
              onClick={() => navigate(`/booking/session/${e.sessionInstanceId}`)}
            >
              Claim slot
            </button>
          </div>
        );
      })}

      {commitments.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Standing Slots</h3>
          {commitments.map(c => (
            <div key={c.id} className="bk-card">
              <strong>{DAYS[c.template.dayOfWeek]}s — {c.template.startTime}–{c.template.endTime}</strong>
              <p style={{ margin: '0.25rem 0' }} className="bk-muted">
                {c.gymnast.firstName} {c.gymnast.lastName}
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                Status: {COMMITMENT_STATUS_LABEL[c.status] ?? c.status}
              </p>
            </div>
          ))}
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Upcoming Bookings</h3>
        </>
      )}

      {bookings.length === 0 && <p>No upcoming bookings.</p>}
      {bookings.map(b => {
        const d = new Date(b.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const dayOf = isToday(b.sessionInstance.date);
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
              <>
                {dayOf && (
                  <p className="bk-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    Same-day cancellation — no credit refund.
                  </p>
                )}
                <button
                  onClick={() => handleCancel(b.id, b.sessionInstance.date)}
                  disabled={cancelling === b.id}
                  className="bk-btn bk-btn--danger bk-btn--sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  {cancelling === b.id ? 'Cancelling...' : 'Cancel booking'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

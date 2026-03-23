import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function MyWaitlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    bookingApi.getMyWaitlist()
      .then(res => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleLeave = async (instanceId) => {
    if (!window.confirm('Leave this waitlist?')) return;
    setBusy(instanceId);
    try {
      await bookingApi.leaveWaitlist(instanceId);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Waitlist</h2>

      {entries.length === 0 && (
        <p className="bk-muted">You're not on any waitlists.</p>
      )}

      {entries.map(e => {
        const d = new Date(e.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = `${e.sessionInstance.template.startTime}–${e.sessionInstance.template.endTime}`;
        const isOffered = e.status === 'OFFERED';

        return (
          <div
            key={e.id}
            className="bk-card"
            style={isOffered ? { borderColor: 'var(--booking-accent)', borderWidth: 2 } : undefined}
          >
            <strong>{dateStr} — {timeStr}</strong>

            {isOffered ? (
              <>
                <p style={{ color: 'var(--booking-accent)', fontWeight: 700, margin: '0.25rem 0' }}>
                  A slot is available!
                  {e.offerExpiresAt && (
                    <> Claim it before {new Date(e.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</>
                  )}
                </p>
                <button
                  className="bk-btn bk-btn--primary bk-btn--sm"
                  onClick={() => navigate(`/booking/session/${e.sessionInstanceId}`)}
                >
                  Book now
                </button>
              </>
            ) : (
              <>
                <p className="bk-muted" style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                  You're on the waitlist.
                </p>
                <button
                  className="bk-btn bk-btn--secondary bk-btn--sm"
                  onClick={() => handleLeave(e.sessionInstanceId)}
                  disabled={busy === e.sessionInstanceId}
                >
                  {busy === e.sessionInstanceId ? 'Leaving...' : 'Leave waitlist'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

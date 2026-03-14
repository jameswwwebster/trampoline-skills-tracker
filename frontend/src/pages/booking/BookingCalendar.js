import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import CalendarNav from './CalendarNav';
import SessionDetail from './SessionDetail';
import './BookingCalendar.css';

export default function BookingCalendar() {
  const [sessions, setSessions] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('booking-cart');
      return saved ? new Map(JSON.parse(saved)) : new Map();
    } catch { return new Map(); }
  });
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem('booking-cart', JSON.stringify([...cart]));
    window.dispatchEvent(new CustomEvent('booking-cart-update'));
  }, [cart]);

  const handleNavigate = (date) => {
    setSelectedSessionId(null);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    setLoading(true);
    // Fetch both months if week spans a boundary
    const ws = new Date(date);
    ws.setDate(ws.getDate() - ws.getDay());
    ws.setHours(0, 0, 0, 0);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const fetchMonths = [{ y, m }];
    if (we.getMonth() + 1 !== m || we.getFullYear() !== y) {
      fetchMonths.push({ y: we.getFullYear(), m: we.getMonth() + 1 });
    }
    Promise.all([
      ...fetchMonths.map(({ y: fy, m: fm }) => bookingApi.getSessions(fy, fm)),
      bookingApi.getClosures(),
    ]).then((results) => {
      setSessions(results.slice(0, -1).flatMap(r => r.data));
      setClosures(results[results.length - 1].data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  const hasStarted = (s) => {
    const [h, m] = s.startTime.split(':').map(Number);
    const start = new Date(s.date);
    start.setHours(h, m, 0, 0);
    return new Date() >= start;
  };

  const sessionClass = (s, isPast) => {
    if (s.isBooked) return 'booked';
    if (s.availableSlots > 0 && !s.cancelledAt && !isPast && !hasStarted(s)) return 'open';
    return 'full';
  };

  const sessionLabel = (s) => {
    if (s.cancelledAt) return 'Cancelled';
    if (s.isBooked) return 'Booked';
    if (s.availableSlots === 0) return 'Full';
    if (hasStarted(s)) return 'Started';
    return `${s.availableSlots} left`;
  };

  const handleCartUpdate = (sessionId, gymnasts) => {
    setCart(prev => {
      const next = new Map(prev);
      if (gymnasts.length === 0) next.delete(sessionId);
      else next.set(sessionId, gymnasts);
      return next;
    });
  };

  const cartEntries = Array.from(cart.entries());
  const cartTotalSlots = cartEntries.reduce((sum, [, g]) => sum + g.length, 0);
  const cartTotalAmount = cartEntries.reduce((sum, [sessionId, gymnasts]) => {
    const session = sessions.find(s => s.id === sessionId);
    const price = session?.pricePerGymnast ?? 600;
    return sum + price * gymnasts.length;
  }, 0);

  const handleCartCheckout = () => {
    navigate('/booking/cart');
  };

  return (
    <>
      <CalendarNav
        sessions={sessions}
        onNavigate={handleNavigate}
        loading={loading}
        closures={closures}
        renderDayDots={(date, daySessions, isPast, isClosed) => {
          if (isClosed) return null;
          return daySessions.slice(0, 3).map((s, i) => {
            const type = sessionClass(s, isPast);
            return (
              <span
                key={i}
                className={`booking-calendar__week-dot${
                  type === 'booked' ? ' booking-calendar__week-dot--booked'
                  : type === 'full' ? ' booking-calendar__week-dot--full'
                  : ''
                }`}
              />
            );
          });
        }}
        renderDayPanel={(date, daySessions, isPast, isClosed) => (
          <>
            <p className="booking-calendar__day-detail-heading">
              {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {selectedSessionId ? (
              <SessionDetail
                instanceId={selectedSessionId}
                onClose={() => setSelectedSessionId(null)}
                cartMode
                cartGymnastIds={(cart.get(selectedSessionId) || []).map(g => g.id)}
                onCartUpdate={handleCartUpdate}
              />
            ) : (
              <>
                {isClosed && <p className="booking-calendar__day-closed">Closed</p>}
                {!isClosed && daySessions.length === 0 && (
                  <p className="booking-calendar__day-empty">No sessions</p>
                )}
                {!isClosed && daySessions.map(s => (
                  <button
                    key={s.id}
                    className={`booking-calendar__day-session booking-calendar__day-session--${sessionClass(s, isPast)}`}
                    disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || isPast || hasStarted(s)}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}
                      {s.type === 'DMT' && (
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                          background: '#e67e22', borderRadius: 3,
                          padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
                        }}>
                          DMT
                        </span>
                      )}
                      {s.type === 'TRAMPOLINE' && (
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                          background: 'var(--booking-accent)', borderRadius: 3,
                          padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
                        }}>
                          Trampoline
                        </span>
                      )}
                      {s.minAge && (
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-text-on-dark)',
                          background: 'var(--booking-danger)', borderRadius: 3,
                          padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
                        }}>
                          {s.minAge}+
                        </span>
                      )}
                    </span>
                    <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
        renderMonthCell={(date, daySessions, isToday, isPast, isClosed) => (
          <>
            {isClosed && <span className="booking-calendar__closed-label">Closed</span>}
            {!isClosed && daySessions.map(s => (
              <div key={s.id} className={`booking-calendar__session booking-calendar__session--${sessionClass(s, isPast)}`}>
                {s.startTime}
              </div>
            ))}
          </>
        )}
        getMonthCellClass={(date, daySessions, isPast, isClosed) => {
          if (isClosed) return 'booking-calendar__cell--closed';
          if (isPast) return 'booking-calendar__cell--past';
          if (daySessions.some(s => s.isBooked)) return 'booking-calendar__cell--booked';
          const hasAvailable = daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt);
          if (hasAvailable) return 'booking-calendar__cell--available';
          if (daySessions.length > 0) return 'booking-calendar__cell--full';
          return '';
        }}
      />

      {cartTotalSlots > 0 && (
        <div className="booking-calendar__cart-bar">
          <div className="booking-calendar__cart-items">
            {cartEntries.map(([sessionId, gymnasts]) => {
              const session = sessions.find(s => s.id === sessionId);
              return (
                <div key={sessionId} className="booking-calendar__cart-item">
                  <span>
                    {session
                      ? `${session.startTime}–${session.endTime}, ${new Date(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
                      : sessionId}
                    {' — '}{gymnasts.map(g => g.firstName).join(', ')}
                  </span>
                  <button
                    className="booking-calendar__cart-remove"
                    aria-label="Remove"
                    onClick={() => handleCartUpdate(sessionId, [])}
                  >×</button>
                </div>
              );
            })}
          </div>
          <div className="booking-calendar__cart-summary">
            <span>{cartTotalSlots} slot{cartTotalSlots !== 1 ? 's' : ''} · £{(cartTotalAmount / 100).toFixed(2)}</span>
            <button className="booking-calendar__cart-checkout-btn" onClick={handleCartCheckout}>
              Checkout →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

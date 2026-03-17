import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import './SessionDetail.css';

export default function SessionDetail({
  instanceId: propInstanceId,
  onClose,
  cartMode = false,
  cartGymnastIds = [],
  onCartUpdate = () => {},
}) {
  const { instanceId: paramInstanceId } = useParams();
  const instanceId = propInstanceId || paramInstanceId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [myGymnasts, setMyGymnasts] = useState([]);
  const [localSelectedGymnastIds, setLocalSelectedGymnastIds] = useState([]);
  const selectedGymnastIds = cartMode ? cartGymnastIds : localSelectedGymnastIds;
  const [totalCreditsAvailable, setTotalCreditsAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);
  const [waitlistEntry, setWaitlistEntry] = useState(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState(null); // gymnast awaiting member confirmation
  const [myCommitments, setMyCommitments] = useState([]); // [{ gymnastId, status }]
  const [conflictingGymnastIds, setConflictingGymnastIds] = useState(new Set());

  const loadGymnasts = () =>
    bookingApi.getBookableGymnasts().then(r => setMyGymnasts(r.data)).catch(() => setMyGymnasts([]));

  useEffect(() => {
    Promise.all([
      bookingApi.getSession(instanceId),
      bookingApi.getMyCredits().catch(() => ({ data: [] })),
      bookingApi.getMyWaitlist().catch(() => ({ data: [] })),
      bookingApi.getMyBookings().catch(() => ({ data: [] })),
    ]).then(([sessRes, credRes, waitRes, bookingsRes]) => {
      const sess = sessRes.data;
      setSession(sess);
      setTotalCreditsAvailable(credRes.data.reduce((s, c) => s + c.amount, 0));
      const entry = waitRes.data.find(e => e.sessionInstanceId === instanceId);
      setWaitlistEntry(entry || null);
      if (sess.templateId) {
        bookingApi.getMyCommitmentsForTemplate(sess.templateId)
          .then(r => setMyCommitments(r.data))
          .catch(() => {});
      }
      // Compute gymnasts with time-overlapping bookings on the same day
      const sessDate = new Date(sess.date).toDateString();
      const conflictIds = new Set();
      for (const booking of bookingsRes.data) {
        if (booking.sessionInstance.id === instanceId) continue;
        if (new Date(booking.sessionInstance.date).toDateString() !== sessDate) continue;
        const { startTime, endTime } = booking.sessionInstance.template;
        if (sess.startTime < endTime && startTime < sess.endTime) {
          booking.lines.forEach(l => conflictIds.add(l.gymnast.id));
        }
      }
      setConflictingGymnastIds(conflictIds);
    }).catch(console.error).finally(() => setLoading(false));

    loadGymnasts();
  }, [instanceId]);

  const handleBookForMyself = async () => {
    try {
      const res = await bookingApi.createSelfGymnast();
      await loadGymnasts();
      setLocalSelectedGymnastIds(ids => ids.includes(res.data.id) ? ids : [...ids, res.data.id]);
    } catch (err) {
      setError('Could not create self-booking record. Please try again.');
    }
  };

  // Filter gymnasts by age restriction
  const eligibleGymnasts = session?.minAge
    ? myGymnasts.filter(g => {
        if (!g.dateOfBirth) return false;
        const age = Math.floor((new Date(session.date) - new Date(g.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= session.minAge;
      })
    : myGymnasts;

  const alreadyBookedGymnastIds = new Set(
    session?.bookings?.flatMap(b => b.lines.map(l => l.gymnast.id)) ?? []
  );

  const bookableGymnasts = eligibleGymnasts.filter(g => !g.hasMembership);
  const memberGymnasts = eligibleGymnasts.filter(g => g.hasMembership);

  const hasSelf = myGymnasts.some(g => g.isSelf);

  const toggleGymnast = (id) => {
    if (cartMode) {
      const isSelected = cartGymnastIds.includes(id);
      const gymnast = myGymnasts.find(g => g.id === id);
      const currentSelected = myGymnasts.filter(g => cartGymnastIds.includes(g.id));
      const newGymnasts = isSelected
        ? currentSelected.filter(g => g.id !== id)
        : [...currentSelected, gymnast];
      onCartUpdate(instanceId, newGymnasts);
    } else {
      setLocalSelectedGymnastIds(prev =>
        prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
      );
    }
  };

  const totalAmount = selectedGymnastIds.length * (session?.pricePerGymnast ?? 600);
  const creditAmount = Math.min(totalCreditsAvailable, totalAmount);
  const chargeAmount = Math.max(0, totalAmount - creditAmount);

  const handleBook = async () => {
    if (selectedGymnastIds.length === 0) return;
    setBooking(true);
    setError(null);
    try {
      const res = await bookingApi.createBooking({
        sessionInstanceId: instanceId,
        gymnastIds: selectedGymnastIds,
      });

      if (res.data.clientSecret) {
        navigate(`/booking/checkout/${res.data.booking.id}`, {
          state: { clientSecret: res.data.clientSecret },
        });
      } else {
        navigate(`/booking/confirmation/${res.data.booking.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      const res = await bookingApi.joinWaitlist(instanceId);
      setWaitlistEntry(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join waitlist.');
    } finally {
      setWaitlistBusy(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      await bookingApi.leaveWaitlist(instanceId);
      setWaitlistEntry(null);
    } catch (err) {
      setError('Could not leave waitlist.');
    } finally {
      setWaitlistBusy(false);
    }
  };

  if (loading) return <div className="session-detail__loading">Loading session...</div>;
  if (!session) return <div className="session-detail__error">Session not found.</div>;

  const sessionDate = new Date(session.date);
  const dateStr = sessionDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="session-detail">
      <button className="session-detail__back" onClick={() => onClose ? onClose() : navigate('/booking')}>
        &larr; Back to calendar
      </button>

      <div className="session-detail__info">
        <h2>{dateStr}</h2>
        <p>{session.startTime} – {session.endTime}</p>
        {session.minAge && <p className="session-detail__age-restriction">{session.minAge}+ only</p>}
        <p>
          <strong style={{
            color: !session.cancelledAt && session.availableSlots <= 3 ? 'var(--booking-danger)'
                 : !session.cancelledAt && session.availableSlots <= 5 ? '#e67e22'
                 : undefined
          }}>
            {session.availableSlots}
          </strong>{' '}of {session.capacity} slots available
        </p>
        {session.cancelledAt && (
          <p className="session-detail__cancelled">This session has been cancelled.</p>
        )}
      </div>

      {session.information && (
        <div
          className="bk-session-info"
          dangerouslySetInnerHTML={{ __html: session.information }}
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderLeft: '3px solid var(--booking-border)',
            fontSize: '0.8rem',
            color: 'var(--booking-text-muted)',
            lineHeight: 1.5,
          }}
        />
      )}

      {!session.cancelledAt && session.availableSlots === 0 && (
        <div className="session-detail__waitlist">
          {waitlistEntry?.status === 'OFFERED' ? (
            <>
              <p className="session-detail__waitlist-offered">
                A slot is available for you! Claim it before{' '}
                {new Date(waitlistEntry.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
                Go back to the calendar and book this session to claim your slot.
              </p>
            </>
          ) : waitlistEntry?.status === 'WAITING' ? (
            <>
              <p className="session-detail__waitlist-waiting">
                You're on the waitlist. We'll let you know if a slot becomes available.
              </p>
              <button
                className="session-detail__add-btn"
                onClick={handleLeaveWaitlist}
                disabled={waitlistBusy}
              >
                {waitlistBusy ? 'Leaving...' : 'Leave waitlist'}
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
                This session is full.
              </p>
              <button
                className="session-detail__book-btn"
                onClick={handleJoinWaitlist}
                disabled={waitlistBusy}
              >
                {waitlistBusy ? 'Joining...' : 'Join waitlist'}
              </button>
            </>
          )}
          {error && <p className="session-detail__error">{error}</p>}
        </div>
      )}

      {!session.cancelledAt && session.availableSlots > 0 && (
        <>
          <div className="session-detail__gymnasts">
            <h3>Who's coming?</h3>

            {bookableGymnasts.map(g => {
              const isDmtSession = session?.type === 'DMT';
              const dmtBlocked = isDmtSession && !g.dmtApproved;
              const myCommitment = myCommitments.find(c => c.gymnastId === g.id);
              const hasActiveCommitment = myCommitment?.status === 'ACTIVE';
              const alreadyBooked = alreadyBookedGymnastIds.has(g.id);
              const hasTimeConflict = conflictingGymnastIds.has(g.id);
              const selected = selectedGymnastIds.includes(g.id);
              const now = Date.now();
              const bgBlocked = (() => {
                if (!g.bgNumber && (g.pastSessionCount >= 2 || g.hasMembership)) return true;
                if (g.bgNumberStatus === 'INVALID') return true;
                if (g.bgNumberStatus === 'PENDING' && g.bgNumberEnteredAt && g.bgNumberGraceDays) {
                  const graceMs = g.bgNumberGraceDays * 24 * 60 * 60 * 1000;
                  if (now - new Date(g.bgNumberEnteredAt) > graceMs) return true;
                }
                return false;
              })();
              const atCapacity = !selected && selectedGymnastIds.length >= session.availableSlots;
              const blocked = bgBlocked || dmtBlocked || hasActiveCommitment || alreadyBooked || hasTimeConflict;
              return (
                <div key={g.id}>
                  <div
                    role="checkbox"
                    aria-checked={selected}
                    className={[
                      'session-detail__gymnast-option',
                      selected ? 'session-detail__gymnast-option--selected' : '',
                      (atCapacity || blocked) ? 'session-detail__gymnast-option--disabled' : '',
                    ].join(' ')}
                    onClick={(atCapacity || blocked) ? undefined : () => toggleGymnast(g.id)}
                  >
                    <span className="session-detail__option-check">
                      {selected && '✓'}
                    </span>
                    <span>{g.firstName} {g.lastName}{g.isSelf ? ' (me)' : ''}
                      {dmtBlocked && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--booking-text-muted)', marginLeft: '0.4rem' }}>
                          Not approved for DMT — speak to a coach.
                        </span>
                      )}
                    </span>
                  </div>
                  {bgBlocked && (() => {
                    const s = { fontSize: '0.8rem', color: 'var(--booking-danger)', margin: '-0.25rem 0 0.5rem 0.5rem' };
                    const a = { color: 'var(--booking-danger)' };
                    if (g.bgNumberStatus === 'INVALID') return (
                      <p style={s}>BG number couldn't be verified — <a href="/booking/my-account" style={a}>check it in My Account</a></p>
                    );
                    if (g.bgNumberStatus === 'PENDING') return (
                      <p style={s}>BG number is still being verified — bookings are blocked until it's confirmed. <a href="/booking/my-account" style={a}>Check it in My Account</a></p>
                    );
                    return (
                      <p style={s}>BG membership number required — <a href="/booking/my-account" style={a}>add it in My Account</a></p>
                    );
                  })()}
                  {!bgBlocked && !g.bgNumber && g.pastSessionCount === 1 && (
                    <p style={{ fontSize: '0.78rem', color: '#e67e22', margin: '-0.25rem 0 0.5rem 0.5rem' }}>
                      1 free session remaining — a BG number will be required after this.{' '}
                      <a href="/booking/my-account" style={{ color: '#e67e22' }}>Add it in My Account</a>
                    </p>
                  )}
                  {hasActiveCommitment && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-success)', fontWeight: 500 }}>
                      Standing slot — you're already booked for this session.
                    </p>
                  )}
                  {alreadyBooked && !hasActiveCommitment && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-text-muted)', fontWeight: 500 }}>
                      Already booked for this session.
                    </p>
                  )}
                  {hasTimeConflict && !alreadyBooked && !hasActiveCommitment && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-text-muted)', fontWeight: 500 }}>
                      Already booked into another session at this time.
                    </p>
                  )}
                </div>
              );
            })}
            {memberGymnasts.map(g => {
              const selected = selectedGymnastIds.includes(g.id);
              const isPending = pendingMemberId === g.id;
              const alreadyBooked = alreadyBookedGymnastIds.has(g.id);
              const hasTimeConflict = conflictingGymnastIds.has(g.id);
              const atCapacity = !selected && selectedGymnastIds.length >= session.availableSlots;
              return (
                <div key={g.id} style={{ marginBottom: '0.25rem' }}>
                  <div
                    role="checkbox"
                    aria-checked={selected}
                    className={[
                      'session-detail__gymnast-option',
                      selected ? 'session-detail__gymnast-option--selected' : '',
                      (atCapacity && !selected) || alreadyBooked || hasTimeConflict ? 'session-detail__gymnast-option--disabled' : '',
                    ].join(' ')}
                    onClick={() => {
                      if (alreadyBooked || hasTimeConflict) return;
                      if (selected) {
                        toggleGymnast(g.id);
                        setPendingMemberId(null);
                      } else if (!atCapacity) {
                        setPendingMemberId(g.id);
                      }
                    }}
                  >
                    <span className="session-detail__option-check">{selected && '✓'}</span>
                    <span>{g.firstName} {g.lastName}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--booking-success)', fontWeight: 600 }}>Member</span>
                  </div>
                  {isPending && !alreadyBooked && (
                    <div style={{ margin: '0.25rem 0 0.5rem', padding: '0.6rem 0.75rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Book an extra session?</p>
                      <p style={{ margin: '0 0 0.5rem', color: 'var(--booking-text-muted)' }}>
                        {g.firstName} has a monthly membership and doesn't normally need to book. This will use one of the open slots and cost £6.00.
                      </p>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="bk-btn bk-btn--sm bk-btn--primary"
                          onClick={e => { e.stopPropagation(); toggleGymnast(g.id); setPendingMemberId(null); }}
                        >Yes, book the extra session</button>
                        <button
                          className="bk-btn bk-btn--sm"
                          style={{ border: '1px solid var(--booking-border)' }}
                          onClick={e => { e.stopPropagation(); setPendingMemberId(null); }}
                        >Cancel</button>
                      </div>
                    </div>
                  )}
                  {alreadyBooked && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-text-muted)', fontWeight: 500 }}>
                      Already booked for this session.
                    </p>
                  )}
                  {hasTimeConflict && !alreadyBooked && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-text-muted)', fontWeight: 500 }}>
                      Already booked into another session at this time.
                    </p>
                  )}
                </div>
              );
            })}
            {selectedGymnastIds.length >= session.availableSlots && bookableGymnasts.length > selectedGymnastIds.length && (
              <p className="session-detail__slots-warning">
                Only {session.availableSlots} slot{session.availableSlots !== 1 ? 's' : ''} available — deselect someone to change your selection.
              </p>
            )}

            {session.minAge && myGymnasts.length > eligibleGymnasts.length && (
              <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
                Some people are hidden because they don't meet the {session.minAge}+ age requirement.
              </p>
            )}

            <div className="session-detail__actions">
              {!hasSelf && (
                <button className="session-detail__add-btn" onClick={handleBookForMyself}>
                  + Book for myself
                </button>
              )}
            </div>

            {!myGymnasts.some(g => !g.isSelf) && (
              <p style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginTop: '0.5rem' }}>
                No children added yet.{' '}
                <Link to="/booking/my-account" style={{ color: 'var(--booking-accent)', fontWeight: 600 }}>
                  Add a child in My Account
                </Link>
                {' '}to book for them.
              </p>
            )}
          </div>

          {cartMode ? (
            selectedGymnastIds.length > 0 && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--booking-success)', fontWeight: 600 }}>
                {selectedGymnastIds.length} gymnast{selectedGymnastIds.length !== 1 ? 's' : ''} added to cart
              </p>
            )
          ) : (
            <>
              {totalCreditsAvailable > 0 && (
                <p className="session-detail__credit-notice">
                  £{(creditAmount / 100).toFixed(2)} credit will be applied automatically.
                </p>
              )}
              {selectedGymnastIds.length > 0 && (
                <div className="session-detail__summary">
                  <p>Gymnasts: {selectedGymnastIds.length} × £6.00 = £{(totalAmount / 100).toFixed(2)}</p>
                  {creditAmount > 0 && <p>Credits applied: –£{(creditAmount / 100).toFixed(2)}</p>}
                  <p><strong>Total: £{(chargeAmount / 100).toFixed(2)}</strong></p>
                </div>
              )}
              {error && <p className="session-detail__error">{error}</p>}
              <button
                className="session-detail__book-btn"
                disabled={selectedGymnastIds.length === 0 || booking}
                onClick={handleBook}
              >
                {booking ? 'Processing...' : `Book${chargeAmount > 0 ? ` — £${(chargeAmount / 100).toFixed(2)}` : ' (Free)'}`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

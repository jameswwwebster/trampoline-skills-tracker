import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import './SessionDetail.css';

export default function SessionDetail() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [myGymnasts, setMyGymnasts] = useState([]);
  const [selectedGymnastIds, setSelectedGymnastIds] = useState([]);
  const [credits, setCredits] = useState([]);
  const [selectedCreditIds, setSelectedCreditIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);
  const [waitlistEntry, setWaitlistEntry] = useState(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);

  const loadGymnasts = () =>
    bookingApi.getBookableGymnasts().then(r => setMyGymnasts(r.data)).catch(() => setMyGymnasts([]));

  useEffect(() => {
    Promise.all([
      bookingApi.getSession(instanceId),
      bookingApi.getMyCredits().catch(() => ({ data: [] })),
      bookingApi.getMyWaitlist().catch(() => ({ data: [] })),
    ]).then(([sessRes, credRes, waitRes]) => {
      setSession(sessRes.data);
      setCredits(credRes.data);
      const entry = waitRes.data.find(e => e.sessionInstanceId === instanceId);
      setWaitlistEntry(entry || null);
    }).catch(console.error).finally(() => setLoading(false));

    loadGymnasts();
  }, [instanceId]);

  const handleBookForMyself = async () => {
    try {
      const res = await bookingApi.createSelfGymnast();
      await loadGymnasts();
      setSelectedGymnastIds(ids => ids.includes(res.data.id) ? ids : [...ids, res.data.id]);
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

  const hasSelf = myGymnasts.some(g => g.isSelf);

  const toggleGymnast = (id) => {
    setSelectedGymnastIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const toggleCredit = (id) => {
    setSelectedCreditIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const totalAmount = selectedGymnastIds.length * 600;
  const creditAmount = selectedCreditIds.reduce((sum, cid) => {
    const credit = credits.find(c => c.id === cid);
    return sum + (credit ? credit.amount : 0);
  }, 0);
  const chargeAmount = Math.max(0, totalAmount - creditAmount);

  const handleBook = async () => {
    if (selectedGymnastIds.length === 0) return;
    setBooking(true);
    setError(null);
    try {
      const res = await bookingApi.createBooking({
        sessionInstanceId: instanceId,
        gymnastIds: selectedGymnastIds,
        creditIds: selectedCreditIds,
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
      <button className="session-detail__back" onClick={() => navigate('/booking')}>
        &larr; Back to calendar
      </button>

      <div className="session-detail__info">
        <h2>{dateStr}</h2>
        <p>{session.startTime} – {session.endTime}</p>
        {session.minAge && <p className="session-detail__age-restriction">{session.minAge}+ only</p>}
        <p>{session.availableSlots} of {session.capacity} slots available</p>
        {session.cancelledAt && (
          <p className="session-detail__cancelled">This session has been cancelled.</p>
        )}
      </div>

      {session.information && (
        <div
          className="bk-session-info"
          dangerouslySetInnerHTML={{ __html: session.information }}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--booking-bg-light)',
            borderRadius: 'var(--booking-radius)',
            fontSize: '0.9rem',
            color: 'var(--booking-text-on-light)',
            lineHeight: 1.6,
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

            {eligibleGymnasts.map(g => {
              const selected = selectedGymnastIds.includes(g.id);
              const needsInsurance = g.pastSessionCount >= 2 && !g.bgInsuranceConfirmed;
              const atCapacity = !selected && selectedGymnastIds.length >= session.availableSlots;
              const blocked = needsInsurance;
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
                    <span>{g.firstName} {g.lastName}{g.isSelf ? ' (me)' : ''}</span>
                  </div>
                  {needsInsurance && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--booking-danger)', margin: '-0.25rem 0 0.5rem 0.5rem' }}>
                      Insurance confirmation required —{' '}
                      <a href="/booking/my-account" style={{ color: 'var(--booking-danger)' }}>confirm in My Account</a>
                    </p>
                  )}
                </div>
              );
            })}
            {selectedGymnastIds.length >= session.availableSlots && eligibleGymnasts.length > selectedGymnastIds.length && (
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

          {credits.length > 0 && (
            <div className="session-detail__credits">
              <h3>Apply credits</h3>
              {credits.map(c => {
                const selected = selectedCreditIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    role="checkbox"
                    aria-checked={selected}
                    className={`session-detail__credit-option${selected ? ' session-detail__credit-option--selected' : ''}`}
                    onClick={() => toggleCredit(c.id)}
                  >
                    <span className="session-detail__option-check">
                      {selected && '✓'}
                    </span>
                    <span>£{(c.amount / 100).toFixed(2)} — expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
                  </div>
                );
              })}
            </div>
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
    </div>
  );
}

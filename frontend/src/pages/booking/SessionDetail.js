import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  // Add-child form state
  const [showAddChild, setShowAddChild] = useState(false);
  const [childForm, setChildForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState(null);

  const loadGymnasts = () =>
    bookingApi.getBookableGymnasts().then(r => setMyGymnasts(r.data)).catch(() => setMyGymnasts([]));

  useEffect(() => {
    Promise.all([
      bookingApi.getSession(instanceId),
      bookingApi.getMyCredits().catch(() => ({ data: [] })),
    ]).then(([sessRes, credRes]) => {
      setSession(sessRes.data);
      setCredits(credRes.data);
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

  const handleAddChild = async (e) => {
    e.preventDefault();
    setAddingChild(true);
    setAddChildError(null);
    try {
      const res = await bookingApi.addChild(childForm);
      await loadGymnasts();
      setSelectedGymnastIds(ids => [...ids, res.data.id]);
      setChildForm({ firstName: '', lastName: '', dateOfBirth: '' });
      setShowAddChild(false);
    } catch (err) {
      setAddChildError(err.response?.data?.error || 'Failed to add child.');
    } finally {
      setAddingChild(false);
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

      {!session.cancelledAt && session.availableSlots > 0 && (
        <>
          <div className="session-detail__gymnasts">
            <h3>Who's coming?</h3>

            {eligibleGymnasts.map(g => {
              const selected = selectedGymnastIds.includes(g.id);
              const atCapacity = !selected && selectedGymnastIds.length >= session.availableSlots;
              return (
                <label
                  key={g.id}
                  className={[
                    'session-detail__gymnast-option',
                    selected ? 'session-detail__gymnast-option--selected' : '',
                    atCapacity ? 'session-detail__gymnast-option--disabled' : '',
                  ].join(' ')}
                  onClick={atCapacity ? undefined : () => toggleGymnast(g.id)}
                >
                  <input type="checkbox" checked={selected} readOnly />
                  <span className="session-detail__option-check">
                    {selected && '✓'}
                  </span>
                  <span>{g.firstName} {g.lastName}{g.isSelf ? ' (me)' : ''}</span>
                </label>
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
              <button className="session-detail__add-btn" onClick={() => setShowAddChild(v => !v)}>
                {showAddChild ? 'Cancel' : '+ Add a child'}
              </button>
            </div>

            {showAddChild && (
              <form className="session-detail__add-child-form" onSubmit={handleAddChild}>
                <div className="session-detail__add-child-row">
                  <input
                    placeholder="First name"
                    value={childForm.firstName}
                    onChange={e => setChildForm(f => ({ ...f, firstName: e.target.value }))}
                    required
                    className="session-detail__add-child-input"
                  />
                  <input
                    placeholder="Last name"
                    value={childForm.lastName}
                    onChange={e => setChildForm(f => ({ ...f, lastName: e.target.value }))}
                    required
                    className="session-detail__add-child-input"
                  />
                  <input
                    type="date"
                    value={childForm.dateOfBirth}
                    onChange={e => setChildForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                    className="session-detail__add-child-input"
                    placeholder="Date of birth (optional)"
                  />
                </div>
                {addChildError && <p className="session-detail__error">{addChildError}</p>}
                <button type="submit" disabled={addingChild} className="session-detail__add-child-submit">
                  {addingChild ? 'Adding...' : 'Add child'}
                </button>
              </form>
            )}
          </div>

          {credits.length > 0 && (
            <div className="session-detail__credits">
              <h3>Apply credits</h3>
              {credits.map(c => {
                const selected = selectedCreditIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`session-detail__credit-option${selected ? ' session-detail__credit-option--selected' : ''}`}
                    onClick={() => toggleCredit(c.id)}
                  >
                    <input type="checkbox" checked={selected} readOnly />
                    <span className="session-detail__option-check">
                      {selected && '✓'}
                    </span>
                    <span>£{(c.amount / 100).toFixed(2)} — expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
                  </label>
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

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import { AuthContext } from '../../contexts/AuthContext';
import './SessionDetail.css';

export default function SessionDetail() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [session, setSession] = useState(null);
  const [myGymnasts, setMyGymnasts] = useState([]);
  const [selectedGymnastIds, setSelectedGymnastIds] = useState([]);
  const [credits, setCredits] = useState([]);
  const [selectedCreditIds, setSelectedCreditIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    Promise.all([
      bookingApi.getSession(instanceId),
      bookingApi.getMyCredits(),
      fetch(`${API_URL}/gymnasts/my-children`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()),
    ]).then(([sessRes, credRes, gymData]) => {
      setSession(sessRes.data);
      setCredits(credRes.data);
      setMyGymnasts(Array.isArray(gymData) ? gymData : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [instanceId]);

  // Filter gymnasts by age restriction
  const eligibleGymnasts = session?.minAge
    ? myGymnasts.filter(g => {
        if (!g.dateOfBirth) return false;
        const age = Math.floor((new Date(session.date) - new Date(g.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= session.minAge;
      })
    : myGymnasts;

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
        {session.minAge && <p className="session-detail__age-restriction">16+ only</p>}
        <p>{session.availableSlots} of {session.capacity} slots available</p>
        {session.cancelledAt && (
          <p className="session-detail__cancelled">This session has been cancelled.</p>
        )}
      </div>

      {!session.cancelledAt && session.availableSlots > 0 && (
        <>
          <div className="session-detail__gymnasts">
            <h3>Select gymnasts</h3>
            {eligibleGymnasts.length === 0 && (
              <p>
                {session.minAge
                  ? `No gymnasts meet the ${session.minAge}+ age requirement for this session.`
                  : 'No gymnasts found. Add gymnasts to your account first.'}
              </p>
            )}
            {eligibleGymnasts.map(g => (
              <label key={g.id} className="session-detail__gymnast-option">
                <input
                  type="checkbox"
                  checked={selectedGymnastIds.includes(g.id)}
                  onChange={() => toggleGymnast(g.id)}
                />
                {g.firstName} {g.lastName}
              </label>
            ))}
          </div>

          {credits.length > 0 && (
            <div className="session-detail__credits">
              <h3>Apply credits</h3>
              {credits.map(c => (
                <label key={c.id} className="session-detail__credit-option">
                  <input
                    type="checkbox"
                    checked={selectedCreditIds.includes(c.id)}
                    onChange={() => toggleCredit(c.id)}
                  />
                  £{(c.amount / 100).toFixed(2)} — expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}
                </label>
              ))}
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

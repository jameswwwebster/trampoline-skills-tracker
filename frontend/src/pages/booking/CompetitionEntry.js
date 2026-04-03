import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

export default function CompetitionEntry() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [clientSecret, setClientSecret] = useState(null);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.getMyCompetitionEntries().then(res => {
      const found = res.data.find(e => e.id === entryId);
      if (found) {
        setEntry(found);
        setSelectedCategories(found.categories.map(ec => ec.categoryId));
        if (found.status === 'PAID') setClientSecret(null);
      }
    });
  }, [entryId]);

  if (!entry) return <div className="bk-page bk-page--sm"><p className="bk-muted">Loading...</p></div>;

  if (entry.status === 'PAID') {
    return (
      <div className="bk-page bk-page--sm">
        <div className="bk-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Entry confirmed</p>
          <p className="bk-muted">{entry.competitionEvent.name}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>£{(entry.totalAmount / 100).toFixed(2)}</p>
        </div>
      </div>
    );
  }

  const ev = entry.competitionEvent;
  const isLate = new Date() > new Date(ev.entryDeadline);
  const deadlinePassed = isLate && ev.lateEntryFee === null;

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
    setClientSecret(null);
  };

  const priceOverride = entry.adminPriceOverride ?? null;

  const calcDisplayTotal = () => {
    if (priceOverride !== null) return priceOverride;
    const tiers = [...ev.priceTiers].sort((a, b) => a.entryNumber - b.entryNumber);
    let t = 0;
    for (let i = 0; i < selectedCategories.length; i++) {
      const tierIdx = Math.min(i, tiers.length - 1);
      t += tiers[tierIdx].price;
    }
    if (isLate && ev.lateEntryFee) t += ev.lateEntryFee;
    return t;
  };

  const handleProceedToPayment = async () => {
    if (selectedCategories.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.checkoutCompetitionEntry(entryId, selectedCategories);
      setClientSecret(res.data.clientSecret);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout.');
    } finally {
      setLoading(false);
    }
  };

  if (clientSecret) {
    return (
      <div className="bk-page bk-page--sm">
        <h2>{ev.name}</h2>
        <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
          {entry.gymnast.firstName} {entry.gymnast.lastName}
        </p>
        <p style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          {selectedCategories.map(cid => ev.categories.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}
        </p>
        {priceOverride !== null ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>Club price applied</p>
        ) : isLate && ev.lateEntryFee ? (
          <p style={{ color: 'var(--booking-warning)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Late entry fee of £{(ev.lateEntryFee / 100).toFixed(2)} included
          </p>
        ) : null}
        <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
          Total: £{(total / 100).toFixed(2)}
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CompetitionPaymentForm entryId={entryId} onSuccess={() => navigate('/booking/competitions')} />
        </Elements>
        <button className="bk-btn bk-btn--ghost" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }} onClick={() => setClientSecret(null)}>
          Back to category selection
        </button>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--sm">
      <h2>{ev.name}</h2>
      <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
        {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '1rem' }}>
        Gymnast: <strong>{entry.gymnast.firstName} {entry.gymnast.lastName}</strong>
      </p>

      {deadlinePassed && (
        <div className="bk-card" style={{ background: '#fff3cd', borderColor: '#ffc107', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>The entry deadline has passed. Entries are closed for this competition.</p>
        </div>
      )}

      {!deadlinePassed && (
        <>
          {isLate && (
            <div className="bk-card" style={{ background: '#fff3cd', borderColor: '#ffc107', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
                The entry deadline has passed. A late entry fee of £{(ev.lateEntryFee / 100).toFixed(2)} will be added.
              </p>
            </div>
          )}

          <div className="bk-form-card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.75rem' }}>Select categories to enter</p>
            {ev.categories.map(cat => (
              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                {cat.name}
              </label>
            ))}
          </div>

          {selectedCategories.length > 0 && (
            <div className="bk-card" style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.35rem' }}>
                Entry total: £{(calcDisplayTotal() / 100).toFixed(2)}
                {priceOverride !== null && <span className="bk-muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}> (club price)</span>}
              </p>
              {priceOverride === null && (
                <p className="bk-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                  {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
                  {isLate && ev.lateEntryFee ? ` + £${(ev.lateEntryFee / 100).toFixed(2)} late fee` : ''}
                </p>
              )}
            </div>
          )}

          {error && <p className="bk-error">{error}</p>}

          <button
            className="bk-btn bk-btn--primary bk-btn--full"
            disabled={selectedCategories.length === 0 || loading}
            onClick={handleProceedToPayment}
          >
            {loading ? 'Loading...' : 'Proceed to payment'}
          </button>

          <button className="bk-btn bk-btn--ghost bk-btn--full" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/booking/competitions')}>
            Decline
          </button>
        </>
      )}
    </div>
  );
}

function CompetitionPaymentForm({ entryId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/competitions` },
      redirect: 'if_required',
    });
    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
      <button
        type="submit"
        className="bk-btn bk-btn--primary bk-btn--full"
        style={{ marginTop: '1rem' }}
        disabled={!stripe || loading}
      >
        {loading ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  );
}

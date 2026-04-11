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

  const loadEntry = () =>
    bookingApi.getMyCompetitionEntries().then(res => {
      const found = res.data.find(e => e.id === entryId);
      if (found) {
        setEntry(found);
        setSelectedCategories(found.categories.map(ec => ec.categoryId));
      }
    });

  useEffect(() => { loadEntry(); }, [entryId]);

  if (!entry) return <div className="bk-page bk-page--sm"><p className="bk-muted">Loading...</p></div>;

  const ev = entry.competitionEvent;

  // --- Terminal states ---
  if (entry.status === 'PAID') {
    return (
      <div className="bk-page bk-page--sm">
        <div className="bk-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>Entry confirmed</p>
          <p className="bk-muted" style={{ marginBottom: '0.25rem' }}>{ev.name}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          {entry.paidExternally
            ? <p className="bk-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Payment recorded by club</p>
            : entry.totalAmount > 0 && (
              <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>£{(entry.totalAmount / 100).toFixed(2)}</p>
            )
          }
        </div>
      </div>
    );
  }

  if (entry.status === 'WAIVED') {
    return (
      <div className="bk-page bk-page--sm">
        <div className="bk-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>Entry confirmed</p>
          <p className="bk-muted" style={{ marginBottom: '0.25rem' }}>{ev.name}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--booking-success)', fontWeight: 600, marginTop: '0.5rem' }}>
            No payment required
          </p>
          {entry.waivedReason && (
            <p className="bk-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>{entry.waivedReason}</p>
          )}
        </div>
      </div>
    );
  }

  if (entry.status === 'DECLINED') {
    return (
      <div className="bk-page bk-page--sm">
        <div className="bk-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--booking-text-muted)' }}>
            Invitation declined
          </p>
          <p className="bk-muted" style={{ fontSize: '0.875rem' }}>{ev.name}</p>
        </div>
      </div>
    );
  }

  // --- ACCEPTED: waiting for coach ---
  if (entry.status === 'ACCEPTED') {
    return (
      <div className="bk-page bk-page--sm">
        <h2>{ev.name}</h2>
        <p className="bk-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
          {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="bk-card" style={{ borderLeft: '4px solid var(--booking-accent)', padding: '1.25rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
            {entry.gymnast.firstName} {entry.gymnast.lastName}
          </p>
          <p className="bk-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Your entry has been submitted. A coach will review it and send you an invoice before payment is due.
          </p>
        </div>
        <button
          className="bk-btn bk-btn--ghost"
          style={{ marginTop: '1rem', fontSize: '0.85rem' }}
          onClick={() => navigate('/booking/competitions')}
        >
          ← Back to competitions
        </button>
      </div>
    );
  }

  // --- PAYMENT_PENDING: invoice sent, show Stripe checkout ---
  if (entry.status === 'PAYMENT_PENDING') {
    const isLate = new Date() > new Date(ev.entryDeadline);

    if (clientSecret) {
      return (
        <div className="bk-page bk-page--sm">
          <h2>{ev.name}</h2>
          <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
            {entry.gymnast.firstName} {entry.gymnast.lastName}
          </p>
          <p style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          {entry.adminPriceOverride !== null ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>Club price applied</p>
          ) : isLate && ev.lateEntryFee ? (
            <p style={{ color: 'var(--booking-warning)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Late entry fee included
            </p>
          ) : null}
          <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            Total: £{(total / 100).toFixed(2)}
          </p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CompetitionPaymentForm entryId={entryId} onSuccess={() => navigate('/booking/competitions')} />
          </Elements>
          <button className="bk-btn bk-btn--ghost" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }} onClick={() => setClientSecret(null)}>
            Back
          </button>
        </div>
      );
    }

    const handleProceedToPayment = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await bookingApi.checkoutCompetitionEntry(entryId);
        setClientSecret(res.data.clientSecret);
        setTotal(res.data.total);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to start checkout.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="bk-page bk-page--sm">
        <h2>{ev.name}</h2>
        <p className="bk-muted" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="bk-card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--booking-warning)' }}>
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>
            {entry.gymnast.firstName} {entry.gymnast.lastName}
          </p>
          <p className="bk-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Amount due: £{(entry.totalAmount / 100).toFixed(2)}
          </p>
        </div>
        {error && <p className="bk-error">{error}</p>}
        <button
          className="bk-btn bk-btn--primary bk-btn--full"
          disabled={loading}
          onClick={handleProceedToPayment}
        >
          {loading ? 'Loading...' : 'Pay now'}
        </button>
        <button
          className="bk-btn bk-btn--ghost bk-btn--full"
          style={{ marginTop: '0.5rem' }}
          onClick={() => navigate('/booking/competitions')}
        >
          Pay later
        </button>
      </div>
    );
  }

  // --- INVITED: category selection + accept/decline ---
  const isLate = new Date() > new Date(ev.entryDeadline);
  const deadlinePassed = isLate && ev.lateEntryFee === null;

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const calcDisplayTotal = () => {
    const priceOverride = entry.adminPriceOverride ?? null;
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

  const handleAccept = async () => {
    if (selectedCategories.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await bookingApi.acceptCompetitionEntry(entryId, selectedCategories);
      await loadEntry();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept.');
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    setError(null);
    try {
      await bookingApi.declineCompetitionEntry(entryId);
      navigate('/booking/competitions');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to decline.');
      setLoading(false);
    }
  };

  return (
    <div className="bk-page bk-page--sm">
      <h2>{ev.name}</h2>
      <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
        {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '1rem' }}>
        Gymnast: <strong>{entry.gymnast.firstName} {entry.gymnast.lastName}</strong>
      </p>

      {deadlinePassed ? (
        <div className="bk-card" style={{ background: '#fff3cd', borderColor: '#ffc107' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
            The entry deadline has passed. Entries are closed for this competition.
          </p>
        </div>
      ) : (
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
                Estimated total: £{(calcDisplayTotal() / 100).toFixed(2)}
                {entry.adminPriceOverride !== null && (
                  <span className="bk-muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}> (club price)</span>
                )}
              </p>
              {entry.adminPriceOverride === null && (
                <p className="bk-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                  {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
                  {isLate && ev.lateEntryFee ? ` + £${(ev.lateEntryFee / 100).toFixed(2)} late fee` : ''}
                </p>
              )}
              <p className="bk-muted" style={{ fontSize: '0.78rem', margin: '0.4rem 0 0' }}>
                A coach will confirm this before payment is requested.
              </p>
            </div>
          )}

          {error && <p className="bk-error">{error}</p>}

          <button
            className="bk-btn bk-btn--primary bk-btn--full"
            disabled={selectedCategories.length === 0 || loading}
            onClick={handleAccept}
          >
            {loading ? 'Submitting...' : 'Accept invitation'}
          </button>

          <button
            className="bk-btn bk-btn--ghost bk-btn--full"
            style={{ marginTop: '0.5rem' }}
            disabled={loading}
            onClick={handleDecline}
          >
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

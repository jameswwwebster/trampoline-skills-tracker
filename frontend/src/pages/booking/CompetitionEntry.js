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
  const [clientSecret, setClientSecret] = useState(null);
  const [total, setTotal] = useState(null);
  const [creditApplied, setCreditApplied] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEntry = () =>
    bookingApi.getMyCompetitionEntries().then(res => {
      const found = res.data.find(e => e.id === entryId);
      if (found) setEntry(found);
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
          {creditApplied > 0 && (
            <p style={{ fontSize: '0.875rem', color: 'var(--booking-success)', marginBottom: '0.25rem' }}>
              Credit applied: −£{(creditApplied / 100).toFixed(2)}
            </p>
          )}
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
        if (res.data.paid) {
          // Credits covered the full amount — reload entry to show PAID state
          await loadEntry();
          return;
        }
        setClientSecret(res.data.clientSecret);
        setTotal(res.data.total);
        setCreditApplied(res.data.creditApplied || 0);
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

  // --- INVITED: read-only summary + accept and pay ---
  const isLate = new Date() > new Date(ev.entryDeadline);
  const deadlinePassed = isLate && ev.lateEntryFee === null;

  const handleAcceptAndPay = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: accept — moves to PAYMENT_PENDING and sets totalAmount
      await bookingApi.acceptCompetitionEntry(entryId);
      // Step 2: checkout — creates Stripe PaymentIntent
      const checkoutRes = await bookingApi.checkoutCompetitionEntry(entryId);
      if (checkoutRes.data.paid) {
        // Credits covered the full amount
        await loadEntry();
        return;
      }
      setClientSecret(checkoutRes.data.clientSecret);
      setTotal(checkoutRes.data.total);
      setCreditApplied(checkoutRes.data.creditApplied || 0);
      // Reload entry to update state to PAYMENT_PENDING
      await loadEntry();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to proceed to payment.');
    } finally {
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

  const displayTotal = entry.totalAmount;

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
                The entry deadline has passed. A late entry fee will be included.
              </p>
            </div>
          )}

          <div className="bk-form-card" style={{ marginBottom: '1rem' }}>
            {entry.categories.length > 0 ? (
              <>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Categories</p>
                {entry.categories.map(ec => (
                  <p key={ec.categoryId} style={{ margin: '0 0 0.25rem', fontSize: '0.875rem' }}>
                    {ec.category.name}
                  </p>
                ))}
              </>
            ) : (
              <p className="bk-muted" style={{ fontSize: '0.875rem', margin: 0 }}>
                No categories assigned yet — please contact the club.
              </p>
            )}
            {displayTotal !== null && displayTotal !== undefined && (
              <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0.75rem 0 0' }}>
                Total: £{(displayTotal / 100).toFixed(2)}
              </p>
            )}
          </div>

          <div className="bk-card" style={{ marginBottom: '1rem', background: 'rgba(231,76,60,0.06)', borderColor: 'rgba(231,76,60,0.25)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
              Entries will not be submitted to the competition organiser until payment is complete.
            </p>
          </div>

          {error && <p className="bk-error">{error}</p>}

          <button
            className="bk-btn bk-btn--primary bk-btn--full"
            disabled={loading || entry.categories.length === 0}
            onClick={handleAcceptAndPay}
          >
            {loading ? 'Processing...' : `Accept and pay${displayTotal ? ` — £${(displayTotal / 100).toFixed(2)}` : ''}`}
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

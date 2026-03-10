import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function CartCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems = location.state?.cart || [];
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [creditsAvailable, setCreditsAvailable] = useState(0);

  useEffect(() => {
    bookingApi.getMyCredits()
      .then(r => setCreditsAvailable(r.data.reduce((sum, c) => sum + c.amount, 0)))
      .catch(() => {});
  }, []);

  const totalSlots = cartItems.reduce((sum, item) => sum + item.gymnasts.length, 0);
  const totalAmount = totalSlots * 600;
  const creditAmount = Math.min(creditsAvailable, totalAmount);
  const chargeAmount = Math.max(0, totalAmount - creditAmount);

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await bookingApi.createBatchBooking({
        items: cartItems.map(item => ({
          sessionInstanceId: item.sessionInstanceId,
          gymnastIds: item.gymnasts.map(g => g.id),
        })),
      });
      if (res.data.clientSecret) {
        navigate(`/booking/checkout/${res.data.bookings[0].id}`, {
          state: { clientSecret: res.data.clientSecret },
        });
      } else {
        // Free booking — safe to clear cart immediately since booking is complete
        sessionStorage.removeItem('booking-cart');
        window.dispatchEvent(new CustomEvent('booking-cart-update'));
        navigate(`/booking/confirmation/${res.data.bookings[0].id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
      setProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <p style={{ color: 'var(--booking-text-muted)' }}>Your cart is empty.</p>
        <Link to="/booking" className="bk-link">Back to calendar</Link>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--sm">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="bk-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 style={{ margin: 0 }}>Confirm Booking</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {cartItems.map(item => (
          <div key={item.sessionInstanceId} className="bk-card" style={{ padding: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {new Date(item.date).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}{' '}
              {item.startTime}–{item.endTime}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
              {item.gymnasts.map(g => `${g.firstName} ${g.lastName}`).join(', ')}
              {' · '}£{((item.gymnasts.length * 600) / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        {creditAmount > 0 && (
          <p style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.25rem' }}>
            £{(creditAmount / 100).toFixed(2)} credit will be applied automatically.
          </p>
        )}
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
          Total: £{(chargeAmount / 100).toFixed(2)}
        </div>
      </div>

      {error && <p style={{ color: 'var(--booking-danger)', marginBottom: '1rem' }}>{error}</p>}

      <button
        className="bk-btn bk-btn--primary bk-btn--full"
        disabled={processing}
        onClick={handleConfirm}
      >
        {processing ? 'Processing...' : chargeAmount > 0 ? `Confirm — £${(chargeAmount / 100).toFixed(2)}` : 'Confirm (Free)'}
      </button>
    </div>
  );
}

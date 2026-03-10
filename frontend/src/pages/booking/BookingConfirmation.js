import React, { useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import './booking-shared.css';

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const redirectStatus = searchParams.get('redirect_status');

  useEffect(() => {
    // Clear cart once payment succeeds (Stripe redirect back to this page)
    if (redirectStatus === 'succeeded') {
      sessionStorage.removeItem('booking-cart');
      window.dispatchEvent(new CustomEvent('booking-cart-update'));
    }
  }, [redirectStatus]);

  // Payment failed or was cancelled
  if (redirectStatus && redirectStatus !== 'succeeded' && redirectStatus !== 'processing') {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <div className="bk-confirm-icon" style={{ background: 'rgba(231,76,60,0.12)', color: 'var(--booking-danger)' }}>&#10007;</div>
        <h2>Payment failed</h2>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Your payment couldn't be processed. Your spot has not been reserved.
        </p>
        <Link to="/booking" className="bk-link">Back to calendar</Link>
      </div>
    );
  }

  // Payment is still processing (e.g. bank redirect)
  if (redirectStatus === 'processing') {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <div className="bk-confirm-icon" style={{ background: 'rgba(124,53,232,0.1)', color: 'var(--booking-accent)' }}>&#8987;</div>
        <h2>Payment processing</h2>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Your payment is being processed. Your booking will be confirmed shortly — check My Bookings in a few minutes.
        </p>
        <Link to="/booking/my-bookings" className="bk-link">View my bookings</Link>
      </div>
    );
  }

  // Succeeded or free booking (no redirect params)
  return (
    <div className="bk-page bk-page--sm bk-center">
      <div className="bk-confirm-icon">&#10003;</div>
      <h2>Booking confirmed!</h2>
      <p>Your booking has been confirmed. See you on the trampoline!</p>
      <Link to="/booking/my-bookings" className="bk-link">View my bookings</Link>
      {' · '}
      <Link to="/booking" className="bk-link">Back to calendar</Link>
    </div>
  );
}

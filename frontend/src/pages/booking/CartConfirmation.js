import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './booking-shared.css';

export default function CartConfirmation() {
  const [searchParams] = useSearchParams();
  const redirectStatus = searchParams.get('redirect_status');
  const bookingId = searchParams.get('bookingId');
  const shopOrderId = searchParams.get('shopOrderId');

  useEffect(() => {
    if (!redirectStatus || redirectStatus === 'succeeded') {
      sessionStorage.removeItem('booking-cart');
      localStorage.removeItem('shopCart');
      window.dispatchEvent(new CustomEvent('booking-cart-update'));
      window.dispatchEvent(new CustomEvent('shop-cart-update'));
    }
  }, [redirectStatus]);

  if (redirectStatus && redirectStatus !== 'succeeded' && redirectStatus !== 'processing') {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <div className="bk-confirm-icon" style={{ background: 'rgba(231,76,60,0.12)', color: 'var(--booking-danger)' }}>&#10007;</div>
        <h2>Payment failed</h2>
        <p style={{ color: 'var(--booking-text-muted)' }}>Your payment couldn't be processed. Nothing has been charged.</p>
        <Link to="/booking/cart" className="bk-link">Back to cart</Link>
      </div>
    );
  }

  if (redirectStatus === 'processing') {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <div className="bk-confirm-icon" style={{ background: 'rgba(124,53,232,0.1)', color: 'var(--booking-accent)' }}>&#8987;</div>
        <h2>Payment processing</h2>
        <p style={{ color: 'var(--booking-text-muted)' }}>Your payment is being processed. Check My Bookings and My Orders shortly.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {bookingId && <Link to="/booking/my-bookings" className="bk-link">My Bookings</Link>}
          {shopOrderId && <Link to="/booking/my-orders" className="bk-link">My Orders</Link>}
        </div>
      </div>
    );
  }

  const hasBooking = !!bookingId;
  const hasShop = !!shopOrderId;

  return (
    <div className="bk-page bk-page--sm bk-center">
      <div className="bk-confirm-icon">&#10003;</div>
      <h2>
        {hasBooking && hasShop ? 'All confirmed!' : hasBooking ? 'Booking confirmed!' : 'Order placed!'}
      </h2>
      <p>
        {hasBooking && hasShop
          ? 'Your session is booked and your kit order has been placed. See you on the trampoline!'
          : hasBooking
          ? 'Your session has been confirmed. See you on the trampoline!'
          : "Your kit order has been placed. We'll let you know when it arrives at the club."}
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {hasBooking && <Link to="/booking/my-bookings" className="bk-link">My Bookings</Link>}
        {hasShop && <Link to="/booking/my-orders" className="bk-link">My Orders</Link>}
        <Link to="/booking" className="bk-link">Back to calendar</Link>
      </div>
    </div>
  );
}

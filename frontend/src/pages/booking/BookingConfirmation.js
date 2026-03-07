import React from 'react';
import { useParams, Link } from 'react-router-dom';
import './booking-shared.css';

export default function BookingConfirmation() {
  const { bookingId } = useParams();
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

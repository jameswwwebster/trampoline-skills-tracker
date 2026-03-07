import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>&#10003;</div>
      <h2>Booking confirmed!</h2>
      <p>Your booking has been confirmed. See you on the trampoline!</p>
      <Link to="/booking/my-bookings" style={{ color: '#3498db' }}>View my bookings</Link>
      {' · '}
      <Link to="/booking" style={{ color: '#3498db' }}>Back to calendar</Link>
    </div>
  );
}

import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ bookingId }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/confirmation/${bookingId}`,
      },
    });
    if (error) {
      setError(error.message);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', padding: '1rem' }}>
      <h2>Complete Payment</h2>
      <PaymentElement />
      {error && <p style={{ color: '#e74c3c', marginTop: '0.75rem' }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          marginTop: '1rem', width: '100%', padding: '0.75rem',
          background: '#38a169', color: 'white', border: 'none',
          borderRadius: '6px', fontSize: '1rem', cursor: 'pointer',
        }}
      >
        {processing ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  );
}

export default function Checkout() {
  const { bookingId } = useParams();
  const location = useLocation();
  const clientSecret = location.state?.clientSecret;

  if (!clientSecret) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>Invalid checkout session.</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm bookingId={bookingId} />
    </Elements>
  );
}

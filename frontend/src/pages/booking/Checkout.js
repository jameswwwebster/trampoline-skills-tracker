import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './booking-shared.css';

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
    <form onSubmit={handleSubmit} className="bk-page bk-page--sm">
      <h2>Complete Payment</h2>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
      <button type="submit" disabled={!stripe || processing} className="bk-btn bk-btn--primary bk-btn--full">
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
    return <p className="bk-center">Invalid checkout session.</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm bookingId={bookingId} />
    </Elements>
  );
}

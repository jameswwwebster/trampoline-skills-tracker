import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { bookingApi } from '../../utils/bookingApi';
import { getProduct } from './shop/shopProducts';
import './booking-shared.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const BOOKING_CART_KEY = 'booking-cart';
const SHOP_CART_KEY = 'shopCart';

function getBookingCartEntries() {
  try {
    const saved = sessionStorage.getItem(BOOKING_CART_KEY);
    return saved ? JSON.parse(saved) : []; // array of [instanceId, gymnasts[]]
  } catch { return []; }
}

function getShopCart() {
  try { return JSON.parse(localStorage.getItem(SHOP_CART_KEY)) || []; } catch { return []; }
}

function clearAllCarts() {
  sessionStorage.removeItem(BOOKING_CART_KEY);
  localStorage.removeItem(SHOP_CART_KEY);
  window.dispatchEvent(new CustomEvent('booking-cart-update'));
  window.dispatchEvent(new CustomEvent('shop-cart-update'));
}

function PaymentForm({ bookingId, shopOrderId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (bookingId) params.set('bookingId', bookingId);
    if (shopOrderId) params.set('shopOrderId', shopOrderId);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/cart-confirmation?${params}`,
      },
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p style={{ color: 'var(--booking-danger)', marginTop: '0.5rem', fontSize: '0.875rem' }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="bk-btn bk-btn--primary bk-btn--full"
        style={{ marginTop: '1rem' }}
      >
        {loading ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const [bookingEntries, setBookingEntries] = useState(() => getBookingCartEntries());
  const [shopCart, setShopCart] = useState(() => getShopCart());
  const [sessionDetails, setSessionDetails] = useState({});
  const [credits, setCredits] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [checkoutBookingId, setCheckoutBookingId] = useState(null);
  const [checkoutShopOrderId, setCheckoutShopOrderId] = useState(null);

  // Fetch session details for display
  useEffect(() => {
    bookingEntries.forEach(([instanceId]) => {
      bookingApi.getSession(instanceId)
        .then(r => setSessionDetails(prev => ({ ...prev, [instanceId]: r.data })))
        .catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available credits
  useEffect(() => {
    bookingApi.getMyCredits()
      .then(r => setCredits(r.data.reduce((sum, c) => sum + c.amount, 0)))
      .catch(() => {});
  }, []);

  const isEmpty = bookingEntries.length === 0 && shopCart.length === 0;
  const sessionTotal = bookingEntries.reduce((sum, [instanceId, g]) => sum + g.length * (sessionDetails[instanceId]?.pricePerGymnast ?? 600), 0);
  const shopTotal = shopCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const creditAmount = Math.min(credits, sessionTotal);
  const chargeAmount = Math.max(0, sessionTotal - creditAmount) + shopTotal;

  function removeSession(instanceId) {
    const next = bookingEntries.filter(([id]) => id !== instanceId);
    setBookingEntries(next);
    sessionStorage.setItem(BOOKING_CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('booking-cart-update'));
  }

  function removeShopItem(index) {
    const next = shopCart.filter((_, i) => i !== index);
    setShopCart(next);
    localStorage.setItem(SHOP_CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('shop-cart-update'));
  }

  async function handleCheckout() {
    setProcessing(true);
    setError(null);
    try {
      const sessions = bookingEntries.map(([sessionInstanceId, gymnasts]) => ({
        sessionInstanceId,
        gymnastIds: gymnasts.map(g => g.id),
      }));
      const shopItems = shopCart.map(item => ({
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        customisation: item.customisation,
      }));

      const res = await bookingApi.combinedCheckout({ sessions, shopItems });

      if (res.data.clientSecret) {
        setCheckoutBookingId(res.data.bookingId);
        setCheckoutShopOrderId(res.data.shopOrderId);
        setClientSecret(res.data.clientSecret);
      } else {
        // Free checkout — clear carts and navigate to confirmation
        clearAllCarts();
        const params = new URLSearchParams();
        if (res.data.bookingId) params.set('bookingId', res.data.bookingId);
        if (res.data.shopOrderId) params.set('shopOrderId', res.data.shopOrderId);
        navigate(`/booking/cart-confirmation?${params}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed. Please try again.');
      setProcessing(false);
    }
  }

  // Show Stripe payment form after checkout initiated
  if (clientSecret) {
    return (
      <div className="bk-page bk-page--sm">
        <h2>Complete Payment</h2>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '1.25rem' }}>
          Total: <strong>£{(chargeAmount / 100).toFixed(2)}</strong>
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm bookingId={checkoutBookingId} shopOrderId={checkoutShopOrderId} />
        </Elements>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <p style={{ color: 'var(--booking-text-muted)' }}>Your cart is empty.</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="bk-btn bk-btn--primary" onClick={() => navigate('/booking')}>Book a session</button>
          <button className="bk-btn" onClick={() => navigate('/booking/shop')}>Browse kit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--sm">
      <h2 style={{ marginBottom: '1.5rem' }}>Your Cart</h2>

      {/* Booking sessions */}
      {bookingEntries.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
            Sessions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {bookingEntries.map(([instanceId, gymnasts]) => {
              const s = sessionDetails[instanceId];
              return (
                <div key={instanceId} className="bk-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {s
                        ? `${new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.startTime}–${s.endTime}`
                        : instanceId}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)', marginTop: '0.15rem' }}>
                      {gymnasts.map(g => g.firstName).join(', ')} · £{((gymnasts.length * (sessionDetails[instanceId]?.pricePerGymnast ?? 600)) / 100).toFixed(2)}
                    </div>
                  </div>
                  <button
                    className="bk-btn"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => removeSession(instanceId)}
                    aria-label="Remove session"
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shop items */}
      {shopCart.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
            Kit
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {shopCart.map((item, i) => {
              const product = getProduct(item.productId);
              return (
                <div key={i} className="bk-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src={item.image || product?.images[0]}
                    alt={item.productName}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.productName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
                      {item.size}{item.customisation ? ` · ${item.customisation}` : ''} · Qty {item.quantity} · £{((item.price * item.quantity) / 100).toFixed(2)}
                    </div>
                  </div>
                  <button
                    className="bk-btn"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
                    onClick={() => removeShopItem(i)}
                    aria-label="Remove item"
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bk-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
        {sessionTotal > 0 && shopTotal > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.25rem' }}>
              <span>Sessions</span><span>£{(sessionTotal / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.25rem' }}>
              <span>Kit</span><span>£{(shopTotal / 100).toFixed(2)}</span>
            </div>
          </>
        )}
        {creditAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.25rem' }}>
            <span>Credit applied</span><span>−£{(creditAmount / 100).toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', paddingTop: creditAmount > 0 || (sessionTotal > 0 && shopTotal > 0) ? '0.5rem' : 0, borderTop: creditAmount > 0 || (sessionTotal > 0 && shopTotal > 0) ? '1px solid #eee' : 'none' }}>
          <span>Total</span><span>£{(chargeAmount / 100).toFixed(2)}</span>
        </div>
      </div>

      {error && <p style={{ color: 'var(--booking-danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

      <button
        className="bk-btn bk-btn--primary bk-btn--full"
        disabled={processing}
        onClick={handleCheckout}
      >
        {processing ? 'Processing…' : chargeAmount > 0 ? `Confirm — £${(chargeAmount / 100).toFixed(2)}` : 'Confirm (Free)'}
      </button>
    </div>
  );
}

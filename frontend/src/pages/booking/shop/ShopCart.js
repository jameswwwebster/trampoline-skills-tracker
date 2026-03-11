import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { shopApi } from '../../../utils/shopApi';
import { getProduct } from './shopProducts';
import './shop.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const CART_KEY = 'shopCart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function clearCart() {
  localStorage.removeItem(CART_KEY);
}

function PaymentForm({ orderId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/shop/confirmation/${orderId}`,
      },
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
    }
    // On success, Stripe redirects to return_url automatically
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="shop-error">{error}</p>}
      <button type="submit" className="shop-pay-btn" disabled={!stripe || loading}>
        {loading ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}

export default function ShopCart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(getCart());
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function removeItem(index) {
    const newCart = cart.filter((_, i) => i !== index);
    saveCart(newCart);
    setCart(newCart);
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const items = cart.map(item => ({
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        customisation: item.customisation,
      }));
      const res = await shopApi.createOrder(items);
      setClientSecret(res.data.clientSecret);
      setOrderId(res.data.orderId);
      clearCart();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout');
      setLoading(false);
    }
  }

  if (clientSecret && orderId) {
    return (
      <div className="shop-cart">
        <h1 className="shop-cart-title">Payment</h1>
        <div className="shop-payment-section">
          <p className="shop-payment-title">Total: £{(total / 100).toFixed(2)}</p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm orderId={orderId} />
          </Elements>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-cart">
      <h1 className="shop-cart-title">Your Cart</h1>

      {cart.length === 0 ? (
        <div className="shop-cart-empty">
          <p>Your cart is empty.</p>
          <button
            onClick={() => navigate('/booking/shop')}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: 'var(--secondary-color)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}
          >
            Browse kit
          </button>
        </div>
      ) : (
        <>
          {cart.map((item, i) => {
            const product = getProduct(item.productId);
            return (
              <div key={i} className="shop-cart-item">
                <img src={item.image || product?.images[0]} alt={item.productName} className="shop-cart-item-img" />
                <div className="shop-cart-item-info">
                  <p className="shop-cart-item-name">{item.productName}</p>
                  <p className="shop-cart-item-meta">
                    Size: {item.size}
                    {item.customisation ? ` · Initials: ${item.customisation}` : ''}
                    {' · '}Qty: {item.quantity}
                  </p>
                  <p className="shop-cart-item-price">£{((item.price * item.quantity) / 100).toFixed(2)}</p>
                  <button className="shop-cart-item-remove" onClick={() => removeItem(i)}>Remove</button>
                </div>
              </div>
            );
          })}

          <div className="shop-cart-total">
            <span>Total</span>
            <span>£{(total / 100).toFixed(2)}</span>
          </div>

          {error && <p className="shop-error">{error}</p>}

          <button className="shop-checkout-btn" onClick={handleCheckout} disabled={loading}>
            {loading ? 'Preparing checkout…' : 'Proceed to payment'}
          </button>
        </>
      )}
    </div>
  );
}

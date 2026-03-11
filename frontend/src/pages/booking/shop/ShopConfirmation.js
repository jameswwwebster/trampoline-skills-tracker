import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { shopApi } from '../../../utils/shopApi';
import './shop.css';

export default function ShopConfirmation() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shopApi.getOrder(orderId)
      .then(res => setOrder(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  const paymentStatus = searchParams.get('redirect_status');

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Loading…</div>;

  if (paymentStatus === 'failed') {
    return (
      <div className="shop-confirmation">
        <div className="shop-confirmation-icon">✗</div>
        <h2>Payment failed</h2>
        <p>Your payment was not processed. Please try again.</p>
        <Link to="/booking/shop/cart" style={{ display: 'inline-block', marginTop: '1rem', color: 'var(--secondary-color)' }}>
          Back to cart
        </Link>
      </div>
    );
  }

  return (
    <div className="shop-confirmation">
      <div className="shop-confirmation-icon">✓</div>
      <h2>Order placed!</h2>
      <p>Thanks for your order. We'll email you when your kit arrives at the club.</p>
      {order && (
        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
          Order ref: {order.id}
        </p>
      )}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/booking/my-orders" style={{ color: 'var(--secondary-color)' }}>View my orders</Link>
        <Link to="/booking/shop" style={{ color: 'var(--secondary-color)' }}>Continue shopping</Link>
      </div>
    </div>
  );
}

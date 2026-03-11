import React, { useEffect, useState, useCallback } from 'react';
import { shopApi } from '../../../utils/shopApi';
import '../shop/shop.css';

const STATUS_LABELS = {
  ORDERED: 'Order placed',
  ARRIVED: 'Arrived at club',
  FULFILLED: 'Collected',
};

const NEXT_STATUS = {
  ORDERED: 'ARRIVED',
  ARRIVED: 'FULFILLED',
};

const NEXT_LABEL = {
  ORDERED: 'Mark arrived',
  ARRIVED: 'Mark collected',
};

export default function AdminShopOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ORDERED');
  const [advancing, setAdvancing] = useState(null);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    shopApi.getAdminOrders(activeTab)
      .then(res => setOrders(res.data))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleAdvance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing(order.id);
    try {
      await shopApi.updateOrderStatus(order.id, next);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update order');
    } finally {
      setAdvancing(null);
    }
  }

  const tabs = ['ALL', 'ORDERED', 'ARRIVED', 'FULFILLED'];

  return (
    <div className="shop-orders">
      <h1 className="shop-orders-title">Shop Orders</h1>

      <div className="shop-orders-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`shop-orders-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'ALL' ? 'All' : STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#c00', fontSize: '0.85rem' }}>{error}</p>}
      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {!loading && orders.length === 0 && <p style={{ color: '#888' }}>No orders.</p>}

      {orders.map(order => (
        <div key={order.id} className="shop-order-card">
          <div className="shop-order-card-header">
            <div>
              <p className="shop-order-member">
                {order.user ? `${order.user.firstName} ${order.user.lastName}` : '—'}
                {' '}
                <span style={{ fontWeight: 400, color: '#888' }}>({order.user?.email})</span>
              </p>
              <span className={`shop-order-status ${order.status}`}>{STATUS_LABELS[order.status]}</span>
            </div>
            <span className="shop-order-meta">{new Date(order.createdAt).toLocaleDateString('en-GB')}</span>
          </div>

          <div className="shop-order-items">
            {order.items.map((item, i) => (
              <div key={i}>
                {item.productName} — {item.size}
                {item.customisation ? ` (${item.customisation})` : ''}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </div>
            ))}
          </div>

          <p className="shop-order-total">Total: £{(order.total / 100).toFixed(2)}</p>
          <p className="shop-order-meta" style={{ marginTop: '0.25rem' }}>Ref: {order.id}</p>

          {NEXT_STATUS[order.status] && (
            <button
              className="shop-order-advance-btn"
              disabled={advancing === order.id}
              onClick={() => handleAdvance(order)}
            >
              {advancing === order.id ? 'Updating…' : NEXT_LABEL[order.status]}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

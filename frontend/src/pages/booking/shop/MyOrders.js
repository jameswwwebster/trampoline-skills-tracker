import React, { useEffect, useState } from 'react';
import { shopApi } from '../../../utils/shopApi';
import './shop.css';

const STATUS_LABELS = {
  ORDERED: 'Order placed',
  ARRIVED: 'Arrived at club',
  FULFILLED: 'Collected',
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    shopApi.getMyOrders()
      .then(res => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs = ['ALL', 'ORDERED', 'ARRIVED', 'FULFILLED'];
  const filtered = activeTab === 'ALL' ? orders : orders.filter(o => o.status === activeTab);

  return (
    <div className="shop-orders">
      <h1 className="shop-orders-title">My Orders</h1>

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

      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {!loading && filtered.length === 0 && <p style={{ color: '#888' }}>No orders found.</p>}

      {filtered.map(order => (
        <div key={order.id} className="shop-order-card">
          <div className="shop-order-card-header">
            <span className={`shop-order-status ${order.status}`}>{STATUS_LABELS[order.status]}</span>
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
        </div>
      ))}
    </div>
  );
}

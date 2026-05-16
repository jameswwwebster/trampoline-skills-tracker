import React, { useEffect, useState, useCallback } from 'react';
import { shopApi } from '../../../utils/shopApi';
import '../shop/shop.css';

const ORDER_STATUS_LABELS = {
  ORDERED: 'In progress',
  ARRIVED: 'Arrived at club',
  FULFILLED: 'Collected',
};

const ITEM_STATUS_LABELS = {
  AWAITING: 'Awaiting',
  ORDERED_FROM_SUPPLIER: 'Ordered from supplier',
  ARRIVED: 'Arrived at club',
  FULFILLED: 'Collected',
};

const ITEM_NEXT = {
  AWAITING: 'ORDERED_FROM_SUPPLIER',
  ORDERED_FROM_SUPPLIER: 'ARRIVED',
  ARRIVED: 'FULFILLED',
};

const ITEM_NEXT_LABEL = {
  AWAITING: 'Mark ordered from supplier',
  ORDERED_FROM_SUPPLIER: 'Mark arrived',
  ARRIVED: 'Mark collected',
};

const ITEM_STATUSES = ['AWAITING', 'ORDERED_FROM_SUPPLIER', 'ARRIVED', 'FULFILLED'];

function ItemRow({ orderId, item, busy, onChange, onReplaceOrder }) {
  const [supplier, setSupplier] = useState(item.supplier ?? '');
  const [supplierDirty, setSupplierDirty] = useState(false);
  const [statusEditing, setStatusEditing] = useState(false);

  useEffect(() => {
    setSupplier(item.supplier ?? '');
    setSupplierDirty(false);
  }, [item.supplier]);

  const next = ITEM_NEXT[item.status];

  const submitStatus = async (newStatus) => {
    setStatusEditing(false);
    if (newStatus === item.status) return;
    onChange(item.id, { status: newStatus });
  };
  const saveSupplier = () => {
    if (!supplierDirty) return;
    onChange(item.id, { supplier: supplier.trim() });
  };

  return (
    <tr style={{ borderTop: '1px solid var(--booking-border)' }}>
      <td style={{ padding: '0.45rem 0.5rem' }}>
        <div style={{ fontSize: '0.92rem' }}>{item.productName} — {item.size}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>
          {item.customisation ? `${item.customisation} · ` : ''}qty {item.quantity}
        </div>
      </td>
      <td style={{ padding: '0.45rem 0.5rem' }}>
        <input
          className="bk-input bk-input--sm"
          style={{ width: 130, fontSize: '0.85rem' }}
          placeholder="e.g. Champion"
          value={supplier}
          onChange={e => { setSupplier(e.target.value); setSupplierDirty(true); }}
          onBlur={saveSupplier}
          onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
          disabled={busy}
        />
      </td>
      <td style={{ padding: '0.45rem 0.5rem' }}>
        {statusEditing ? (
          <select
            className="bk-input bk-input--sm"
            style={{ fontSize: '0.85rem' }}
            value={item.status}
            autoFocus
            onChange={e => submitStatus(e.target.value)}
            onBlur={() => setStatusEditing(false)}
          >
            {ITEM_STATUSES.map(s => <option key={s} value={s}>{ITEM_STATUS_LABELS[s]}</option>)}
          </select>
        ) : (
          <button
            type="button"
            className={`shop-order-status ${item.status}`}
            style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
            onClick={() => setStatusEditing(true)}
            title="Click to correct"
          >
            {ITEM_STATUS_LABELS[item.status]}
          </button>
        )}
      </td>
      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>
        {next && (
          <button
            className="bk-btn bk-btn--sm bk-btn--primary"
            disabled={busy}
            onClick={() => onChange(item.id, { status: next })}
          >
            {busy ? '…' : ITEM_NEXT_LABEL[item.status]}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AdminShopOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ORDERED');
  const [busyItem, setBusyItem] = useState(null);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    shopApi.getAdminOrders(activeTab)
      .then(res => setOrders(res.data))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleItemChange = async (orderId, itemId, payload) => {
    setBusyItem(itemId);
    setError(null);
    try {
      const res = await shopApi.updateOrderItem(orderId, itemId, payload);
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update item');
    } finally {
      setBusyItem(null);
    }
  };

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
            {tab === 'ALL' ? 'All' : ORDER_STATUS_LABELS[tab]}
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
              <span className={`shop-order-status ${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
            </div>
            <span className="shop-order-meta">{new Date(order.createdAt).toLocaleDateString('en-GB')}</span>
          </div>

          <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--booking-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>Item</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>Supplier</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => (
                <ItemRow
                  key={item.id}
                  orderId={order.id}
                  item={item}
                  busy={busyItem === item.id}
                  onChange={(itemId, payload) => handleItemChange(order.id, itemId, payload)}
                />
              ))}
            </tbody>
          </table>

          <p className="shop-order-total" style={{ marginTop: '0.5rem' }}>Total: £{(order.total / 100).toFixed(2)}</p>
          <p className="shop-order-meta">Ref: {order.id}</p>
        </div>
      ))}
    </div>
  );
}

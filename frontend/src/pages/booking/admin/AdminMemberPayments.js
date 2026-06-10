import React, { useState, useEffect, useMemo } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

function pence(n) {
  return `£${(n / 100).toFixed(2)}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SOURCE_STYLES = {
  Membership: { bg: '#eaf3ff', color: '#0a4aa1' },
  Booking:    { bg: '#e8f5e9', color: '#2e7d32' },
  Shop:       { bg: '#fff3e0', color: '#a35900' },
  Charge:     { bg: '#f3e8ff', color: '#5e2db4' },
};

const STATUS_STYLES = {
  paid:           { bg: '#e8f5e9', color: '#2e7d32' },
  'paid (credit)':{ bg: '#e8f5e9', color: '#2e7d32' },
  confirmed:      { bg: '#e8f5e9', color: '#2e7d32' },
  open:           { bg: '#fff8e1', color: '#b78900' },
  pending:        { bg: '#fff8e1', color: '#b78900' },
  void:           { bg: '#f1f1f1', color: '#666' },
  uncollectible:  { bg: '#fde8e6', color: 'var(--booking-danger)' },
  draft:          { bg: '#f1f1f1', color: '#666' },
  cancelled:      { bg: '#fde8e6', color: 'var(--booking-danger)' },
};

function Pill({ text, palette }) {
  const style = palette[text] || { bg: '#f1f1f1', color: '#666' };
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: '0.15rem 0.5rem', borderRadius: 4,
      fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {text || '—'}
    </span>
  );
}

export default function AdminMemberPayments() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [pm, setPm] = useState(null);
  const [customerUrl, setCustomerUrl] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.getMembers()
      .then(res => setMembers(res.data || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load members'))
      .finally(() => setLoadingMembers(false));
  }, []);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...members].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
    if (!q) return sorted;
    return sorted.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const selectedMember = useMemo(
    () => members.find(m => m.id === selectedId) || null,
    [members, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setPayments([]); setPm(null); setCustomerUrl(null);
      return;
    }
    setLoadingDetail(true);
    Promise.all([
      bookingApi.getMemberPayments(selectedId),
      bookingApi.getMemberPaymentMethod(selectedId),
    ])
      .then(([paymentsRes, pmRes]) => {
        setPayments(paymentsRes.data.payments || []);
        setCustomerUrl(paymentsRes.data.customerUrl || null);
        setPm(pmRes.data.paymentMethod || null);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load payment history'))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="bk-container">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Member payments</h1>
        <p className="bk-muted" style={{ margin: '0.25rem 0 0' }}>
          Pick a member to see their last 12 months of payments across memberships, bookings, the shop and admin charges. Every row links to the corresponding object in Stripe.
        </p>
      </header>

      {error && <div className="bk-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'flex-start' }}>
        <aside className="bk-card" style={{ padding: '0.75rem' }}>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            className="bk-input"
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          {loadingMembers ? (
            <p className="bk-muted" style={{ margin: 0 }}>Loading…</p>
          ) : (
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {filteredMembers.map(m => {
                const isSelected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.5rem 0.6rem', border: 'none',
                      background: isSelected ? 'var(--booking-primary-bg, #eef3ff)' : 'transparent',
                      color: 'inherit', borderRadius: 4, cursor: 'pointer',
                      fontSize: '0.88rem',
                    }}>
                    <div style={{ fontWeight: isSelected ? 600 : 500 }}>
                      {m.firstName} {m.lastName}
                    </div>
                    {m.email && (
                      <div className="bk-muted" style={{ fontSize: '0.75rem' }}>{m.email}</div>
                    )}
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="bk-muted" style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>No matches.</p>
              )}
            </div>
          )}
        </aside>

        <main>
          {!selectedMember && (
            <div className="bk-card">
              <p className="bk-muted" style={{ margin: 0 }}>Pick a member from the list to see their payment history.</p>
            </div>
          )}

          {selectedMember && (
            <>
              <div className="bk-card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedMember.firstName} {selectedMember.lastName}</h2>
                    {selectedMember.email && <p className="bk-muted" style={{ margin: '0.25rem 0 0' }}>{selectedMember.email}</p>}
                  </div>
                  {customerUrl && (
                    <a href={customerUrl} target="_blank" rel="noopener noreferrer" className="bk-btn bk-btn--sm">
                      Open in Stripe ↗
                    </a>
                  )}
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                  <strong>Card on file: </strong>
                  {pm ? (
                    <span>
                      {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} ending {pm.last4}
                      <span className="bk-muted" style={{ marginLeft: '0.5rem' }}>
                        Expires {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}
                      </span>
                    </span>
                  ) : (
                    <span className="bk-muted">none</span>
                  )}
                </div>
              </div>

              <div className="bk-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>Recent payments</h3>
                  <span className="bk-muted" style={{ fontSize: '0.85rem' }}>
                    {payments.length} item{payments.length === 1 ? '' : 's'} · total {pence(total)}
                  </span>
                </div>

                {loadingDetail && <p className="bk-muted" style={{ margin: 0 }}>Loading…</p>}
                {!loadingDetail && payments.length === 0 && (
                  <p className="bk-muted" style={{ margin: 0 }}>No payments in the last 12 months.</p>
                )}
                {!loadingDetail && payments.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="bk-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--booking-text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Date</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Source</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Description</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                            <td style={{ padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                            <td style={{ padding: '0.45rem 0.5rem' }}><Pill text={p.source} palette={SOURCE_STYLES} /></td>
                            <td style={{ padding: '0.45rem 0.5rem' }} title={p.description}>
                              {p.description.length > 70 ? p.description.slice(0, 67) + '…' : p.description}
                            </td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{pence(p.amount)}</td>
                            <td style={{ padding: '0.45rem 0.5rem' }}><Pill text={p.status} palette={STATUS_STYLES} /></td>
                            <td style={{ padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}>
                              {p.stripeUrl && (
                                <a href={p.stripeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>
                                  Stripe ↗
                                </a>
                              )}
                              {p.hostedInvoiceUrl && (
                                <>
                                  {p.stripeUrl && <span className="bk-muted" style={{ margin: '0 0.4rem' }}>·</span>}
                                  <a href={p.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>
                                    Invoice ↗
                                  </a>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

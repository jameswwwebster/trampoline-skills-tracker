import React, { useState, useEffect, useMemo } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

function toMonthValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(value) {
  const [year, mon] = value.split('-');
  return new Date(year, mon - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function pence(n) {
  return `£${(n / 100).toFixed(2)}`;
}

export default function AdminPayments() {
  const [charges, setCharges] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [view, setView] = useState('transactions'); // 'transactions' | 'summary'

  useEffect(() => {
    setLoading(true);
    bookingApi.getAdminPayments(selectedMonth || null)
      .then(r => {
        setCharges(r.data.charges);
        setCredits(r.data.credits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  // Build sorted list of all available months from the data (used when no filter applied)
  const availableMonths = useMemo(() => {
    const months = new Set();
    charges.forEach(c => months.add(toMonthValue(c.paidAt)));
    credits.forEach(c => months.add(toMonthValue(c.usedAt)));
    return Array.from(months).sort().reverse();
  }, [charges, credits]);

  // Combined transaction list sorted by date desc
  const transactions = useMemo(() => {
    const rows = [
      ...charges.map(c => ({
        id: c.id,
        type: 'charge',
        member: `${c.user.firstName} ${c.user.lastName}`,
        description: c.description,
        amount: c.amount,
        date: c.paidAt,
        method: c.paidWithCredit ? 'Credit' : 'Stripe',
      })),
      ...credits.map(c => ({
        id: c.id,
        type: 'credit',
        member: `${c.user.firstName} ${c.user.lastName}`,
        description: c.usedOnCharge
          ? `Credit towards: ${c.usedOnCharge.description}`
          : c.usedOnBooking
            ? 'Credit used on booking'
            : c.note || 'Credit used',
        amount: c.amount,
        date: c.usedAt,
        method: '—',
      })),
    ];
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  }, [charges, credits]);

  // Monthly summary
  const summary = useMemo(() => {
    const map = {};
    charges.forEach(c => {
      const m = toMonthValue(c.paidAt);
      if (!map[m]) map[m] = { stripe: 0, credit: 0, creditsSpent: 0 };
      if (c.paidWithCredit) map[m].credit += c.amount;
      else map[m].stripe += c.amount;
    });
    credits.forEach(c => {
      const m = toMonthValue(c.usedAt);
      if (!map[m]) map[m] = { stripe: 0, credit: 0, creditsSpent: 0 };
      map[m].creditsSpent += c.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, totals]) => ({ month, ...totals }));
  }, [charges, credits]);

  return (
    <div className="bk-page" style={{ maxWidth: '900px' }}>
      <h2>Payments</h2>

      <div className="bk-row" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div>
          <label className="bk-label" style={{ display: 'inline', marginRight: '0.5rem', marginBottom: 0 }}>
            Month
          </label>
          <select
            className="bk-input"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="">All time</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>

        <div className="bk-row" style={{ gap: '0.5rem' }}>
          <button
            className={`bk-btn bk-btn--sm${view === 'transactions' ? ' bk-btn--primary' : ''}`}
            style={view !== 'transactions' ? { background: 'var(--booking-bg-light)', border: '1px solid var(--booking-border)' } : {}}
            onClick={() => setView('transactions')}
          >
            Transactions
          </button>
          <button
            className={`bk-btn bk-btn--sm${view === 'summary' ? ' bk-btn--primary' : ''}`}
            style={view !== 'summary' ? { background: 'var(--booking-bg-light)', border: '1px solid var(--booking-border)' } : {}}
            onClick={() => setView('summary')}
          >
            Monthly summary
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : view === 'transactions' ? (
        <TransactionsTable transactions={transactions} />
      ) : (
        <SummaryTable summary={summary} />
      )}
    </div>
  );
}

function TransactionsTable({ transactions }) {
  if (transactions.length === 0) {
    return <p style={{ color: 'var(--booking-text-muted)' }}>No payment records found.</p>;
  }

  return (
    <table className="bk-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Member</th>
          <th>Description</th>
          <th>Type</th>
          <th>Method</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(t => (
          <tr key={`${t.type}-${t.id}`}>
            <td style={{ whiteSpace: 'nowrap' }}>
              {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </td>
            <td>{t.member}</td>
            <td>{t.description}</td>
            <td>
              <span style={{ color: t.type === 'charge' ? 'var(--booking-success)' : 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                {t.type === 'charge' ? 'Charge paid' : 'Credit spent'}
              </span>
            </td>
            <td style={{ fontSize: '0.85rem' }}>{t.method}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pence(t.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryTable({ summary }) {
  if (summary.length === 0) {
    return <p style={{ color: 'var(--booking-text-muted)' }}>No payment records found.</p>;
  }

  return (
    <table className="bk-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Month</th>
          <th style={{ textAlign: 'right' }}>Paid via Stripe</th>
          <th style={{ textAlign: 'right' }}>Paid via Credit</th>
          <th style={{ textAlign: 'right' }}>Credits Spent</th>
          <th style={{ textAlign: 'right' }}>Total received</th>
        </tr>
      </thead>
      <tbody>
        {summary.map(s => (
          <tr key={s.month}>
            <td>{formatMonth(s.month)}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pence(s.stripe)}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pence(s.credit)}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pence(s.creditsSpent)}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {pence(s.stripe + s.credit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

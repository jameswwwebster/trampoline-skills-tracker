import React, { useState, useEffect, useMemo } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATE_META = {
  PENDING:           { label: 'Pending',        color: '#b78900', bg: '#fff8e1', actionRequired: true },
  INVALID:           { label: 'Invalid',        color: 'var(--booking-danger)', bg: '#fde8e6', actionRequired: false },
  EXPIRED_IN_GRACE:  { label: 'Expired (grace)',color: '#c25e00', bg: '#fff0e6', actionRequired: false },
  EXPIRED_PAST_GRACE:{ label: 'Expired',        color: 'var(--booking-danger)', bg: '#fde8e6', actionRequired: true },
  MISSING:           { label: 'No number',      color: 'var(--booking-text-muted)', bg: '#f1f1f1', actionRequired: false },
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Action required' },
  { id: 'fyi', label: 'Just FYI' },
];

export default function AdminBgNumbers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('action');

  const load = () => {
    setLoading(true);
    bookingApi.getAdminBgNumbers()
      .then(r => setRows(r.data.rows || []))
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleVerify = async (gymnastId, action) => {
    setSaving(s => ({ ...s, [gymnastId]: true }));
    try {
      await bookingApi.verifyBgNumber(gymnastId, action);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setSaving(s => ({ ...s, [gymnastId]: false }));
    }
  };

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      if (filter === 'all') return true;
      const required = STATE_META[r.bgRowState]?.actionRequired;
      return filter === 'action' ? !!required : !required;
    });
    const stateOrder = ['PENDING', 'EXPIRED_PAST_GRACE', 'EXPIRED_IN_GRACE', 'INVALID', 'MISSING'];
    list.sort((a, b) => {
      const ao = stateOrder.indexOf(a.bgRowState);
      const bo = stateOrder.indexOf(b.bgRowState);
      if (ao !== bo) return ao - bo;
      return (b.daysInState ?? 0) - (a.daysInState ?? 0);
    });
    return list;
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, action: 0, fyi: 0 };
    for (const r of rows) {
      (STATE_META[r.bgRowState]?.actionRequired ? c.action++ : c.fyi++);
    }
    return c;
  }, [rows]);

  if (loading) return <p className="bk-muted">Loading...</p>;

  return (
    <div className="bk-page bk-page--xl">
      <h2 style={{ marginBottom: '1.25rem' }}>BG Numbers</h2>
      {error && <p className="bk-error">{error}</p>}

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.id}
            className="bk-btn bk-btn--sm"
            style={{
              border: '1px solid var(--booking-border)',
              background: filter === opt.id ? 'var(--booking-accent)' : 'transparent',
              color: filter === opt.id ? '#fff' : 'inherit',
            }}
            onClick={() => setFilter(opt.id)}
          >
            {opt.label} ({counts[opt.id]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="bk-muted">No gymnasts match this filter.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Gymnast</th>
              <th style={{ textAlign: 'left' }}>Adult</th>
              <th style={{ textAlign: 'left' }}>BG number</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Days</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => {
              const meta = STATE_META[g.bgRowState] || STATE_META.MISSING;
              const guardian = g.guardians?.[0];
              const daysText = g.bgRowState === 'EXPIRED_IN_GRACE' && g.graceDaysLeft != null
                ? `${g.graceDaysLeft}d left`
                : (g.daysInState != null ? `${g.daysInState}d` : '—');
              return (
                <tr key={g.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{g.firstName} {g.lastName}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                    {guardian ? `${guardian.firstName} ${guardian.lastName}` : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{g.bgNumber || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{
                      background: meta.bg, color: meta.color, padding: '0.15rem 0.5rem',
                      borderRadius: 4, fontSize: '0.78rem', fontWeight: 600,
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{daysText}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {g.bgRowState === 'PENDING' && (
                      <div className="bk-row" style={{ gap: '0.3rem' }}>
                        <button
                          className="bk-btn bk-btn--sm bk-btn--primary"
                          disabled={saving[g.id]}
                          onClick={() => handleVerify(g.id, 'verify')}
                        >Verify</button>
                        <button
                          className="bk-btn bk-btn--sm"
                          disabled={saving[g.id]}
                          style={{ color: '#c25e00', border: '1px solid #c25e00' }}
                          onClick={() => handleVerify(g.id, 'expire-pending')}
                          title="Real BG number, but membership has expired"
                        >Valid but expired</button>
                        <button
                          className="bk-btn bk-btn--sm"
                          disabled={saving[g.id]}
                          style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                          onClick={() => handleVerify(g.id, 'invalidate')}
                        >Invalid</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

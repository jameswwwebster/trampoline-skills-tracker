import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

export default function AdminBgNumbers() {
  const [data, setData] = useState({ pending: [], missing: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    bookingApi.getAdminBgNumbers()
      .then(r => setData(r.data))
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

  if (loading) return <p className="bk-muted">Loading...</p>;

  return (
    <div className="bk-page bk-page--xl">
      <h2 style={{ marginBottom: '1.25rem' }}>BG Numbers</h2>
      {error && <p className="bk-error">{error}</p>}

      <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>
        Pending Verification ({data.pending.length})
      </h3>

      {data.pending.length === 0 ? (
        <p className="bk-muted" style={{ marginBottom: '1.5rem' }}>No numbers awaiting verification.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%', marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Gymnast</th>
              <th style={{ textAlign: 'left' }}>Adult</th>
              <th style={{ textAlign: 'left' }}>BG Number</th>
              <th style={{ textAlign: 'right' }}>Days pending</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.pending.map(g => {
              const days = g.bgNumberEnteredAt
                ? Math.floor((Date.now() - new Date(g.bgNumberEnteredAt)) / (24 * 60 * 60 * 1000))
                : '—';
              const guardian = g.guardians?.[0];
              const graceDays = g.bgNumberGraceDays ?? 14;
              const urgent = typeof days === 'number' && days >= graceDays - 2;
              return (
                <tr key={g.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{g.firstName} {g.lastName}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                    {guardian ? `${guardian.firstName} ${guardian.lastName}` : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{g.bgNumber}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: urgent ? 'var(--booking-danger)' : 'inherit', fontWeight: urgent ? 700 : 400 }}>
                    {days}d / {graceDays}d
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <div className="bk-row" style={{ gap: '0.3rem' }}>
                      <button
                        className="bk-btn bk-btn--sm bk-btn--primary"
                        disabled={saving[g.id]}
                        onClick={() => handleVerify(g.id, 'verify')}
                      >Verify</button>
                      <button
                        className="bk-btn bk-btn--sm"
                        disabled={saving[g.id]}
                        style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                        onClick={() => handleVerify(g.id, 'invalidate')}
                      >Invalid</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>
        Missing Number — 2+ sessions ({data.missing.length})
      </h3>

      {data.missing.length === 0 ? (
        <p className="bk-muted">No gymnasts with missing numbers.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Gymnast</th>
              <th style={{ textAlign: 'left' }}>Adult</th>
              <th style={{ textAlign: 'right' }}>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {data.missing.map(g => {
              const guardian = g.guardians?.[0];
              return (
                <tr key={g.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{g.firstName} {g.lastName}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                    {guardian ? `${guardian.firstName} ${guardian.lastName}` : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{g.pastSessionCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

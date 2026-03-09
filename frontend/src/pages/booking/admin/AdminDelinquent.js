import React, { useState, useEffect, useCallback } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

export default function AdminDelinquent() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState({});
  const [remindResult, setRemindResult] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    bookingApi.getDelinquentMemberships()
      .then(res => setRows(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleRemind = async (id) => {
    setReminding(r => ({ ...r, [id]: true }));
    setRemindResult(r => ({ ...r, [id]: null }));
    try {
      await bookingApi.sendMembershipReminder(id);
      setRemindResult(r => ({ ...r, [id]: 'sent' }));
    } catch (err) {
      setRemindResult(r => ({ ...r, [id]: 'error' }));
    } finally {
      setReminding(r => ({ ...r, [id]: false }));
    }
  };

  return (
    <div className="bk-page bk-page--lg">
      <h2>Delinquent payments</h2>
      <p className="bk-muted" style={{ marginBottom: '1.5rem' }}>
        Members whose payment setup is incomplete.
      </p>

      {loading && <p className="bk-muted">Loading...</p>}

      {!loading && rows.length === 0 && (
        <p className="bk-muted">No outstanding payments.</p>
      )}

      {!loading && rows.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th>Guardian</th>
              <th style={{ textAlign: 'right' }}>Monthly</th>
              <th style={{ textAlign: 'right' }}>Days pending</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id}>
                <td>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                <td>
                  {m.guardian
                    ? <><span>{m.guardian.firstName} {m.guardian.lastName}</span><br /><span className="bk-muted" style={{ fontSize: '0.8rem' }}>{m.guardian.email}</span></>
                    : <span className="bk-muted">No guardian</span>}
                </td>
                <td style={{ textAlign: 'right' }}>£{(m.monthlyAmount / 100).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ color: m.daysPending >= 7 ? 'var(--booking-danger)' : 'inherit', fontWeight: m.daysPending >= 7 ? 600 : 'normal' }}>
                    {m.daysPending === 0 ? 'Today' : `${m.daysPending}d`}
                  </span>
                </td>
                <td>
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ border: '1px solid var(--booking-border)' }}
                    disabled={reminding[m.id] || !m.guardian}
                    onClick={() => handleRemind(m.id)}
                  >
                    {reminding[m.id] ? 'Sending...' : 'Send reminder'}
                  </button>
                  {remindResult[m.id] === 'sent' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--booking-success)' }}>Sent</span>
                  )}
                  {remindResult[m.id] === 'error' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--booking-danger)' }}>Failed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

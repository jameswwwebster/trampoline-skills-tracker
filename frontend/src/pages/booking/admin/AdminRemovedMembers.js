import React, { useEffect, useState } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const REASON_LABELS = { INACTIVITY: 'Inactive', MANUAL: 'Manual / GDPR' };

export default function AdminRemovedMembers() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getArchivedMembers()
      .then(r => setSummaries(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bk-muted">Loading...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Removed Members</h2>
      {summaries.length === 0 ? (
        <p className="bk-muted">No removed members yet.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Sessions</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total Paid</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Memberships</th>
              <th style={{ padding: '0.5rem' }}>Reason</th>
              <th style={{ padding: '0.5rem' }}>Removed</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                <td style={{ padding: '0.5rem' }}>{s.firstName} {s.lastName}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.sessionsAttended}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>£{(s.totalAmountPaid / 100).toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.membershipCount}</td>
                <td style={{ padding: '0.5rem' }}>{REASON_LABELS[s.deletionReason] ?? s.deletionReason}</td>
                <td style={{ padding: '0.5rem', color: 'var(--booking-text-muted)', fontSize: '0.8rem' }}>
                  {new Date(s.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

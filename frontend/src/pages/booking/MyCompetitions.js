import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

const STATUS_LABELS = {
  INVITED: { label: 'Action needed', color: '#1565c0' },
  PAYMENT_PENDING: { label: 'Payment due', color: 'var(--booking-warning, #e67e22)' },
  PAID: { label: 'Entered', color: 'var(--booking-success)' },
  DECLINED: { label: 'Declined', color: 'var(--booking-text-muted)' },
  WAIVED: { label: 'Entered (free)', color: 'var(--booking-success)' },
};

export default function MyCompetitions() {
  const [entries, setEntries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    bookingApi.getMyCompetitionEntries().then(res => setEntries(res.data));
  }, []);

  const upcoming = entries.filter(e => new Date(e.competitionEvent.startDate) >= new Date());
  const past = entries.filter(e => new Date(e.competitionEvent.startDate) < new Date());

  const renderEntry = (entry) => {
    const s = STATUS_LABELS[entry.status] || { label: entry.status, color: 'inherit' };
    const ev = entry.competitionEvent;
    const isDeadlinePassed = new Date() > new Date(ev.entryDeadline);
    const canRespond = entry.status === 'INVITED' && (!isDeadlinePassed || ev.lateEntryFee !== null);
    const canPay = entry.status === 'PAYMENT_PENDING';
    const canEnter = canRespond || canPay;

    return (
      <div key={entry.id} className="bk-card" style={{ marginBottom: '0.75rem' }}>
        <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>{ev.name}</p>
            <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
              {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {entry.gymnast.firstName} {entry.gymnast.lastName}
            </p>
            {entry.categories.length > 0 && (
              <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                {entry.categories.map(ec => ec.category.name).join(', ')}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem', display: 'block' }}>{s.label}</span>
            {entry.totalAmount && <span className="bk-muted" style={{ fontSize: '0.8rem' }}>£{(entry.totalAmount / 100).toFixed(2)}</span>}
          </div>
        </div>
        {canRespond && (
          <button className="bk-btn bk-btn--primary bk-btn--sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate(`/booking/competitions/${entry.id}/enter`)}>
            View invite
          </button>
        )}
        {canPay && (
          <button className="bk-btn bk-btn--primary bk-btn--sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate(`/booking/competitions/${entry.id}/enter`)}>
            Pay now
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bk-page bk-page--sm">
      <h2>Competitions</h2>
      {entries.length === 0 && <p className="bk-muted">No competition invitations yet.</p>}
      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>UPCOMING</h3>
          {upcoming.map(renderEntry)}
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '1.5rem 0 0.75rem' }}>PAST</h3>
          {past.map(renderEntry)}
        </>
      )}
    </div>
  );
}

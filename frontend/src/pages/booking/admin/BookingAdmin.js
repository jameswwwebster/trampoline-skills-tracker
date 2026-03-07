import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BookingAdmin() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);

  useEffect(() => {
    bookingApi.getSessions(year, month).then(res => setSessions(res.data));
  }, [year, month]);

  useEffect(() => {
    if (selectedSession) {
      bookingApi.getSession(selectedSession).then(res => setSessionDetail(res.data));
    }
  }, [selectedSession]);

  return (
    <div className="bk-page bk-page--xl">
      <h2>Booking Admin</h2>

      <div className="bk-row" style={{ marginBottom: '1rem' }}>
        <button className="bk-btn" onClick={() => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1)}>&lsaquo;</button>
        <strong>{MONTHS[month - 1]} {year}</strong>
        <button className="bk-btn" onClick={() => month === 12 ? (setMonth(1), setYear(y => y + 1)) : setMonth(m => m + 1)}>&rsaquo;</button>
      </div>

      <table className="bk-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th style={{ textAlign: 'center' }}>Booked</th>
            <th style={{ textAlign: 'center' }}>Available</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id}>
              <td>{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              <td>{s.startTime}–{s.endTime}{s.minAge ? ' (16+)' : ''}</td>
              <td style={{ textAlign: 'center' }}>{s.bookedCount}</td>
              <td style={{ textAlign: 'center' }}>{s.availableSlots}</td>
              <td>{s.cancelledAt ? 'Cancelled' : 'Active'}</td>
              <td>
                <button onClick={() => setSelectedSession(s.id)} className="bk-btn bk-btn--sm bk-btn--primary">View</button>
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr><td colSpan={6} className="bk-center">No sessions this month.</td></tr>
          )}
        </tbody>
      </table>

      {sessionDetail && (
        <div className="bk-card">
          <h3>
            {new Date(sessionDetail.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' '}{sessionDetail.startTime}–{sessionDetail.endTime}
          </h3>
          <p>{sessionDetail.bookedCount}/{sessionDetail.capacity} booked</p>
          {sessionDetail.bookings?.map(b => (
            <div key={b.id} style={{ padding: '0.5rem 0', borderBottom: `1px solid var(--booking-bg-light)` }}>
              {b.lines.map(l => (
                <div key={l.id} style={{ marginBottom: '0.4rem' }}>
                  <strong>{l.gymnast.firstName} {l.gymnast.lastName}</strong>
                  {l.gymnast.emergencyContactName ? (
                    <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                      Emergency: {l.gymnast.emergencyContactName}
                      {l.gymnast.emergencyContactRelationship && ` (${l.gymnast.emergencyContactRelationship})`}
                      {' · '}
                      <a href={`tel:${l.gymnast.emergencyContactPhone}`} style={{ color: 'var(--booking-accent)' }}>
                        {l.gymnast.emergencyContactPhone}
                      </a>
                    </span>
                  ) : (
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--booking-danger)' }}>
                      No emergency contact
                    </span>
                  )}
                </div>
              ))}
              <span className="bk-muted" style={{ fontSize: '0.8rem' }}>Booked by {b.user.firstName} {b.user.lastName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

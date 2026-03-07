import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h2>Booking Admin</h2>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1)}>&lsaquo;</button>
        <strong>{MONTHS[month - 1]} {year}</strong>
        <button onClick={() => month === 12 ? (setMonth(1), setYear(y => y + 1)) : setMonth(m => m + 1)}>&rsaquo;</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Time</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Booked</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Available</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              <td style={{ padding: '0.5rem' }}>{s.startTime}–{s.endTime}{s.minAge ? ' (16+)' : ''}</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.bookedCount}</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.availableSlots}</td>
              <td style={{ padding: '0.5rem' }}>{s.cancelledAt ? 'Cancelled' : 'Active'}</td>
              <td style={{ padding: '0.5rem' }}>
                <button onClick={() => setSelectedSession(s.id)} style={{ fontSize: '0.8rem' }}>View</button>
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>No sessions this month.</td></tr>
          )}
        </tbody>
      </table>

      {sessionDetail && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem' }}>
          <h3>
            {new Date(sessionDetail.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' '}{sessionDetail.startTime}–{sessionDetail.endTime}
          </h3>
          <p>{sessionDetail.bookedCount}/{sessionDetail.capacity} booked</p>
          {sessionDetail.bookings?.map(b => (
            <div key={b.id} style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>
              <strong>{b.user.firstName} {b.user.lastName}</strong>
              {' — '}
              {b.lines.map(l => `${l.gymnast.firstName} ${l.gymnast.lastName}`).join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

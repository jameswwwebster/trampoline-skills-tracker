import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ManualAddForm({ sessionId, onAdded }) {
  const [users, setUsers] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [userId, setUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [gymnastIds, setGymnastIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      fetch(`${API_URL}/users`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/gymnasts`, { headers }).then(r => r.json()),
    ]).then(([u, g]) => {
      setUsers(Array.isArray(u) ? u : u.users || []);
      setGymnasts(Array.isArray(g) ? g : g.gymnasts || []);
    }).catch(console.error);
  }, []);

  const toggleGymnast = (id) =>
    setGymnastIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const filteredUsers = userSearch.trim().length > 0
    ? users.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase()))
    : [];

  const selectedUser = users.find(u => u.id === userId);

  const handleSelectUser = (u) => {
    setUserId(u.id);
    setUserSearch(`${u.firstName} ${u.lastName}`);
    setShowUserDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || gymnastIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.adminAddToSession({ sessionInstanceId: sessionId, gymnastIds, userId });
      setUserId('');
      setUserSearch('');
      setGymnastIds([]);
      onAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add to session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: '0 0 0.75rem' }}>Add participant</h4>
      <div className="bk-grid-2">
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Account holder
          <div style={{ position: 'relative', marginTop: '0.25rem' }}>
            <input
              className="bk-input"
              placeholder="Search by name..."
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUserId(''); setShowUserDropdown(true); }}
              onFocus={() => setShowUserDropdown(true)}
              onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
              autoComplete="off"
            />
            {showUserDropdown && filteredUsers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--booking-bg-white)', border: '1px solid var(--booking-border)',
                borderRadius: 'var(--booking-radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    onMouseDown={() => handleSelectUser(u)}
                    style={{
                      padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                      background: u.id === userId ? 'rgba(124,53,232,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--booking-bg-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = u.id === userId ? 'rgba(124,53,232,0.08)' : 'transparent'}
                  >
                    {u.firstName} {u.lastName}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedUser && (
            <span style={{ fontSize: '0.8rem', color: 'var(--booking-success)', marginTop: '0.2rem', display: 'block' }}>
              ✓ {selectedUser.firstName} {selectedUser.lastName} selected
            </span>
          )}
        </label>
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <p className="bk-label" style={{ fontWeight: 'normal', marginBottom: '0.4rem' }}>Gymnasts</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {gymnasts.filter(g => !g.isArchived).map(g => (
            <label key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.6rem', border: `1px solid ${gymnastIds.includes(g.id) ? 'var(--booking-accent)' : 'var(--booking-border)'}`,
              borderRadius: 'var(--booking-radius)', cursor: 'pointer', fontSize: '0.875rem',
              background: gymnastIds.includes(g.id) ? 'rgba(124,53,232,0.08)' : 'var(--booking-bg-white)',
            }}>
              <input type="checkbox" checked={gymnastIds.includes(g.id)} onChange={() => toggleGymnast(g.id)} />
              {g.firstName} {g.lastName}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="bk-error">{error}</p>}
      <button type="submit" disabled={submitting || !userId || gymnastIds.length === 0} className="bk-btn bk-btn--primary bk-btn--sm">
        {submitting ? 'Adding...' : 'Add to session'}
      </button>
    </form>
  );
}

export default function BookingAdmin() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const loadSessions = () =>
    bookingApi.getSessions(year, month).then(res => setSessions(res.data));

  const loadDetail = (id) =>
    bookingApi.getSession(id).then(res => setSessionDetail(res.data));

  useEffect(() => { loadSessions(); }, [year, month]);

  useEffect(() => {
    if (selectedSession) loadDetail(selectedSession);
  }, [selectedSession]);

  const handleSelect = (id) => {
    setSelectedSession(id);
    setShowManualAdd(false);
  };

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
            <tr key={s.id} style={selectedSession === s.id ? { background: 'rgba(124,53,232,0.06)' } : {}}>
              <td>{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              <td>{s.startTime}–{s.endTime}{s.minAge ? ' (16+)' : ''}</td>
              <td style={{ textAlign: 'center' }}>{s.bookedCount}</td>
              <td style={{ textAlign: 'center' }}>{s.availableSlots}</td>
              <td>{s.cancelledAt ? 'Cancelled' : 'Active'}</td>
              <td>
                <button onClick={() => handleSelect(s.id)} className="bk-btn bk-btn--sm bk-btn--primary">
                  {selectedSession === s.id ? 'Selected ▾' : 'View'}
                </button>
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
          <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>
              {new Date(sessionDetail.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' '}{sessionDetail.startTime}–{sessionDetail.endTime}
            </h3>
            <span className="bk-muted" style={{ fontSize: '0.9rem' }}>{sessionDetail.bookedCount}/{sessionDetail.capacity} booked</span>
          </div>

          {sessionDetail.bookings?.length === 0 && (
            <p className="bk-muted">No bookings yet.</p>
          )}
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
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem' }}>
                    {[
                      { type: 'photo_coaching', label: 'Coaching photos' },
                      { type: 'photo_social_media', label: 'Social media' },
                    ].map(({ type, label }) => {
                      const granted = l.gymnast.consents?.find(c => c.type === type)?.granted;
                      return (
                        <span key={type} style={{
                          marginRight: '0.4rem', padding: '1px 6px', borderRadius: 4,
                          background: granted ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.1)',
                          color: granted ? 'var(--booking-success)' : 'var(--booking-danger)',
                        }}>
                          {granted ? '✓' : '✗'} {label}
                        </span>
                      );
                    })}
                  </span>
                </div>
              ))}
              <span className="bk-muted" style={{ fontSize: '0.8rem' }}>Booked by {b.user.firstName} {b.user.lastName}</span>
            </div>
          ))}

          <div style={{ marginTop: '0.75rem' }}>
            <button
              className="bk-btn bk-btn--sm bk-btn--primary"
              onClick={() => setShowManualAdd(v => !v)}
            >
              {showManualAdd ? 'Cancel' : '+ Add participant manually'}
            </button>
          </div>

          {showManualAdd && (
            <ManualAddForm
              sessionId={selectedSession}
              onAdded={() => {
                setShowManualAdd(false);
                loadDetail(selectedSession);
                loadSessions();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

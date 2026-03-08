import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import SessionTemplates from './SessionTemplates';
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

const CONSENT_BADGES = [
  { type: 'photo_coaching', label: 'Coaching' },
  { type: 'photo_social_media', label: 'Social media' },
];

function SessionDetailPanel({ sessionDetail, selectedSession, showManualAdd, setShowManualAdd, onAdded }) {
  const [confirmingRemove, setConfirmingRemove] = useState(null); // bookingId
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const totalGymnasts = sessionDetail.bookings?.reduce((n, b) => n + b.lines.length, 0) ?? 0;
  const capacity = sessionDetail.capacity;

  const handleRemove = async (bookingId, issueCredit) => {
    setRemoving(bookingId);
    setRemoveError(null);
    try {
      await bookingApi.cancelBooking(bookingId, { issueCredit });
      setConfirmingRemove(null);
      onAdded();
    } catch (err) {
      setRemoveError(err.response?.data?.error || 'Failed to remove.');
      setRemoving(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--booking-accent-gradient)',
        borderRadius: 'var(--booking-radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1rem',
        color: '#fff',
      }}>
        <p style={{ margin: '0 0 0.2rem', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {new Date(sessionDetail.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '1.5rem', fontWeight: 700 }}>
          {sessionDetail.startTime} – {sessionDetail.endTime}
          {sessionDetail.minAge && <span style={{ fontSize: '0.9rem', fontWeight: 400, marginLeft: '0.6rem', opacity: 0.85 }}>{sessionDetail.minAge}+</span>}
        </p>
        {/* Capacity bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem', opacity: 0.9 }}>
            <span>{totalGymnasts} booked</span>
            <span>{capacity - totalGymnasts} remaining</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 99, height: 8 }}>
            <div style={{
              height: 8, borderRadius: 99,
              background: totalGymnasts >= capacity ? '#e74c3c' : '#fff',
              width: `${Math.min(100, (totalGymnasts / capacity) * 100)}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
        {sessionDetail.cancelledAt && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', background: 'rgba(231,76,60,0.3)', borderRadius: 4, padding: '0.3rem 0.6rem', display: 'inline-block' }}>
            Cancelled
          </p>
        )}
      </div>

      {/* Attendees */}
      <div className="bk-card" style={{ marginBottom: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
          Attendees
        </h4>

        {totalGymnasts === 0 && <p className="bk-muted" style={{ margin: 0 }}>No bookings yet.</p>}
        {removeError && <p className="bk-error" style={{ margin: '0 0 0.5rem' }}>{removeError}</p>}

        {sessionDetail.bookings?.map(b =>
          b.lines.map(l => (
            <div key={l.id} style={{
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--booking-bg-light)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{l.gymnast.firstName} {l.gymnast.lastName}</strong>
                  <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    via {b.user.firstName} {b.user.lastName}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.3rem', flexShrink: 0, maxWidth: '55%' }}>
                  {CONSENT_BADGES.map(({ type, label }) => {
                    const granted = l.gymnast.consents?.find(c => c.type === type)?.granted;
                    return (
                      <span key={type} title={label} style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem',
                        background: granted ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.1)',
                        color: granted ? 'var(--booking-success)' : 'var(--booking-danger)',
                      }}>
                        {granted ? '✓' : '✗'} {label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {confirmingRemove !== b.id && (
                <button
                  className="bk-btn bk-btn--sm"
                  onClick={() => { setConfirmingRemove(b.id); setRemoveError(null); }}
                  style={{ marginTop: '0.4rem', color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                >
                  Remove
                </button>
              )}

              {confirmingRemove === b.id && (
                <div style={{
                  margin: '0.6rem 0 0.25rem',
                  padding: '0.65rem 0.75rem',
                  background: 'rgba(231,76,60,0.06)',
                  border: '1px solid rgba(231,76,60,0.25)',
                  borderRadius: 'var(--booking-radius)',
                }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    Remove {l.gymnast.firstName} from this session?
                  </p>
                  <div className="bk-row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      className="bk-btn bk-btn--sm"
                      disabled={!!removing}
                      onClick={() => handleRemove(b.id, true)}
                      style={{ background: 'var(--booking-accent)', color: '#fff', border: 'none' }}
                    >
                      {removing === b.id ? '…' : 'Remove + issue credit'}
                    </button>
                    <button
                      className="bk-btn bk-btn--sm"
                      disabled={!!removing}
                      onClick={() => handleRemove(b.id, false)}
                      style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                    >
                      {removing === b.id ? '…' : 'Remove, no credit'}
                    </button>
                    <button
                      className="bk-btn bk-btn--sm"
                      disabled={!!removing}
                      onClick={() => setConfirmingRemove(null)}
                      style={{ border: '1px solid var(--booking-border)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {l.gymnast.userId !== b.user.id ? (
                /* Child — show parent as emergency contact */
                b.user.phone ? (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                    Parent: <strong style={{ color: 'var(--booking-text-on-light)' }}>{b.user.firstName} {b.user.lastName}</strong>
                    {' · '}
                    <a href={`tel:${b.user.phone}`} style={{ color: 'var(--booking-accent)' }}>{b.user.phone}</a>
                  </p>
                ) : (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                    Parent {b.user.firstName} {b.user.lastName} has no phone number
                  </p>
                )
              ) : l.gymnast.emergencyContactName ? (
                /* Self — show their own emergency contact */
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                  Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{l.gymnast.emergencyContactName}</strong>
                  {l.gymnast.emergencyContactRelationship && ` (${l.gymnast.emergencyContactRelationship})`}
                  {' · '}
                  <a href={`tel:${l.gymnast.emergencyContactPhone}`} style={{ color: 'var(--booking-accent)' }}>
                    {l.gymnast.emergencyContactPhone}
                  </a>
                </p>
              ) : (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                  No emergency contact
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add participant */}
      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%' }}
        onClick={() => setShowManualAdd(v => !v)}
      >
        {showManualAdd ? 'Cancel' : '+ Add participant manually'}
      </button>

      {showManualAdd && (
        <ManualAddForm
          sessionId={selectedSession}
          onAdded={onAdded}
        />
      )}
    </div>
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
    setSelectedSession(prev => prev === id ? null : id);
    setSessionDetail(null);
    setShowManualAdd(false);
  };

  return (
    <div className="bk-page bk-page--xl">
      <h2 style={{ marginBottom: '1.25rem' }}>Booking Admin</h2>

      <SessionTemplates />

      <div className="bk-row" style={{ marginBottom: '0.75rem' }}>
        <button className="bk-btn" onClick={() => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1)}>&lsaquo;</button>
        <strong>{MONTHS[month - 1]} {year}</strong>
        <button className="bk-btn" onClick={() => month === 12 ? (setMonth(1), setYear(y => y + 1)) : setMonth(m => m + 1)}>&rsaquo;</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {sessions.length === 0 && <p className="bk-muted">No sessions this month.</p>}
        {sessions.map(s => {
          const isSelected = selectedSession === s.id;
          const full = s.availableSlots === 0;
          return (
            <div key={s.id}>
              <button
                onClick={() => handleSelect(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${isSelected ? 'var(--booking-accent)' : 'var(--booking-border)'}`,
                  borderRadius: isSelected && sessionDetail ? 'var(--booking-radius) var(--booking-radius) 0 0' : 'var(--booking-radius)',
                  background: isSelected ? 'rgba(124,53,232,0.06)' : 'var(--booking-bg-white)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  transition: 'border-color 0.15s, background 0.15s',
                  borderBottom: isSelected && sessionDetail ? 'none' : undefined,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: s.cancelledAt ? 'var(--booking-text-muted)' : 'var(--booking-text-on-light)' }}>
                    {new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {s.cancelledAt && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--booking-danger)' }}>Cancelled</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.1rem' }}>
                    {s.startTime}–{s.endTime}{s.minAge ? ` · ${s.minAge}+` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginLeft: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: full ? 'var(--booking-danger)' : 'var(--booking-accent)' }}>
                      {s.bookedCount}/{s.bookedCount + s.availableSlots}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--booking-text-muted)' }}>
                      {full ? 'Full' : `${s.availableSlots} left`}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: isSelected ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>
              </button>

              {isSelected && sessionDetail && (
                <div style={{
                  border: `2px solid var(--booking-accent)`,
                  borderTop: 'none',
                  borderRadius: '0 0 var(--booking-radius) var(--booking-radius)',
                  background: 'var(--booking-bg-white)',
                  padding: '1rem',
                }}>
                  <SessionDetailPanel
                    sessionDetail={sessionDetail}
                    selectedSession={selectedSession}
                    showManualAdd={showManualAdd}
                    setShowManualAdd={setShowManualAdd}
                    onAdded={() => {
                      setShowManualAdd(false);
                      loadDetail(selectedSession);
                      loadSessions();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import CalendarNav from '../CalendarNav';
import '../booking-shared.css';
import '../BookingCalendar.css';

const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '44')}`;

// ─── ManualAddForm ───────────────────────────────────────────────────────────

function ManualAddForm({ sessionId, bookedGymnastIds, onAdded }) {
  const [allGymnasts, setAllGymnasts] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState([]); // array of gymnast objects
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    fetch(`${API_URL}/gymnasts`, { headers })
      .then(r => r.json())
      .then(g => setAllGymnasts(Array.isArray(g) ? g : g.gymnasts || []))
      .catch(console.error);
  }, []);

  // Gymnasts matching the search, excluding already-booked and already-selected
  const filtered = search.trim().length > 0
    ? allGymnasts.filter(g =>
        !g.isArchived &&
        !bookedGymnastIds.includes(g.id) &&
        !selected.some(s => s.id === g.id) &&
        `${g.firstName} ${g.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Derive the booking userId for a gymnast: own account first, then first guardian
  const getAccountHolder = (g) =>
    g.userId || g.guardians?.[0]?.id || null;

  const handleSelect = (g) => {
    setSelected(prev => [...prev, g]);
    setSearch('');
    setShowDropdown(false);
  };

  const handleRemove = (id) =>
    setSelected(prev => prev.filter(g => g.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setSubmitting(true);
    setError(null);

    // Group gymnasts by account holder
    const groups = {};
    for (const g of selected) {
      const uid = getAccountHolder(g);
      if (!uid) {
        setError(`${g.firstName} ${g.lastName} has no associated account — ask them to create an account first.`);
        setSubmitting(false);
        return;
      }
      if (!groups[uid]) groups[uid] = [];
      groups[uid].push(g.id);
    }

    try {
      for (const [userId, gymnastIds] of Object.entries(groups)) {
        await bookingApi.adminAddToSession({ sessionInstanceId: sessionId, gymnastIds, userId });
      }
      setSelected([]);
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

      {/* Gymnast search */}
      <label className="bk-label" style={{ fontWeight: 'normal', display: 'block', marginBottom: '0.75rem' }}>
        Search gymnast
        <div style={{ position: 'relative', marginTop: '0.25rem' }}>
          <input
            className="bk-input"
            placeholder="Search by gymnast name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            autoComplete="off"
          />
          {showDropdown && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--booking-bg-white)', border: '1px solid var(--booking-border)',
              borderRadius: 'var(--booking-radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {filtered.map(g => (
                <div
                  key={g.id}
                  onMouseDown={() => handleSelect(g)}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--booking-bg-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {g.firstName} {g.lastName}
                  {g.guardians?.length > 0 && (
                    <span style={{ color: 'var(--booking-text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      ({g.guardians.map(gu => `${gu.firstName} ${gu.lastName}`).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </label>

      {/* Selected gymnasts */}
      {selected.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p className="bk-label" style={{ fontWeight: 'normal', marginBottom: '0.4rem' }}>
            To add
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {selected.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleRemove(g.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: '1px solid var(--booking-accent)',
                  borderRadius: 'var(--booking-radius)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  background: 'rgba(124,53,232,0.1)',
                  color: 'var(--booking-accent)',
                  fontWeight: 600,
                }}
              >
                {g.firstName} {g.lastName} &times;
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="bk-error">{error}</p>}
      <button
        type="submit"
        disabled={submitting || selected.length === 0}
        className="bk-btn bk-btn--primary bk-btn--sm"
      >
        {submitting ? 'Adding...' : `Add ${selected.length > 1 ? `${selected.length} gymnasts` : 'gymnast'} to session`}
      </button>
    </form>
  );
}

// ─── SessionDetailPanel (unchanged) ─────────────────────────────────────────

const CONSENT_BADGES = [
  { type: 'photo_coaching', label: 'Coaching' },
  { type: 'photo_social_media', label: 'Social media' },
];

function SessionDetailPanel({ sessionDetail, selectedSession, showManualAdd, setShowManualAdd, onAdded }) {
  const navigate = useNavigate();
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const [standingSlots, setStandingSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const totalGymnasts = sessionDetail.bookings?.reduce((n, b) => n + b.lines.length, 0) ?? 0;
  const capacity = sessionDetail.capacity;

  useEffect(() => {
    if (!sessionDetail.templateId) return;
    setSlotsLoading(true);
    bookingApi.getCommitmentsForTemplate(sessionDetail.templateId)
      .then(res => setStandingSlots(res.data))
      .catch(() => setStandingSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [sessionDetail.templateId]);

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
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem', opacity: 0.9 }}>
            <span>{totalGymnasts} booked</span>
            <span>
              {capacity - totalGymnasts - (sessionDetail.activeCommitments ?? 0)} remaining
              {sessionDetail.activeCommitments > 0 && ` (${sessionDetail.activeCommitments} standing)`}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 99, height: 8 }}>
            <div style={{
              height: 8, borderRadius: 99,
              background: (totalGymnasts + (sessionDetail.activeCommitments ?? 0)) >= capacity ? '#e74c3c' : '#fff',
              width: `${Math.min(100, ((totalGymnasts + (sessionDetail.activeCommitments ?? 0)) / capacity) * 100)}%`,
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

      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%', marginBottom: '0.5rem' }}
        onClick={() => navigate(`/booking/admin/register/${selectedSession}`)}
      >
        Open register
      </button>

      <button
        className="bk-btn"
        style={{ width: '100%', marginBottom: '0.5rem', border: '1px solid var(--booking-accent)', color: 'var(--booking-accent)' }}
        onClick={() => navigate(`/gymnasts?session=${selectedSession}`)}
      >
        Track these gymnasts →
      </button>

      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%', marginBottom: '1rem' }}
        onClick={() => setShowManualAdd(v => !v)}
      >
        {showManualAdd ? 'Cancel' : '+ Add participant manually'}
      </button>

      {showManualAdd && (
        <ManualAddForm
          sessionId={selectedSession}
          bookedGymnastIds={sessionDetail.bookings?.flatMap(b => b.lines.map(l => l.gymnast.id)) ?? []}
          onAdded={onAdded}
        />
      )}

      {sessionDetail.templateId && (
        <div className="bk-card" style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
            Standing slots
          </h4>
          {slotsLoading && <p className="bk-muted" style={{ margin: 0 }}>Loading…</p>}
          {!slotsLoading && standingSlots && standingSlots.length === 0 && (
            <p className="bk-muted" style={{ margin: 0 }}>No standing slots.</p>
          )}
          {!slotsLoading && standingSlots && standingSlots.filter(c => c.status !== 'WAITLISTED').map(c => {
            const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
            const startsBadge = isFuture
              ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : null;
            return (
              <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--booking-bg-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {CONSENT_BADGES.map(({ type, label }) => {
                      const granted = c.gymnast.consents?.find(con => con.type === type)?.granted;
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
                    {isFuture ? (
                      <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', fontWeight: 600 }}>
                        Starts {startsBadge}
                      </span>
                    ) : c.status === 'PAUSED' ? (
                      <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'var(--booking-text-muted)' }}>
                        Paused
                      </span>
                    ) : null}
                  </div>
                </div>
                {c.gymnast.emergencyContactName ? (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                    Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{c.gymnast.emergencyContactName}</strong>
                    {c.gymnast.emergencyContactRelationship && ` (${c.gymnast.emergencyContactRelationship})`}
                    {' · '}
                    <a href={waLink(c.gymnast.emergencyContactPhone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>
                      {c.gymnast.emergencyContactPhone}
                    </a>
                  </p>
                ) : !c.gymnast.userId && c.gymnast.guardians?.[0]?.phone ? (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                    Parent: <strong style={{ color: 'var(--booking-text-on-light)' }}>{c.gymnast.guardians[0].firstName} {c.gymnast.guardians[0].lastName}</strong>
                    {' · '}
                    <a href={waLink(c.gymnast.guardians[0].phone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>
                      {c.gymnast.guardians[0].phone}
                    </a>
                  </p>
                ) : (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>No emergency contact</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bk-card" style={{ marginBottom: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
          Attendees
        </h4>
        {totalGymnasts === 0 && <p className="bk-muted" style={{ margin: 0 }}>No bookings yet.</p>}
        {removeError && <p className="bk-error" style={{ margin: '0 0 0.5rem' }}>{removeError}</p>}
        {sessionDetail.bookings?.map(b =>
          b.lines.map(l => (
            <div key={l.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--booking-bg-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{l.gymnast.firstName} {l.gymnast.lastName}</strong>
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
                  margin: '0.6rem 0 0.25rem', padding: '0.65rem 0.75rem',
                  background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.25)',
                  borderRadius: 'var(--booking-radius)',
                }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    Remove {l.gymnast.firstName} from this session?
                  </p>
                  <div className="bk-row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button className="bk-btn bk-btn--sm" disabled={!!removing} onClick={() => handleRemove(b.id, true)} style={{ background: 'var(--booking-accent)', color: '#fff', border: 'none' }}>
                      {removing === b.id ? '…' : 'Remove + issue credit'}
                    </button>
                    <button className="bk-btn bk-btn--sm" disabled={!!removing} onClick={() => handleRemove(b.id, false)} style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}>
                      {removing === b.id ? '…' : 'Remove, no credit'}
                    </button>
                    <button className="bk-btn bk-btn--sm" disabled={!!removing} onClick={() => setConfirmingRemove(null)} style={{ border: '1px solid var(--booking-border)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {l.gymnast.userId !== b.user.id ? (
                b.user.phone ? (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                    Booked by: <strong style={{ color: 'var(--booking-text-on-light)' }}>{b.user.firstName} {b.user.lastName}</strong>
                    {' · '}
                    <a href={waLink(b.user.phone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>{b.user.phone}</a>
                  </p>
                ) : (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                    {b.user.firstName} {b.user.lastName} has no phone number
                  </p>
                )
              ) : l.gymnast.emergencyContactName ? (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                  Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{l.gymnast.emergencyContactName}</strong>
                  {l.gymnast.emergencyContactRelationship && ` (${l.gymnast.emergencyContactRelationship})`}
                  {' · '}
                  <a href={waLink(l.gymnast.emergencyContactPhone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>
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

    </div>
  );
}

// ─── BookingAdmin ─────────────────────────────────────────────────────────────

export default function BookingAdmin() {
  const location = useLocation();
  const lastNavigatedDate = React.useRef(new Date());
  const preselectRef = useRef(location.state?.preselect || null);
  const [sessions, setSessions] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const loadDetail = (id) =>
    bookingApi.getSession(id).then(res => setSessionDetail(res.data));

  useEffect(() => {
    if (selectedSession) loadDetail(selectedSession);
  }, [selectedSession]);

  const getClosureForDate = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return closures.find(c => {
      const start = new Date(c.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }) || null;
  };

  const handleNavigate = (date) => {
    lastNavigatedDate.current = date;
    setSelectedSession(null);
    setSessionDetail(null);
    setShowManualAdd(false);
    setLoading(true);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    // Fetch both months if week spans a boundary
    const ws = new Date(date);
    ws.setDate(ws.getDate() - ws.getDay());
    ws.setHours(0, 0, 0, 0);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const fetchMonths = [{ y, m }];
    if (we.getMonth() + 1 !== m || we.getFullYear() !== y) {
      fetchMonths.push({ y: we.getFullYear(), m: we.getMonth() + 1 });
    }
    Promise.all([
      ...fetchMonths.map(({ y: fy, m: fm }) => bookingApi.getSessions(fy, fm)),
      bookingApi.getClosures(),
    ]).then(results => {
      setSessions(results.slice(0, -1).flatMap(r => r.data));
      setClosures(results[results.length - 1].data);
      if (preselectRef.current) {
        setSelectedSession(preselectRef.current);
        preselectRef.current = null;
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSelect = (id) => {
    setSelectedSession(prev => prev === id ? null : id);
    setSessionDetail(null);
    setShowManualAdd(false);
  };

  const sessionDotClass = (s) =>
    s.availableSlots === 0 || s.cancelledAt ? 'full' : 'open';

  return (
    <div className="bk-page bk-page--xl">
      <h2 style={{ marginBottom: '1.25rem' }}>Booking Admin</h2>

      <CalendarNav
        sessions={sessions}
        onNavigate={handleNavigate}
        loading={loading}
        closures={closures}
        renderDayDots={(date, daySessions, isPast, isClosed) => {
          if (isClosed) return null;
          return daySessions.slice(0, 3).map((s, i) => (
            <span
              key={i}
              className={`booking-calendar__week-dot${sessionDotClass(s) === 'full' ? ' booking-calendar__week-dot--full' : ''}`}
            />
          ));
        }}
        renderDayPanel={(date, daySessions, isPast, isClosed) => (
          <>
            <p className="booking-calendar__day-detail-heading">
              {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {isClosed && (
              <p className="booking-calendar__day-closed">
                Closed{getClosureForDate(date)?.reason ? ` — ${getClosureForDate(date).reason}` : ''}
              </p>
            )}
            {!isClosed && daySessions.length === 0 && (
              <p className="booking-calendar__day-empty">No sessions</p>
            )}
            {!isClosed && daySessions.map(s => (
              <button
                key={s.id}
                className={`booking-calendar__day-session booking-calendar__day-session--${sessionDotClass(s)}`}
                style={{ textDecoration: s.cancelledAt ? 'line-through' : 'none' }}
                onClick={() => handleSelect(s.id)}
              >
                <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}
                  {s.type === 'DMT' && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: '#e67e22', borderRadius: 3, padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6 }}>DMT</span>
                  )}
                  {s.type === 'TRAMPOLINE' && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: 'var(--booking-accent)', borderRadius: 3, padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6 }}>Trampoline</span>
                  )}
                  {s.minAge && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-text-on-dark)', background: 'var(--booking-danger)', borderRadius: 3, padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6 }}>{s.minAge}+</span>
                  )}
                </span>
                <span className="booking-calendar__day-session-status">{s.bookedCount}/{s.bookedCount + s.availableSlots}</span>
              </button>
            ))}
          </>
        )}
        renderMonthCell={(date, daySessions, isToday, isPast, isClosed) => (
          <>
            {isClosed && (
              <>
                <span className="booking-calendar__closed-label">Closed</span>
                {getClosureForDate(date)?.reason && (
                  <span className="booking-calendar__closed-reason">{getClosureForDate(date).reason}</span>
                )}
              </>
            )}
            {!isClosed && daySessions.map(s => (
              <div
                key={s.id}
                className={`booking-calendar__session booking-calendar__session--${sessionDotClass(s)}`}
                style={{ textDecoration: s.cancelledAt ? 'line-through' : 'none' }}
              >
                {s.startTime}
              </div>
            ))}
          </>
        )}
      />

      {/* Session detail modal */}
      {selectedSession && sessionDetail && (
        <div
          onClick={() => { setSelectedSession(null); setShowManualAdd(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '2rem 1rem',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--booking-bg-white)',
              borderRadius: 'var(--booking-radius-lg)',
              width: '100%', maxWidth: '560px',
              boxShadow: '0 16px 60px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <button
              onClick={() => { setSelectedSession(null); setShowManualAdd(false); }}
              style={{
                position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 1,
                background: 'var(--booking-bg-light)', border: '1px solid var(--booking-border)',
                borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: 'var(--booking-text-muted)', fontWeight: 700, lineHeight: 1,
              }}
              aria-label="Close"
            >✕</button>
            <div style={{ padding: '1.25rem' }}>
              <SessionDetailPanel
                sessionDetail={sessionDetail}
                selectedSession={selectedSession}
                showManualAdd={showManualAdd}
                setShowManualAdd={setShowManualAdd}
                onAdded={() => {
                  setShowManualAdd(false);
                  loadDetail(selectedSession);
                  handleNavigate(lastNavigatedDate.current);
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

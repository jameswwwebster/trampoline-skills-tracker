# CalendarNav Shared Component Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract calendar navigation into a shared `CalendarNav` component so `BookingCalendar` and `BookingAdmin` share identical week-first navigation, with month view available on demand.

**Architecture:** A new `CalendarNav` component owns all navigation state (selectedDate, viewMode, month picker) and renders the week strip, month picker popup, and month grid skeleton. Consumers inject view-specific content via render props. `BookingCalendar` and `BookingAdmin` are refactored to wrap `CalendarNav`.

**Tech Stack:** React 18, React Router, existing `BookingCalendar.css`

---

## Chunk 1: Create CalendarNav

### Task 1: Create `CalendarNav.js`

**Files:**
- Create: `frontend/src/pages/booking/CalendarNav.js`

> No frontend test suite exists — verify by running the dev server and eyeballing. Skip TDD steps.

- [ ] **Step 1: Create the file**

`frontend/src/pages/booking/CalendarNav.js`:

```jsx
import React, { useState, useEffect } from 'react';
import './BookingCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function defaultGetMonthCellClass(date, daySessions, isPast, isClosed) {
  if (isClosed) return 'booking-calendar__cell--closed';
  if (isPast) return 'booking-calendar__cell--past';
  if (daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt)) return 'booking-calendar__cell--available';
  if (daySessions.length > 0) return 'booking-calendar__cell--full';
  return '';
}

/**
 * Shared calendar navigation shell.
 *
 * Props:
 *   sessions            SessionInstance[]     All loaded sessions for the current period
 *   onNavigate          (date: Date) => void  Called on every selectedDate change; parent re-fetches
 *   loading?            boolean               Show loading indicator (default false)
 *   closures?           Closure[]             For closure highlighting (default [])
 *   renderDayDots       (date, daySessions, isPast, isClosed) => ReactNode
 *   renderDayPanel      (date, daySessions, isPast, isClosed) => ReactNode
 *   renderMonthCell     (date, daySessions, isToday, isPast, isClosed) => ReactNode
 *   getMonthCellClass?  (date, daySessions, isPast, isClosed) => string  (optional)
 */
export default function CalendarNav({
  sessions,
  onNavigate,
  loading = false,
  closures = [],
  renderDayDots,
  renderDayPanel,
  renderMonthCell,
  getMonthCellClass = defaultGetMonthCellClass,
}) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState('week');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  useEffect(() => {
    onNavigate(selectedDate);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekStart = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const prevWeek = () => setSelectedDate(d => { const p = new Date(d); p.setDate(p.getDate() - 7); return p; });
  const nextWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const prevMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const jumpToMonth = (y, m) => {
    setSelectedDate(new Date(y, m - 1, 1));
    setShowMonthPicker(false);
  };

  const buildWeekDays = () => {
    const ws = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const isInClosure = (date) =>
    closures.some(c => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });

  const sessionsForDate = (date) => {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    return sessions.filter(s => {
      const sd = new Date(s.date);
      return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
    });
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  // ── Month grid view ──
  if (viewMode === 'month') {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));

    return (
      <div className="booking-calendar">
        <div className="booking-calendar__header">
          <button onClick={prevMonth}>&lsaquo; Prev</button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{MONTHS[month - 1]} {year}</h2>
          <button onClick={nextMonth}>Next &rsaquo;</button>
        </div>
        <button className="booking-calendar__back-to-week" onClick={() => setViewMode('week')}>
          ← Week view
        </button>
        <div className="booking-calendar__grid">
          {DAYS.map(d => (
            <div key={d} className="booking-calendar__day-label">{d}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} className="booking-calendar__cell booking-calendar__cell--empty" />;
            const ds = sessionsForDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const isPast = date < todayMidnight;
            const isClosed = isInClosure(date);
            const extraClass = getMonthCellClass(date, ds, isPast, isClosed);
            return (
              <div
                key={date.toISOString()}
                className={['booking-calendar__cell', extraClass].filter(Boolean).join(' ')}
                onClick={() => { setSelectedDate(new Date(date)); setViewMode('week'); }}
              >
                <span className="booking-calendar__date">{date.getDate()}</span>
                {renderMonthCell(date, ds, isToday, isPast, isClosed)}
              </div>
            );
          })}
        </div>
        {loading && <p className="booking-calendar__loading">Loading…</p>}
      </div>
    );
  }

  // ── Week view ──
  const weekDays = buildWeekDays();
  const selectedMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const dayIsPast = selectedMidnight < todayMidnight;
  const daySessions = sessionsForDate(selectedDate);
  const dayIsClosed = isInClosure(selectedDate);

  return (
    <div className="booking-calendar">
      <div className="booking-calendar__header">
        <button aria-label="Previous week" onClick={prevWeek}>&#8249;</button>
        <button
          className="booking-calendar__month-btn"
          onClick={() => { setShowMonthPicker(p => !p); setPickerYear(selectedDate.getFullYear()); }}
        >
          {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()} ▾
        </button>
        <button aria-label="Next week" onClick={nextWeek}>&#8250;</button>
      </div>

      {showMonthPicker && (
        <div className="booking-calendar__month-picker">
          <div className="booking-calendar__month-picker-header">
            <button onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
            <span>{pickerYear}</span>
            <button onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
          </div>
          <div className="booking-calendar__month-picker-grid">
            {MONTH_NAMES_SHORT.map((name, idx) => (
              <button
                key={name}
                className={`booking-calendar__month-option${
                  pickerYear === selectedDate.getFullYear() && idx === selectedDate.getMonth()
                    ? ' booking-calendar__month-option--active' : ''
                }`}
                onClick={() => jumpToMonth(pickerYear, idx + 1)}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            className="booking-calendar__view-month-btn"
            onClick={() => { setShowMonthPicker(false); setViewMode('month'); }}
          >
            View full month →
          </button>
        </div>
      )}

      <div className="booking-calendar__week-strip">
        {weekDays.map(d => {
          const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const isSelected = d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          const isPast = dMidnight < todayMidnight;
          const isClosed = isInClosure(d);
          const ds = sessionsForDate(d);

          let cls = 'booking-calendar__week-day';
          if (isSelected) cls += ' booking-calendar__week-day--selected';
          if (isToday && !isSelected) cls += ' booking-calendar__week-day--today';
          if (isPast) cls += ' booking-calendar__week-day--past';

          return (
            <div key={d.toISOString()} className={cls} onClick={() => setSelectedDate(new Date(d))}>
              <span className="booking-calendar__week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
              <span className="booking-calendar__week-day-num">{d.getDate()}</span>
              <div className="booking-calendar__week-day-dots">
                {renderDayDots(d, ds, isPast, isClosed)}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="booking-calendar__day-detail"
        style={{ '--detail-arrow': `${(selectedDate.getDay() + 0.5) / 7 * 100}%` }}
      >
        {renderDayPanel(selectedDate, daySessions, dayIsPast, dayIsClosed)}
      </div>

      {loading && <p className="booking-calendar__loading">Loading…</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/booking/CalendarNav.js
git commit -m "feat: add CalendarNav shared navigation component"
```

---

## Chunk 2: Refactor BookingCalendar

### Task 2: Refactor `BookingCalendar.js` to use `CalendarNav`

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

- [ ] **Step 1: Replace `BookingCalendar.js` with the refactored version**

The refactored file keeps cart, session fetching, `SessionDetail`, and `sessionClass`/`sessionLabel`. All navigation/layout code moves into `CalendarNav` via render props.

`frontend/src/pages/booking/BookingCalendar.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import CalendarNav from './CalendarNav';
import SessionDetail from './SessionDetail';
import './BookingCalendar.css';

export default function BookingCalendar() {
  const [sessions, setSessions] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('booking-cart');
      return saved ? new Map(JSON.parse(saved)) : new Map();
    } catch { return new Map(); }
  });
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem('booking-cart', JSON.stringify([...cart]));
    window.dispatchEvent(new CustomEvent('booking-cart-update'));
  }, [cart]);

  const handleNavigate = (date) => {
    setSelectedSessionId(null);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    setLoading(true);
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
    ]).then((results) => {
      setSessions(results.slice(0, -1).flatMap(r => r.data));
      setClosures(results[results.length - 1].data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  const sessionClass = (s, isPast) => {
    if (s.isBooked) return 'booked';
    if (s.availableSlots > 0 && !s.cancelledAt && !isPast) return 'open';
    return 'full';
  };

  const sessionLabel = (s) => {
    if (s.cancelledAt) return 'Cancelled';
    if (s.isBooked) return 'Booked';
    if (s.availableSlots === 0) return 'Full';
    return `${s.availableSlots} left`;
  };

  const handleCartUpdate = (sessionId, gymnasts) => {
    setCart(prev => {
      const next = new Map(prev);
      if (gymnasts.length === 0) next.delete(sessionId);
      else next.set(sessionId, gymnasts);
      return next;
    });
  };

  const cartEntries = Array.from(cart.entries());
  const cartTotalSlots = cartEntries.reduce((sum, [, g]) => sum + g.length, 0);
  const cartTotalAmount = cartTotalSlots * 600;

  const handleCartCheckout = () => {
    const cartItems = cartEntries.map(([sessionInstanceId, gymnasts]) => {
      const session = sessions.find(s => s.id === sessionInstanceId);
      return {
        sessionInstanceId,
        date: session?.date,
        startTime: session?.startTime,
        endTime: session?.endTime,
        gymnasts,
      };
    });
    navigate('/booking/cart-checkout', { state: { cart: cartItems } });
  };

  return (
    <>
      <CalendarNav
        sessions={sessions}
        onNavigate={handleNavigate}
        loading={loading}
        closures={closures}
        renderDayDots={(date, daySessions, isPast, isClosed) => {
          if (isClosed) return null;
          return daySessions.slice(0, 3).map((s, i) => {
            const type = sessionClass(s, isPast);
            return (
              <span
                key={i}
                className={`booking-calendar__week-dot${
                  type === 'booked' ? ' booking-calendar__week-dot--booked'
                  : type === 'full' ? ' booking-calendar__week-dot--full'
                  : ''
                }`}
              />
            );
          });
        }}
        renderDayPanel={(date, daySessions, isPast, isClosed) => (
          <>
            <p className="booking-calendar__day-detail-heading">
              {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {selectedSessionId ? (
              <SessionDetail
                instanceId={selectedSessionId}
                onClose={() => setSelectedSessionId(null)}
                cartMode
                cartGymnastIds={(cart.get(selectedSessionId) || []).map(g => g.id)}
                onCartUpdate={handleCartUpdate}
              />
            ) : (
              <>
                {isClosed && <p className="booking-calendar__day-closed">Closed</p>}
                {!isClosed && daySessions.length === 0 && (
                  <p className="booking-calendar__day-empty">No sessions</p>
                )}
                {!isClosed && daySessions.map(s => (
                  <button
                    key={s.id}
                    className={`booking-calendar__day-session booking-calendar__day-session--${sessionClass(s, isPast)}`}
                    disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || isPast}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}</span>
                    <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
        renderMonthCell={(date, daySessions, isToday, isPast, isClosed) => (
          <>
            {isClosed && <span className="booking-calendar__closed-label">Closed</span>}
            {!isClosed && daySessions.map(s => (
              <div key={s.id} className={`booking-calendar__session booking-calendar__session--${sessionClass(s, isPast)}`}>
                {s.startTime}
              </div>
            ))}
          </>
        )}
        getMonthCellClass={(date, daySessions, isPast, isClosed) => {
          if (isClosed) return 'booking-calendar__cell--closed';
          if (isPast) return 'booking-calendar__cell--past';
          const hasAvailable = daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt);
          if (hasAvailable) return 'booking-calendar__cell--available';
          if (daySessions.length > 0) return 'booking-calendar__cell--full';
          return '';
        }}
      />

      {cartTotalSlots > 0 && (
        <div className="booking-calendar__cart-bar">
          <div className="booking-calendar__cart-items">
            {cartEntries.map(([sessionId, gymnasts]) => {
              const session = sessions.find(s => s.id === sessionId);
              return (
                <div key={sessionId} className="booking-calendar__cart-item">
                  <span>
                    {session
                      ? `${session.startTime}–${session.endTime}, ${new Date(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
                      : sessionId}
                    {' — '}{gymnasts.map(g => g.firstName).join(', ')}
                  </span>
                  <button
                    className="booking-calendar__cart-remove"
                    aria-label="Remove"
                    onClick={() => handleCartUpdate(sessionId, [])}
                  >×</button>
                </div>
              );
            })}
          </div>
          <div className="booking-calendar__cart-summary">
            <span>{cartTotalSlots} slot{cartTotalSlots !== 1 ? 's' : ''} · £{(cartTotalAmount / 100).toFixed(2)}</span>
            <button className="booking-calendar__cart-checkout-btn" onClick={handleCartCheckout}>
              Checkout →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Start dev server and verify member calendar**

```bash
cd frontend && npm start
```

Check:
- Opens on today's week view ✓
- Prev/next week navigation works ✓
- Month picker dropdown opens, jumping to a month works ✓
- "View full month →" shows month grid ✓
- Clicking a date in month grid returns to week view for that day ✓
- "← Week view" button works ✓
- Sessions show dots in week strip ✓
- Clicking a session opens SessionDetail ✓
- Cart bar shows / checkout works ✓
- Closure days show no dots and "Closed" in day panel ✓

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "refactor: BookingCalendar uses CalendarNav shared component"
```

---

## Chunk 3: Refactor BookingAdmin

### Task 3: Refactor `BookingAdmin.js` to use `CalendarNav`

**Files:**
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

- [ ] **Step 1: Replace `BookingAdmin.js` with the refactored version**

Key changes:
- Remove hand-rolled month grid calendar (the IIFE that builds cells, all month/year state)
- Add `CalendarNav` with admin-specific render props
- `onNavigate` fetches sessions for the week span (cross-month when needed)
- `renderDayPanel` shows session tiles; clicking one calls `handleSelect`
- `renderMonthCell` shows visual-only session tiles; clicking the cell navigates to week view (handled by CalendarNav)
- Navigating clears any open modal (`selectedSession`, `sessionDetail`, `showManualAdd`)

`frontend/src/pages/booking/admin/BookingAdmin.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import CalendarNav from '../CalendarNav';
import SessionTemplates from './SessionTemplates';
import '../booking-shared.css';
import '../BookingCalendar.css';

// ─── ManualAddForm (unchanged) ───────────────────────────────────────────────

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

// ─── SessionDetailPanel (unchanged) ─────────────────────────────────────────

const CONSENT_BADGES = [
  { type: 'photo_coaching', label: 'Coaching' },
  { type: 'photo_social_media', label: 'Social media' },
];

function SessionDetailPanel({ sessionDetail, selectedSession, showManualAdd, setShowManualAdd, onAdded }) {
  const [confirmingRemove, setConfirmingRemove] = useState(null);
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

      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%' }}
        onClick={() => setShowManualAdd(v => !v)}
      >
        {showManualAdd ? 'Cancel' : '+ Add participant manually'}
      </button>

      {showManualAdd && (
        <ManualAddForm sessionId={selectedSession} onAdded={onAdded} />
      )}
    </div>
  );
}

// ─── BookingAdmin ─────────────────────────────────────────────────────────────

export default function BookingAdmin() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const loadDetail = (id) =>
    bookingApi.getSession(id).then(res => setSessionDetail(res.data));

  useEffect(() => {
    if (selectedSession) loadDetail(selectedSession);
  }, [selectedSession]);

  const handleNavigate = (date) => {
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
    Promise.all(fetchMonths.map(({ y: fy, m: fm }) => bookingApi.getSessions(fy, fm)))
      .then(results => setSessions(results.flatMap(r => r.data)))
      .catch(console.error)
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
            {isClosed && <p className="booking-calendar__day-closed">Closed</p>}
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
                <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}</span>
                <span className="booking-calendar__day-session-status">{s.bookedCount}/{s.bookedCount + s.availableSlots}</span>
              </button>
            ))}
          </>
        )}
        renderMonthCell={(date, daySessions, isToday, isPast, isClosed) => (
          <>
            {isClosed && <span className="booking-calendar__closed-label">Closed</span>}
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
                  handleNavigate(new Date());
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Session Templates */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--booking-border)', paddingTop: '1.25rem' }}>
        <button
          onClick={() => setTemplatesOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '1rem', fontWeight: 700, color: 'var(--booking-text-on-light)',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          Session Templates
        </button>
        {templatesOpen && (
          <div style={{ marginTop: '1rem' }}>
            <SessionTemplates />
          </div>
        )}
      </div>
    </div>
  );
}
```

> **Note on `onAdded` callback:** The current `onAdded` calls `loadSessions()` to refresh the calendar after adding/removing a participant. After refactoring, we need to re-fetch sessions for the current date. The simplest approach is to call `handleNavigate(new Date())` — this re-fetches for today's week. However, this loses the currently selected week if the admin is viewing a different week. A better fix: store the last navigated date in a ref and re-fetch that. See the fix in Step 2.

- [ ] **Step 2: Fix `onAdded` to re-fetch the current week, not always today**

The `onAdded` callback in `SessionDetailPanel` needs to re-fetch sessions for whatever week the admin is currently viewing. Add a ref to track the last navigated date:

In `BookingAdmin`, add:
```jsx
const lastNavigatedDate = React.useRef(new Date());
```

Update `handleNavigate`:
```jsx
const handleNavigate = (date) => {
  lastNavigatedDate.current = date;   // ← add this line
  setSelectedSession(null);
  // ... rest unchanged
};
```

Update the `onAdded` callback in the modal:
```jsx
onAdded={() => {
  setShowManualAdd(false);
  loadDetail(selectedSession);
  handleNavigate(lastNavigatedDate.current);   // ← was new Date()
}}
```

- [ ] **Step 3: Verify admin calendar in the browser**

Check:
- Admin view defaults to week view ✓
- Prev/next week navigation works ✓
- Month picker dropdown opens ✓
- "View full month →" shows month grid ✓
- Clicking a date in month grid returns to week view for that day ✓
- Sessions appear as tiles in the day panel ✓
- Clicking a session tile opens the detail modal ✓
- Remove attendee / add participant still works ✓
- Navigating to a new week/day closes any open modal ✓
- Session Templates collapsible still works ✓

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: BookingAdmin uses CalendarNav, defaults to week view"
git push
```

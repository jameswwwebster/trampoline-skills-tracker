# Mobile Calendar Week Strip Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cramped mobile month-grid calendar with a week strip + day detail view (Option A), add a month picker for quick navigation, and colour-code sessions the user has already booked.

**Architecture:** The existing `BookingCalendar` component already fetches sessions by `year`/`month`. We add a `selectedDate` state for the day detail; the mobile view renders a 7-day week strip + session list while the desktop month grid stays unchanged. CSS `display:none` at the 520px breakpoint switches between views. The backend adds `isBooked` to every session object in the list endpoint by checking if any of the session's confirmed bookings belong to the requesting user.

**Tech Stack:** React (hooks), React Router `useNavigate`, Express/Prisma (backend), CSS custom properties from `bookingVars.css`.

---

### Task 1: Backend — add `isBooked` to sessions list

**Files:**
- Modify: `backend/routes/booking/sessions.js:37-52`

**Step 1: Open the file and locate the `result` map**

Lines 37–52 in `backend/routes/booking/sessions.js` build the array returned to the client. The `bookings` include already has `lines` but not the booking's `userId`.

**Step 2: Add `userId` to the bookings include**

Change:
```js
bookings: {
  where: { status: 'CONFIRMED' },
  include: { lines: true },
},
```
To:
```js
bookings: {
  where: { status: 'CONFIRMED' },
  select: { userId: true, lines: true },
},
```

**Step 3: Add `isBooked` to the result map**

In the `instances.map(instance => { ... })` block, after `availableSlots`, add:
```js
isBooked: instance.bookings.some(b => b.userId === req.user.id),
```

Full updated map (lines 37–53):
```js
const result = instances.map(instance => {
  const confirmedBookings = instance.bookings;
  const bookedCount = confirmedBookings.reduce((sum, b) => sum + b.lines.length, 0);
  const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
  return {
    id: instance.id,
    date: instance.date,
    startTime: instance.template.startTime,
    endTime: instance.template.endTime,
    minAge: instance.template.minAge,
    capacity,
    bookedCount,
    availableSlots: Math.max(0, capacity - bookedCount),
    cancelledAt: instance.cancelledAt,
    isBooked: instance.bookings.some(b => b.userId === req.user.id),
  };
});
```

**Step 4: Verify manually**

Start the backend locally (`cd backend && node server.js`) and hit:
```
GET http://localhost:5000/api/booking/sessions?year=2026&month=3
Authorization: Bearer <token>
```
Each session object should now include `"isBooked": true` or `"isBooked": false`.

**Step 5: Commit**
```bash
git add backend/routes/booking/sessions.js
git commit -m "feat: add isBooked flag to sessions list for current user"
```

---

### Task 2: CSS — booked session style + mobile week strip skeleton

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.css`

**Step 1: Add booked session colour** (after line 114, after `.booking-calendar__session--full`)

```css
.booking-calendar__session--booked {
  background: #1a7a4a;
  color: #fff;
  cursor: pointer;
}
```

**Step 2: Add desktop/mobile visibility classes** (after `.booking-calendar__loading`)

```css
/* Desktop: show desktop view, hide mobile view */
.booking-calendar__desktop { display: block; }
.booking-calendar__mobile  { display: none; }
```

**Step 3: Add mobile-specific styles** inside the existing `@media (max-width: 520px)` block (append before the closing `}`)

```css
  /* Switch which view is shown */
  .booking-calendar__desktop { display: none; }
  .booking-calendar__mobile  { display: block; }

  /* ── Mobile header ── */
  .booking-calendar__mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0 0.75rem;
  }

  .booking-calendar__mobile-header button {
    background: none;
    border: 1px solid var(--booking-border);
    border-radius: var(--booking-radius);
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    color: var(--booking-text-on-light);
    font-size: 1rem;
  }

  .booking-calendar__month-btn {
    background: none;
    border: none;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    color: var(--booking-text-on-light);
    padding: 0.25rem 0.5rem;
  }

  /* ── Week strip ── */
  .booking-calendar__week-strip {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
    margin-bottom: 0.75rem;
  }

  .booking-calendar__week-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.25rem;
    border-radius: var(--booking-radius);
    border: 1px solid transparent;
    cursor: pointer;
    background: var(--booking-bg-white);
    gap: 2px;
  }

  .booking-calendar__week-day--selected {
    background: var(--booking-accent-gradient);
    color: var(--booking-text-on-dark);
    border-color: transparent;
  }

  .booking-calendar__week-day--today:not(.booking-calendar__week-day--selected) {
    border-color: var(--booking-accent);
  }

  .booking-calendar__week-day--past {
    opacity: 0.45;
  }

  .booking-calendar__week-day-name {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .booking-calendar__week-day-num {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1;
  }

  /* Dots under day number to indicate sessions */
  .booking-calendar__week-day-dots {
    display: flex;
    gap: 2px;
    margin-top: 1px;
    min-height: 6px;
  }

  .booking-calendar__week-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--booking-accent);
  }

  .booking-calendar__week-dot--booked {
    background: #1a7a4a;
  }

  .booking-calendar__week-dot--full {
    background: var(--booking-border);
  }

  /* ── Day detail ── */
  .booking-calendar__day-detail {
    background: var(--booking-bg-white);
    border: 1px solid var(--booking-border);
    border-radius: var(--booking-radius-lg);
    padding: 0.75rem;
    min-height: 80px;
  }

  .booking-calendar__day-detail-heading {
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--booking-text-on-light);
  }

  .booking-calendar__day-session {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.75rem;
    border-radius: var(--booking-radius);
    margin-bottom: 0.4rem;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    font-size: 0.9rem;
  }

  .booking-calendar__day-session--open {
    background: var(--booking-accent-gradient);
    color: var(--booking-text-on-dark);
  }

  .booking-calendar__day-session--booked {
    background: #1a7a4a;
    color: #fff;
  }

  .booking-calendar__day-session--full {
    background: var(--booking-bg-light);
    color: var(--booking-text-muted);
    cursor: default;
  }

  .booking-calendar__day-session-time {
    font-weight: 700;
  }

  .booking-calendar__day-session-status {
    font-size: 0.78rem;
    opacity: 0.85;
  }

  .booking-calendar__day-closed {
    font-size: 0.82rem;
    color: var(--booking-text-muted);
    text-align: center;
    padding: 1rem 0;
  }

  .booking-calendar__day-empty {
    font-size: 0.82rem;
    color: var(--booking-text-muted);
    text-align: center;
    padding: 1rem 0;
  }

  /* ── Month picker overlay ── */
  .booking-calendar__month-picker {
    position: absolute;
    top: 3rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--booking-bg-white);
    border: 1px solid var(--booking-border);
    border-radius: var(--booking-radius-lg);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 100;
    padding: 0.75rem;
    width: 280px;
  }

  .booking-calendar__month-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .booking-calendar__month-picker-header button {
    background: none;
    border: 1px solid var(--booking-border);
    border-radius: var(--booking-radius);
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }

  .booking-calendar__month-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .booking-calendar__month-option {
    padding: 0.4rem 0;
    border: 1px solid var(--booking-border);
    border-radius: var(--booking-radius);
    background: var(--booking-bg-white);
    cursor: pointer;
    font-size: 0.8rem;
    text-align: center;
  }

  .booking-calendar__month-option--active {
    background: var(--booking-accent-gradient);
    color: var(--booking-text-on-dark);
    border-color: transparent;
  }
```

**Step 4: Make `.booking-calendar` position:relative** (needed for month picker absolute positioning)

In `.booking-calendar` (line 3), add:
```css
position: relative;
```

**Step 5: Commit**
```bash
git add frontend/src/pages/booking/BookingCalendar.css
git commit -m "style: add mobile week strip, day detail, month picker CSS"
```

---

### Task 3: Frontend — mobile view in BookingCalendar.js

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

**Step 1: Add new state variables** after line 18 (`const [loading, setLoading] = useState(false);`)

```js
// Mobile view state
const [selectedDate, setSelectedDate] = useState(today);
const [showMonthPicker, setShowMonthPicker] = useState(false);
const [pickerYear, setPickerYear] = useState(today.getFullYear());
```

**Step 2: Sync `year`/`month` when `selectedDate` changes** — add a new `useEffect` after the existing fetch effect (after line 29):

```js
// Keep year/month in sync with selectedDate (triggers data re-fetch)
useEffect(() => {
  const y = selectedDate.getFullYear();
  const m = selectedDate.getMonth() + 1;
  if (y !== year || m !== month) {
    setYear(y);
    setMonth(m);
  }
}, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 3: Add week navigation helpers** after the `nextMonth` function (after line 38):

```js
// Returns the Sunday that starts the week containing `date`
const weekStart = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
};

const prevWeek = () => {
  setSelectedDate(d => {
    const ws = weekStart(d);
    ws.setDate(ws.getDate() - 7);
    return ws;
  });
};

const nextWeek = () => {
  setSelectedDate(d => {
    const ws = weekStart(d);
    ws.setDate(ws.getDate() + 7);
    return ws;
  });
};
```

**Step 4: Add month picker helper** after `nextWeek`:

```js
const jumpToMonth = (y, m) => {
  // Jump to first day of chosen month
  setSelectedDate(new Date(y, m - 1, 1));
  setShowMonthPicker(false);
};
```

**Step 5: Add mobile week day builder** after `jumpToMonth`:

```js
// Build the 7 days of the week containing selectedDate
const buildWeekDays = () => {
  const ws = weekStart(selectedDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
};
```

**Step 6: Add `isBooked` session helper** after `sessionsForDate`:

```js
const sessionLabel = (s) => {
  if (s.cancelledAt) return 'Cancelled';
  if (s.isBooked) return 'Booked';
  if (s.availableSlots === 0) return 'Full';
  return `${s.availableSlots} left`;
};

const sessionClass = (s, isPast) => {
  if (s.isBooked) return 'booking-calendar__session--booked';
  if (s.availableSlots > 0 && !s.cancelledAt && !isPast) return 'booking-calendar__session--open';
  return 'booking-calendar__session--full';
};
```

**Step 7: Update existing desktop session buttons** to use the new `sessionClass` helper.

Find line 101:
```js
className={`booking-calendar__session ${s.availableSlots > 0 && !s.cancelledAt && !isPast ? 'booking-calendar__session--open' : 'booking-calendar__session--full'}`}
```
Replace with:
```js
className={`booking-calendar__session booking-calendar__session--${sessionClass(s, isPast).split('--')[1]}`}
```

Wait — simpler to just call the helper directly:
```js
className={`booking-calendar__session ${sessionClass(s, isPast)}`}
```

And update the `disabled` check on line 102:
```js
disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || isPast}
```
(Booked sessions should still be clickable so user can view/cancel.)

And update the text on line 105:
```js
{s.startTime} ({sessionLabel(s)})
```

**Step 8: Add the mobile JSX** — wrap the existing JSX in a desktop div, add mobile div below.

Replace the `return (` block (lines 66–116) with:

```jsx
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const weekDays = buildWeekDays();
const selectedMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
const daySessions = sessionsForDate(selectedDate);
const dayIsClosed = isInClosure(selectedDate);
const dayIsPast = selectedMidnight < todayMidnight;

const DAY_NAMES_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

return (
  <div className="booking-calendar">

    {/* ── Desktop view (≥521px) ── */}
    <div className="booking-calendar__desktop">
      <div className="booking-calendar__header">
        <button aria-label="Previous month" onClick={prevMonth}>&lsaquo; Previous</button>
        <h2>{MONTHS[month - 1]} {year}</h2>
        <button aria-label="Next month" onClick={nextMonth}>Next &rsaquo;</button>
      </div>

      <div className="booking-calendar__grid">
        {DAYS.map((d, i) => (
          <div key={d} className="booking-calendar__day-label">
            <span className="booking-calendar__day-long">{d}</span>
            <span className="booking-calendar__day-short">{DAYS_SHORT[i]}</span>
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="booking-calendar__cell booking-calendar__cell--empty" />;

          const daySessions = sessionsForDate(date);
          const closed = isInClosure(date);
          const isPast = date < todayMidnight;
          const hasAvailable = daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt);

          let cellClass = 'booking-calendar__cell';
          if (closed) cellClass += ' booking-calendar__cell--closed';
          else if (isPast) cellClass += ' booking-calendar__cell--past';
          else if (hasAvailable) cellClass += ' booking-calendar__cell--available';
          else if (daySessions.length > 0) cellClass += ' booking-calendar__cell--full';

          return (
            <div key={date.toISOString()} className={cellClass}>
              <span className="booking-calendar__date">{date.getDate()}</span>
              {!closed && daySessions.map(s => (
                <button
                  key={s.id}
                  className={`booking-calendar__session ${sessionClass(s, isPast)}`}
                  disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || isPast}
                  onClick={() => navigate(`/booking/session/${s.id}`)}
                >
                  {s.startTime} ({sessionLabel(s)})
                </button>
              ))}
              {closed && <span className="booking-calendar__closed-label">Closed</span>}
            </div>
          );
        })}
      </div>
    </div>

    {/* ── Mobile view (≤520px) ── */}
    <div className="booking-calendar__mobile">

      {/* Header: week nav + month/year */}
      <div className="booking-calendar__mobile-header">
        <button aria-label="Previous week" onClick={prevWeek}>&#8249;</button>
        <button
          className="booking-calendar__month-btn"
          onClick={() => { setShowMonthPicker(p => !p); setPickerYear(selectedDate.getFullYear()); }}
        >
          {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()} ▾
        </button>
        <button aria-label="Next week" onClick={nextWeek}>&#8250;</button>
      </div>

      {/* Month picker overlay */}
      {showMonthPicker && (
        <div className="booking-calendar__month-picker">
          <div className="booking-calendar__month-picker-header">
            <button onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
            <span>{pickerYear}</span>
            <button onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
          </div>
          <div className="booking-calendar__month-grid">
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
        </div>
      )}

      {/* Week strip */}
      <div className="booking-calendar__week-strip">
        {weekDays.map(d => {
          const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const isSelected = d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          const isPast = dMidnight < todayMidnight;
          const ds = sessionsForDate(d);
          const closed = isInClosure(d);

          let cls = 'booking-calendar__week-day';
          if (isSelected) cls += ' booking-calendar__week-day--selected';
          if (isToday && !isSelected) cls += ' booking-calendar__week-day--today';
          if (isPast) cls += ' booking-calendar__week-day--past';

          // Up to 3 dots per day
          const dots = closed ? [] : ds.slice(0, 3).map(s => {
            if (s.isBooked) return 'booked';
            if (s.availableSlots > 0 && !s.cancelledAt) return 'open';
            return 'full';
          });

          return (
            <div key={d.toISOString()} className={cls} onClick={() => setSelectedDate(new Date(d))}>
              <span className="booking-calendar__week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
              <span className="booking-calendar__week-day-num">{d.getDate()}</span>
              <div className="booking-calendar__week-day-dots">
                {dots.map((type, i) => (
                  <span key={i} className={`booking-calendar__week-dot booking-calendar__week-dot--${type === 'open' ? '' : type}${type === 'open' ? '' : ''}`}
                    style={type === 'open' ? {} : type === 'booked' ? { background: '#1a7a4a' } : { background: 'var(--booking-border)' }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day detail */}
      <div className="booking-calendar__day-detail">
        <p className="booking-calendar__day-detail-heading">
          {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {dayIsClosed && (
          <p className="booking-calendar__day-closed">Closed</p>
        )}
        {!dayIsClosed && daySessions.length === 0 && (
          <p className="booking-calendar__day-empty">No sessions</p>
        )}
        {!dayIsClosed && daySessions.map(s => (
          <button
            key={s.id}
            className={`booking-calendar__day-session booking-calendar__day-session--${sessionClass(s, dayIsPast).split('--')[1]}`}
            disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || dayIsPast}
            onClick={() => navigate(`/booking/session/${s.id}`)}
          >
            <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}</span>
            <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
          </button>
        ))}
      </div>
    </div>

    {loading && <p className="booking-calendar__loading">Loading…</p>}
  </div>
);
```

**Step 9: Verify in browser**

On desktop (wide window):
- Month grid should look identical to before
- Booked sessions should show dark green

On mobile (narrow window ≤520px or Chrome DevTools device mode):
- Week strip shows 7 days; selected day is highlighted in purple gradient
- Today has a purple border (when not selected)
- Dots appear under days with sessions
- Tapping a day updates the detail panel below
- Left/right arrows navigate week by week
- Tapping "March 2026 ▾" opens a 3×4 month grid overlay
- Selecting a month closes the picker and jumps to week 1 of that month

**Step 10: Commit**
```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "feat: mobile week strip calendar with day detail and month picker"
```

---

### Task 4: Polish — dot rendering cleanup

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js` (dots section from Task 3)

The dot rendering in Task 3 uses inline styles which is a bit messy. Clean up the dots to use proper CSS classes:

**Step 1: Replace the dot span with:**
```jsx
{dots.map((type, i) => (
  <span
    key={i}
    className={`booking-calendar__week-dot${
      type === 'booked' ? ' booking-calendar__week-dot--booked'
      : type === 'full' ? ' booking-calendar__week-dot--full'
      : ''
    }`}
  />
))}
```

Remove the inline `style` props from the dot spans.

**Step 2: Ensure the CSS already has these classes** (added in Task 2):
- `.booking-calendar__week-dot` — accent colour (open)
- `.booking-calendar__week-dot--booked` — `#1a7a4a`
- `.booking-calendar__week-dot--full` — `var(--booking-border)`

**Step 3: Commit**
```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "refactor: clean up week dot rendering to use CSS classes"
```

---

### Task 5: Booked colour on desktop month grid — mobile dot update

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.css`

**Step 1: Add mobile dot booked style** (inside `@media (max-width: 520px)`, after the `::after` pseudo-element block)

The old mobile dot used `::after` on `.booking-calendar__session`. That's now replaced by the week-day dots in the mobile view. But the old mobile session styles (`font-size: 0px`) can be kept as a fallback on any remaining usage or simply left as dead code.

No action needed — the old `.booking-calendar__session` mobile styles only apply to the desktop grid (which is `display:none` on mobile after this change).

**Step 2: Verify desktop booked style works**

On desktop, a session where `isBooked: true` should render with `booking-calendar__session--booked` (dark green background, white text). Confirm this looks correct.

**Step 3: Commit (if any CSS changes made)**
```bash
git add frontend/src/pages/booking/BookingCalendar.css
git commit -m "style: verify booked session appearance on desktop"
```

---

## Testing Checklist

- [ ] `GET /api/booking/sessions` returns `isBooked: true` for sessions where the user has a confirmed booking
- [ ] Desktop calendar: booked sessions show dark green
- [ ] Mobile (≤520px): month grid is hidden, week strip is shown
- [ ] Week strip: selected day highlighted, today has border indicator
- [ ] Week strip dots: green = booked, purple = open, grey = full
- [ ] Tapping a day updates the day detail panel
- [ ] Day detail: booked sessions show dark green with "Booked" label
- [ ] Day detail: open sessions show purple with "X left" label
- [ ] Day detail: full sessions show grey and are non-clickable
- [ ] Tapping a session navigates to SessionDetail
- [ ] Week prev/next arrows navigate 7 days at a time
- [ ] Crossing a month boundary triggers a data re-fetch
- [ ] Month picker opens on tap of "Month Year ▾" heading
- [ ] Month picker shows correct year with prev/next year arrows
- [ ] Selecting a month closes picker and jumps to first week of that month
- [ ] Loading indicator shows while fetching

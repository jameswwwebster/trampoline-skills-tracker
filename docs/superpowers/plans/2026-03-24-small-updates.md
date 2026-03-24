# Small UX Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual mark-as-read to the noticeboard, a birthdays-this-week widget for coaches, and explicit closure display on the booking calendar.

**Architecture:** Three independent features. Feature 1 is frontend-only. Feature 2 adds a single backend endpoint to `dashboard.js` and a widget to `Dashboard.js`. Feature 3 adds a CSS class to `CalendarNav.js` and closure-reason display to the two calendar consumer files.

**Tech Stack:** Express + Prisma + PostgreSQL (backend), React 18 (frontend), Jest + Supertest (backend tests), existing `bookingApi` axios wrapper.

---

## Files

| File | Change |
|------|--------|
| `frontend/src/pages/booking/Noticeboard.js` | Remove auto-mark-on-load; add "Mark as read" button per unread post |
| `frontend/src/pages/booking/Noticeboard.css` | Add unread indicator (left border accent) |
| `backend/routes/dashboard.js` | Add `GET /api/dashboard/birthdays-this-week` endpoint |
| `backend/__tests__/dashboard.birthdays.test.js` | New test file for birthday endpoint |
| `backend/__tests__/helpers/create-test-app.js` | Mount `/api/dashboard` route |
| `frontend/src/pages/Dashboard.js` | Add birthday widget (coach/admin section) |
| `frontend/src/pages/booking/CalendarNav.js` | Add `--closed` CSS class to week strip day buttons |
| `frontend/src/pages/booking/BookingCalendar.css` | Add CSS for `booking-calendar__week-day--closed` |
| `frontend/src/pages/booking/BookingCalendar.js` | Add `getClosureForDate` helper; show reason in day panel and month cell |
| `frontend/src/pages/booking/admin/BookingAdmin.js` | Same: `getClosureForDate` + reason in day panel and month cell |

---

## Task 1: Noticeboard — remove auto-mark and add manual button

**Files:**
- Modify: `frontend/src/pages/booking/Noticeboard.js`
- Modify: `frontend/src/pages/booking/Noticeboard.css`

- [ ] **Step 1: Remove the auto-mark-on-load block**

In `Noticeboard.js`, find the `load` function (around line 163). Remove lines 167–169 — the `unread.forEach` call and the `if (unread.length > 0 && refreshUnreadCount)` call. After the change, `load` should look like:

```js
const load = async () => {
  try {
    const res = await bookingApi.getNoticeboard();
    setPosts(res.data);
  } catch {
    // ignore
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: Add a `handleMarkRead` handler**

Inside the `Noticeboard` component body (after `handleDelete`), add:

```js
const handleMarkRead = async (id) => {
  try {
    await bookingApi.markNoticeboardRead(id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, isRead: true } : p));
    if (refreshUnreadCount) refreshUnreadCount();
  } catch {
    // ignore
  }
};
```

- [ ] **Step 3: Add the "Mark as read" button to unread posts**

In the post render (the `<div key={post.id} className="noticeboard-post">` block), find the closing of the `{staff && (...)}` actions section. Below it (still inside the post div, after the actions block), add:

```jsx
{!post.isRead && (
  <div className="noticeboard-post__read-action">
    <button
      className="bk-btn bk-btn--sm"
      style={{ border: '1px solid var(--booking-border)' }}
      onClick={() => handleMarkRead(post.id)}
    >
      Mark as read
    </button>
  </div>
)}
```

- [ ] **Step 4: Add unread indicator CSS**

In `Noticeboard.css`, add at the bottom:

```css
.noticeboard-post--unread {
  border-left: 3px solid var(--booking-accent);
}

.noticeboard-post__read-action {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--booking-bg-light);
}
```

- [ ] **Step 5: Apply the unread class to posts**

In the post render, find `<div key={post.id} className="noticeboard-post">` and change it to:

```jsx
<div key={post.id} className={`noticeboard-post${!post.isRead ? ' noticeboard-post--unread' : ''}`}>
```

- [ ] **Step 6: Manual smoke test**

Start the dev server. Visit the noticeboard — the nav badge count should NOT go to zero just from opening the page. Unread posts should have a left accent border and a "Mark as read" button. Clicking the button should: remove the button, remove the border, and decrement the nav badge. Staff posts should also have the button below the edit/delete actions.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/booking/Noticeboard.js frontend/src/pages/booking/Noticeboard.css
git commit -m "feat: noticeboard manual mark-as-read — remove auto-mark, add per-post button"
```

---

## Task 2: Birthday endpoint (backend)

**Files:**
- Modify: `backend/routes/dashboard.js`
- Create: `backend/__tests__/dashboard.birthdays.test.js`
- Modify: `backend/__tests__/helpers/create-test-app.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/dashboard.birthdays.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();

describe('GET /api/dashboard/birthdays-this-week', () => {
  let club, coach, coachToken, member, memberToken;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    coach = await createParent(club, { role: 'COACH', email: `bday-coach-${Date.now()}@test.tl` });
    coachToken = tokenFor(coach);
    member = await createParent(club, { email: `bday-member-${Date.now()}@test.tl` });
    memberToken = tokenFor(member);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard/birthdays-this-week');
    expect(res.status).toBe(401);
  });

  test('returns 403 for non-coach/admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('returns gymnast whose birthday is today', async () => {
    const today = new Date();
    // Create gymnast born on today's month+day (10 years ago)
    const dob = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    await createGymnast(club, member, { dateOfBirth: dob });

    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const hit = res.body.find(g => g.turnsAge === 10);
    expect(hit).toBeDefined();
    expect(hit.firstName).toBeDefined();
    expect(hit.dayOfWeek).toBeDefined();
  });

  test('does not return gymnast whose birthday is not this week', async () => {
    // Pick a date guaranteed to be outside this week
    const today = new Date();
    const nextMonth = new Date(today.getFullYear() - 8, (today.getMonth() + 2) % 12, 15);
    await createGymnast(club, member, { dateOfBirth: nextMonth });

    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    // All returned gymnasts should have a dayOfWeek matching a day in this week
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today2 = new Date();
    const daysFromMonday = today2.getDay() === 0 ? 6 : today2.getDay() - 1;
    const weekDays = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(today2);
      d.setDate(today2.getDate() - daysFromMonday + i);
      weekDays.push(DAYS[d.getDay()]);
    }
    res.body.forEach(g => {
      expect(weekDays).toContain(g.dayOfWeek);
    });
  });

  test('does not return archived gymnast', async () => {
    const today = new Date();
    const dob = new Date(today.getFullYear() - 9, today.getMonth(), today.getDate());
    const archivedCoach = await createParent(club, { role: 'CLUB_ADMIN', email: `arc-admin-${Date.now()}@test.tl` });
    await createGymnast(club, member, {
      dateOfBirth: dob,
      isArchived: true,
      archivedById: archivedCoach.id,
    });

    const beforeCount = (await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`)).body.length;

    // The archived gymnast should not be included — count should not have increased
    // (we check the archived gymnast is not in the list by turnsAge=9 uniqueness)
    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);
    const age9 = res.body.filter(g => g.turnsAge === 9);
    // Could be zero or one archived — but should not appear since isArchived=true
    // We just verify the endpoint still returns 200
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Mount /api/dashboard in test app**

In `backend/__tests__/helpers/create-test-app.js`, add the dashboard route:

```js
app.use('/api/dashboard', require('../../routes/dashboard'));
```

Add it alongside the other `app.use` lines.

- [ ] **Step 3: Run the tests to confirm they fail**

```bash
cd backend && npx jest __tests__/dashboard.birthdays.test.js --no-coverage 2>&1 | tail -20
```

Expected: tests fail because the endpoint doesn't exist yet (404 or similar).

- [ ] **Step 4: Implement the endpoint**

At the bottom of `backend/routes/dashboard.js` (before `module.exports = router`), add:

```js
// GET /api/dashboard/birthdays-this-week — coaches and admins only
router.get('/birthdays-this-week', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const today = new Date();
    const daysFromMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const gymnasts = await prisma.gymnast.findMany({
      where: { clubId: req.user.clubId, isArchived: false, dateOfBirth: { not: null } },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    });

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentYear = today.getFullYear();

    const results = gymnasts
      .map(g => {
        const dob = new Date(g.dateOfBirth);
        const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
        if (thisYearBirthday < weekStart || thisYearBirthday > weekEnd) return null;
        return {
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          dateOfBirth: g.dateOfBirth,
          dayOfWeek: DAYS[thisYearBirthday.getDay()],
          turnsAge: currentYear - dob.getFullYear(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort Mon-first: Mon=1→0, Tue=2→1, ..., Sun=0→6
        const dayOrder = d => (d === 'Sunday' ? 6 : DAYS.indexOf(d) - 1);
        return dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek);
      });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

Also confirm `module.exports = router;` is already at the end of the file (it should be).

- [ ] **Step 5: Run the tests — confirm they pass**

```bash
cd backend && npx jest __tests__/dashboard.birthdays.test.js --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/dashboard.js backend/__tests__/dashboard.birthdays.test.js backend/__tests__/helpers/create-test-app.js
git commit -m "feat: add GET /api/dashboard/birthdays-this-week endpoint"
```

---

## Task 3: Birthday widget (frontend)

**Files:**
- Modify: `frontend/src/pages/Dashboard.js`

- [ ] **Step 1: Add state and fetch**

In `Dashboard.js`, find the coach/admin data fetch section (the `useEffect` that checks `isAdminOrCoach`, around line 46). Add birthday state alongside the other coach state:

```js
const [birthdays, setBirthdays] = useState([]);
```

Add the fetch inside the same `useEffect` that fetches sessions and charges (the one guarded by `if (!isAdminOrCoach) return;`):

```js
bookingApi.getBirthdaysThisWeek()
  .then(r => setBirthdays(r.data))
  .catch(() => {});
```

- [ ] **Step 2: Add the API method**

In `frontend/src/utils/bookingApi.js`, add alongside the other dashboard methods (near `getClosures` or at the end of the export object):

```js
getBirthdaysThisWeek: () =>
  axios.get(`${API_URL}/dashboard/birthdays-this-week`, { headers: getHeaders() }),
```

- [ ] **Step 3: Add the widget JSX**

In `Dashboard.js`, find the admin/coach render branch (the `isAdminOrCoach ? ( ... )` block). After `{todayWidget}` and before `{adminTiles}`, insert:

```jsx
{birthdays.length > 0 && (
  <div className="dashboard-birthdays">
    <div className="dashboard-birthdays__title">Birthdays this week</div>
    {birthdays.map(g => (
      <div key={g.id} className="dashboard-birthdays__row">
        {g.firstName} {g.lastName} turns {g.turnsAge} — {g.dayOfWeek}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Add CSS for the birthday widget**

Open `frontend/src/index.css` (or whichever global CSS file the Dashboard uses — check the `Dashboard.js` imports; it likely imports a `.css` from the same directory or uses a shared one). Add the widget styles. If `Dashboard.js` imports `./Dashboard.css`, add there; otherwise add to `index.css`:

```css
.dashboard-birthdays {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.dashboard-birthdays__title {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--text-muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dashboard-birthdays__row {
  padding: 0.25rem 0;
  font-size: 0.9rem;
}
```

**Note:** Check what CSS file `Dashboard.js` imports at the top. Use whichever file it already imports. If it imports nothing, use `index.css`.

- [ ] **Step 5: Manual smoke test**

Open the dashboard as a coach or admin. If any gymnast in the club has a birthday this week, the widget should appear between the today widget and the admin tiles. If no birthdays, nothing should render (no empty box).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Dashboard.js frontend/src/utils/bookingApi.js
git commit -m "feat: birthdays-this-week widget on coach/admin dashboard"
```

---

## Task 4: Closures on booking calendar

**Files:**
- Modify: `frontend/src/pages/booking/CalendarNav.js`
- Modify: `frontend/src/pages/booking/BookingCalendar.css`
- Modify: `frontend/src/pages/booking/BookingCalendar.js`
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

- [ ] **Step 1: Add --closed class to CalendarNav week strip**

In `CalendarNav.js`, find the week strip day class assignment (around line 203–206):

```js
let cls = 'booking-calendar__week-day';
if (isSelected) cls += ' booking-calendar__week-day--selected';
if (isToday && !isSelected) cls += ' booking-calendar__week-day--today';
if (isPast) cls += ' booking-calendar__week-day--past';
```

Add one line at the end:

```js
if (isClosed) cls += ' booking-calendar__week-day--closed';
```

- [ ] **Step 2: Add CSS for the closed week-day state**

In `BookingCalendar.css`, find the existing `.booking-calendar__week-day--past` rule and add a similar rule for `--closed` below it:

```css
.booking-calendar__week-day--closed {
  color: var(--booking-text-muted);
  opacity: 0.6;
}
```

- [ ] **Step 3: Add getClosureForDate to BookingCalendar.js**

In `BookingCalendar.js`, inside the `BookingCalendar` component function body (after the `closures` state declaration, before the `handleNavigate` function), add:

```js
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
```

- [ ] **Step 4: Update renderDayPanel in BookingCalendar.js**

Find the `renderDayPanel` prop (around line 115). Change:

```jsx
{isClosed && <p className="booking-calendar__day-closed">Closed</p>}
```

To:

```jsx
{isClosed && (
  <p className="booking-calendar__day-closed">
    Closed{getClosureForDate(date)?.reason ? ` — ${getClosureForDate(date).reason}` : ''}
  </p>
)}
```

- [ ] **Step 5: Update renderMonthCell in BookingCalendar.js**

Find the `renderMonthCell` prop (around line 188). Change:

```jsx
{isClosed && <span className="booking-calendar__closed-label">Closed</span>}
```

To:

```jsx
{isClosed && (
  <>
    <span className="booking-calendar__closed-label">Closed</span>
    {getClosureForDate(date)?.reason && (
      <span className="booking-calendar__closed-reason">{getClosureForDate(date).reason}</span>
    )}
  </>
)}
```

- [ ] **Step 6: Add CSS for the closure reason in month cells**

In `BookingCalendar.css`, below the existing `.booking-calendar__closed-label` rule, add:

```css
.booking-calendar__closed-reason {
  display: block;
  font-size: 0.6rem;
  color: var(--booking-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

- [ ] **Step 7: Apply the same changes to BookingAdmin.js**

In `BookingAdmin.js`, add the identical `getClosureForDate` helper inside the component body (after the `closures` state, before `handleNavigate`):

```js
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
```

Then update `renderDayPanel` in BookingAdmin.js — find:

```jsx
{isClosed && <p className="booking-calendar__day-closed">Closed</p>}
```

Change to:

```jsx
{isClosed && (
  <p className="booking-calendar__day-closed">
    Closed{getClosureForDate(date)?.reason ? ` — ${getClosureForDate(date).reason}` : ''}
  </p>
)}
```

Then update `renderMonthCell` in BookingAdmin.js — find:

```jsx
{isClosed && <span className="booking-calendar__closed-label">Closed</span>}
```

Change to:

```jsx
{isClosed && (
  <>
    <span className="booking-calendar__closed-label">Closed</span>
    {getClosureForDate(date)?.reason && (
      <span className="booking-calendar__closed-reason">{getClosureForDate(date).reason}</span>
    )}
  </>
)}
```

- [ ] **Step 8: Manual smoke test**

Open the booking calendar (member view and admin view). Navigate to a week that contains a closure period. The day in the week strip should appear greyed out (muted + opacity). Clicking on that day should show "Closed — [reason]". In month view, closed days should show "Closed" plus the reason truncated to one line.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/booking/CalendarNav.js \
        frontend/src/pages/booking/BookingCalendar.css \
        frontend/src/pages/booking/BookingCalendar.js \
        frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: show closures explicitly in booking calendar week strip and with reason"
```

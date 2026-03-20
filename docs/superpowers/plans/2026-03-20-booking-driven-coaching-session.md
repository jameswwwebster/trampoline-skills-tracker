# Booking-Driven Coaching Session Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual localStorage coaching session in `Gymnasts.js` with a dropdown that auto-populates attendees from the booking attendance API.

**Architecture:** All changes are in one file (`Gymnasts.js`). Add three new state variables (`todaySessions`, `selectedSessionId`, `sessionLoading`), fetch today's sessions on mount via `bookingApi.getSessions`, populate `sessionGymnasts` from `bookingApi.getAttendance` on dropdown selection, and remove the manual toggle/localStorage plumbing entirely.

**Tech Stack:** React 18, `bookingApi` (axios wrapper at `frontend/src/utils/bookingApi.js`), existing App.css classes.

---

## File Structure

- **Modify:** `frontend/src/pages/Gymnasts.js` — all changes live here
- **Modify:** `frontend/src/App.css` — remove dead `.session-toggle-btn` styles, keep `.skill-tracker-card.in-session`

---

## Chunk 1: State, data fetching, handlers

### Task 1: Replace coaching session state and add API-driven session fetch

**Files:**
- Modify: `frontend/src/pages/Gymnasts.js:1-56` (state declarations + toggleGymnastInSession)

**Context:**

Current state (lines 19–21):
```js
const [sessionGymnasts, setSessionGymnasts] = useState(new Set());
const [sessionTimestamps, setSessionTimestamps] = useState(new Map());
const [showSessionOnly, setShowSessionOnly] = useState(false);
```

Current auth destructure (line 26):
```js
const { isClubAdmin } = useAuth();
```

Current `bookingApi` is NOT imported. It lives at `frontend/src/utils/bookingApi.js` and has these methods used here:
- `bookingApi.getSessions(year, month)` → returns `{ data: Session[] }` where each Session has `{ id, date, startTime, endTime, type }`
- `bookingApi.getAttendance(instanceId)` → returns `{ data: { session, attendees: [{ gymnastId, firstName, lastName, status }] } }`

- [ ] **Step 1: Add bookingApi import**

At line 4 (after the `useAuth` import), add:
```js
import bookingApi from '../utils/bookingApi';
```

- [ ] **Step 2: Add `canManageGymnasts` to the useAuth destructure**

Change line 26 from:
```js
const { isClubAdmin } = useAuth();
```
to:
```js
const { isClubAdmin, canManageGymnasts } = useAuth();
```

- [ ] **Step 3: Replace `sessionTimestamps` state with the three new state variables**

Change lines 19–21 from:
```js
const [sessionGymnasts, setSessionGymnasts] = useState(new Set());
const [sessionTimestamps, setSessionTimestamps] = useState(new Map());
const [showSessionOnly, setShowSessionOnly] = useState(false);
```
to:
```js
const [sessionGymnasts, setSessionGymnasts] = useState(new Set());
const [showSessionOnly, setShowSessionOnly] = useState(false);
const [todaySessions, setTodaySessions] = useState([]);
const [selectedSessionId, setSelectedSessionId] = useState(null);
const [sessionLoading, setSessionLoading] = useState(false);
```

- [ ] **Step 4: Delete the `toggleGymnastInSession` function**

Remove lines 35–56 entirely:
```js
// Session management functions
const toggleGymnastInSession = (gymnastId) => {
  ...
};
```

- [ ] **Step 5: Update the localStorage load effect (lines 59–98)**

The effect currently loads `coachingSession`, `sessionTimestamps`, and `showSessionOnly` from localStorage. Remove those three blocks. Keep `savedSortBy`, `savedShowArchived`, and `savedSearchTerm`.

Change from:
```js
useEffect(() => {
  const savedSession = localStorage.getItem('coachingSession');
  if (savedSession) {
    try {
      setSessionGymnasts(new Set(JSON.parse(savedSession)));
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }

  const savedTimestamps = localStorage.getItem('sessionTimestamps');
  if (savedTimestamps) {
    try {
      setSessionTimestamps(new Map(JSON.parse(savedTimestamps)));
    } catch (e) {
      console.error('Failed to load session timestamps:', e);
    }
  }

  // Load saved preferences
  const savedSortBy = localStorage.getItem('gymnastSortBy');
  if (savedSortBy) {
    setSortBy(savedSortBy);
  }

  const savedShowArchived = localStorage.getItem('gymnastShowArchived');
  if (savedShowArchived) {
    setShowArchived(savedShowArchived === 'true');
  }

  const savedShowSessionOnly = localStorage.getItem('gymnastShowSessionOnly');
  if (savedShowSessionOnly) {
    setShowSessionOnly(savedShowSessionOnly === 'true');
  }

  const savedSearchTerm = localStorage.getItem('gymnastSearchTerm');
  if (savedSearchTerm) {
    setSearchTerm(savedSearchTerm);
  }
}, []);
```
to:
```js
useEffect(() => {
  const savedSortBy = localStorage.getItem('gymnastSortBy');
  if (savedSortBy) setSortBy(savedSortBy);

  const savedShowArchived = localStorage.getItem('gymnastShowArchived');
  if (savedShowArchived) setShowArchived(savedShowArchived === 'true');

  const savedSearchTerm = localStorage.getItem('gymnastSearchTerm');
  if (savedSearchTerm) setSearchTerm(savedSearchTerm);
}, []);
```

- [ ] **Step 6: Remove the `showSessionOnly` localStorage persistence effect**

Delete this effect (currently around line 109–111):
```js
useEffect(() => {
  localStorage.setItem('gymnastShowSessionOnly', showSessionOnly.toString());
}, [showSessionOnly]);
```

- [ ] **Step 7: Add the today's sessions fetch effect**

Add this new effect after the existing preference persistence effects:
```js
useEffect(() => {
  if (!canManageGymnasts) return;
  const now = new Date();
  bookingApi.getSessions(now.getFullYear(), now.getMonth() + 1)
    .then(res => {
      const todayStr = now.toISOString().split('T')[0];
      const sessions = res.data.filter(s =>
        new Date(s.date).toISOString().split('T')[0] === todayStr
      );
      setTodaySessions(sessions);
    })
    .catch(() => {
      // Silently fail — dropdown renders as disabled
    });
}, [canManageGymnasts]);
```

- [ ] **Step 8: Add the `handleSessionSelect` handler**

Add this function after the localStorage fetch effect (alongside other handlers):
```js
const handleSessionSelect = async (sessionId) => {
  if (!sessionId) {
    setSelectedSessionId(null);
    setSessionGymnasts(new Set());
    return;
  }
  setSelectedSessionId(sessionId);
  setSessionLoading(true);
  try {
    const res = await bookingApi.getAttendance(sessionId);
    setSessionGymnasts(new Set(res.data.attendees.map(a => a.gymnastId)));
  } catch (err) {
    setError('Failed to load session attendees. Please try again.');
    setSelectedSessionId(null);
    // Per spec: keep the previous sessionGymnasts set unchanged on failure
  } finally {
    setSessionLoading(false);
  }
};
```

- [ ] **Step 9: Fix the 'recent' sort case**

The `sortBy === 'recent'` case (around line 325) currently relies on `sessionTimestamps`. Remove that logic; leave only the `updatedAt`/`createdAt` fallback:

Change from:
```js
case 'recent':
  // Sort by most recent session activity
  const timestampA = sessionTimestamps.get(a.id);
  const timestampB = sessionTimestamps.get(b.id);

  // If both have session timestamps, sort by most recent session activity
  if (timestampA && timestampB) {
    return new Date(timestampB) - new Date(timestampA);
  }

  // If only one has a session timestamp, prioritize it
  if (timestampA && !timestampB) return -1;
  if (!timestampA && timestampB) return 1;

  // If neither has session timestamps, fall back to last updated/created date
  const dateA = new Date(a.updatedAt || a.createdAt);
  const dateB = new Date(b.updatedAt || b.createdAt);
  return dateB - dateA; // Most recent first
```
to:
```js
case 'recent':
  const dateA = new Date(a.updatedAt || a.createdAt);
  const dateB = new Date(b.updatedAt || b.createdAt);
  return dateB - dateA;
```

- [ ] **Step 10: Verify no references to `toggleGymnastInSession` or `sessionTimestamps` remain**

Run:
```bash
grep -n "toggleGymnastInSession\|sessionTimestamps" frontend/src/pages/Gymnasts.js
```
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/Gymnasts.js
git commit -m "refactor: replace localStorage coaching session state with booking API state"
```

---

## Chunk 2: UI — filter bar + table + mobile cards

### Task 2: Update the UI to use the session dropdown and read-only indicators

**Files:**
- Modify: `frontend/src/pages/Gymnasts.js:488–813` (filter bar, desktop table, mobile cards)
- Modify: `frontend/src/App.css` (remove session toggle button styles)

**Context:**

The filter bar lives inside `<div className="gymnasts-filter-bar">` (around line 490). It currently ends with a conditional "Session (N)" / "Show All" toggle button.

The desktop table's Session column (around lines 713–720) currently renders:
```jsx
<td>
  <button
    className={`session-toggle-btn${sessionGymnasts.has(gymnast.id) ? ' in-session' : ''}`}
    onClick={(e) => { e.stopPropagation(); toggleGymnastInSession(gymnast.id); }}
    title={sessionGymnasts.has(gymnast.id) ? 'Remove from session' : 'Add to session'}
  >
    {sessionGymnasts.has(gymnast.id) ? '✓' : '+'}
  </button>
</td>
```

The mobile card (around lines 730–758) currently includes a session toggle button and uses `isInSession` for the card class.

- [ ] **Step 1: Add session dropdown to the filter bar**

Inside `<div className="gymnasts-filter-bar">`, add the session dropdown immediately before the existing `{sessionGymnasts.size > 0 && ...}` button. Wrap it in a `canManageGymnasts` guard:

```jsx
{canManageGymnasts && (
  <select
    className="form-control gymnasts-filter-select"
    value={selectedSessionId || ''}
    onChange={(e) => handleSessionSelect(e.target.value || null)}
    disabled={todaySessions.length === 0 || sessionLoading}
  >
    <option value="">
      {todaySessions.length === 0 ? 'No sessions today' : 'No session'}
    </option>
    {todaySessions.map(s => (
      <option key={s.id} value={s.id}>
        {s.startTime}–{s.endTime} · {s.type.charAt(0) + s.type.slice(1).toLowerCase()}
      </option>
    ))}
  </select>
)}
```

- [ ] **Step 2: Update the desktop table Session column**

Replace the toggle button in the Session `<td>` with a read-only checkmark badge:

```jsx
<td>
  {sessionGymnasts.has(gymnast.id) && (
    <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>✓</span>
  )}
</td>
```

- [ ] **Step 3: Remove the session toggle button from mobile cards**

In the mobile card section (around lines 749–758), delete the session toggle `<button>` entirely:
```jsx
// DELETE this entire button:
<button
  className={`session-toggle-btn ${isInSession ? 'in-session' : ''}`}
  onClick={(e) => {
    e.stopPropagation();
    toggleGymnastInSession(gymnast.id);
  }}
  title={isInSession ? 'Remove from session' : 'Add to session'}
>
  {isInSession ? '✓' : '+'}
</button>
```

Keep the `isInSession` variable and the `skill-tracker-card.in-session` class on the card div — mobile cards still highlight when the gymnast is in the selected session.

- [ ] **Step 4: Update both "Clear All Filters" button handlers**

There are two identical "Clear All Filters" `onClick` handlers (around lines 626–634 and 1052–1060). Both currently look like this (find by the `localStorage.removeItem('coachingSession')` call):

```jsx
onClick={() => {
  setSearchTerm('');
  setShowSessionOnly(false);
  setSearchParams(new URLSearchParams());
  setSessionGymnasts(new Set());
  setSessionTimestamps(new Map());
  localStorage.removeItem('coachingSession');
  localStorage.removeItem('sessionTimestamps');
}}
```

Replace both occurrences with:

```jsx
onClick={() => {
  setSearchTerm('');
  setShowSessionOnly(false);
  setSelectedSessionId(null);
  setSessionGymnasts(new Set());
  setSearchParams(new URLSearchParams());
}}
```

- [ ] **Step 5: Remove dead `.session-toggle-btn` CSS**

In `frontend/src/App.css`, find and delete the three dead rules (around lines 1348–1378):
```css
.session-toggle-btn { ... }
.session-toggle-btn:hover { ... }
.session-toggle-btn.in-session { ... }
```

Keep `.skill-tracker-card.in-session` — it's still used for mobile card highlighting.

- [ ] **Step 6: Verify no references to `toggleGymnastInSession`, `sessionTimestamps`, `coachingSession` localStorage remain**

```bash
grep -n "toggleGymnastInSession\|sessionTimestamps\|coachingSession\|session-toggle-btn" frontend/src/pages/Gymnasts.js frontend/src/App.css
```
Expected: no output.

- [ ] **Step 7: Manual smoke test**

Start the frontend dev server and open the Gymnasts page as a coach/admin:
- Dropdown renders in the filter bar
- If no sessions today: dropdown is disabled showing "No sessions today"
- If sessions exist: selecting one highlights matching gymnasts with ✓ in the Session column and `in-session` styling on mobile cards
- "Session (N)" / "Show All" toggle appears when a session is selected
- "Clear All Filters" clears the selection

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Gymnasts.js frontend/src/App.css
git commit -m "feat: booking-driven coaching session — dropdown + read-only session indicators"
```

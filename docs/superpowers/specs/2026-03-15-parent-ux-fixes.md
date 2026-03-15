# Parent UX Fixes

**Date:** 2026-03-15

## Goal

Three small fixes based on parent feedback: prevent double-booking the same gymnast into a session, make spaces remaining more prominent on the calendar, and allow parents (and admins) to edit a gymnast's health notes.

---

## 1. Double-booking prevention

### Problem

No check exists for already-confirmed bookings when a new booking is created. A parent can complete checkout twice for the same gymnast and session.

### Fix — backend

Add a duplicate check to all three booking creation endpoints in `backend/routes/booking/bookings.js`, inserted **before the capacity check** in each:

```js
// Check for already-confirmed bookings for these gymnasts in this session
const alreadyBooked = await prisma.bookingLine.findMany({
  where: {
    gymnastId: { in: gymnastIds },
    booking: { sessionInstanceId, status: 'CONFIRMED' },
  },
  include: { gymnast: { select: { firstName: true } } },
});
if (alreadyBooked.length > 0) {
  const names = alreadyBooked.map(l => l.gymnast.firstName).join(', ');
  return res.status(400).json({ error: `Already booked: ${names}` });
}
```

Apply to all three endpoints:
- `POST /api/booking/bookings` (single) — after validation, before capacity check (~line 106)
- `POST /api/booking/bookings/batch` — inside the per-session loop, before capacity check (~line 362)
- `POST /api/booking/bookings/combined` — inside the per-session loop, before capacity check (~line 769)

**PENDING bookings:** Not blocked. The existing stale-PENDING cleanup (run at the start of each endpoint) already cancels any PENDING booking for the same gymnast/session before creating a new one, so there is no race condition.

### Fix — frontend

The existing checkout flow already surfaces 400 error messages to the user. No frontend changes needed.

---

## 2. Spaces remaining prominence

### Problem

The available slots count (`N left`) on the calendar tile is small and easy to miss.

### Fix — frontend only

**`BookingCalendar.js` — status span:**

Apply colour and weight to the status span based on available slots:

```jsx
<span
  className="booking-calendar__day-session-status"
  style={
    !s.isBooked && !s.cancelledAt && s.availableSlots > 0 && s.availableSlots <= 3
      ? { color: 'var(--booking-danger)', fontWeight: 700 }
      : !s.isBooked && !s.cancelledAt && s.availableSlots > 3 && s.availableSlots <= 5
      ? { color: '#e67e22', fontWeight: 600 }
      : undefined
  }
>
  {sessionLabel(s)}
</span>
```

Thresholds: ≤ 3 slots → red + bold; 4–5 slots → amber + semi-bold; > 5 / booked / cancelled / started → default.

**`SessionDetail.js` — slots available line (~line 162):**

Make the count bold and coloured. Guard on `!session.cancelledAt`:

```jsx
<strong style={{
  color: !session.cancelledAt && session.availableSlots <= 3 ? 'var(--booking-danger)'
       : !session.cancelledAt && session.availableSlots <= 5 ? '#e67e22'
       : undefined
}}>
  {session.availableSlots}
</strong>{' '}of {session.capacity} slots available
```

---

## 3. Health notes editing

### Problem

A gymnast's `healthNotes` is displayed read-only in both the parent Account page and the admin member card.

### `healthNotes` sentinel values

The codebase uses `'none'` as a stored sentinel meaning "no known health issues" (distinct from `null` = not yet recorded). Both the edit form and backend must preserve this:

- Checkbox checked ("No known health issues") → store `'none'`
- Checkbox unchecked with text → store the text
- Checkbox unchecked with no text → store `null`

### Backend — new endpoint

Add to `backend/routes/gymnasts.js`:

```
PATCH /api/gymnasts/:id/health-notes
```

**Auth:** Require valid token. Fetch the gymnast with `include: { guardians: true }`. Return `404` if not found or `gymnast.clubId !== req.user.clubId`. Allow if:
- `gymnast.guardians.some(g => g.id === req.user.id)` (parent/guardian), OR
- `req.user.role === 'CLUB_ADMIN' || req.user.role === 'COACH'`

**Body (Joi-validated):**
```js
{
  healthNotes: Joi.string().allow('', null).optional(),
}
```

**Behaviour:**
- `''` or `null` → store `null`
- `'none'` → store `'none'`
- Any other string → store as-is

**Response:** `200 { ok: true }`

**Audit:** Call `audit()` with `action: 'gymnast.updateHealthNotes'` after a successful update.

### Frontend — parent (MyChildren.js)

The health notes display in the gymnast card is currently read-only. Add an inline edit matching the `EmergencyContactForm` pattern:

- Read-only view: current health notes value (showing `None` for `'none'` or null) + small `Edit` button.
- Edit view: a checkbox labelled "No known health issues" (checked when current value is `'none'`), and a `<textarea>` below it (hidden/disabled when checkbox is checked, pre-filled with current text when unchecked). Save and Cancel buttons.
- On Save: call `bookingApi.updateHealthNotes(gymnastId, { healthNotes })` then re-fetch the gymnast.

### Frontend — admin (AdminMembers.js)

The health notes `<li>` at lines 586–596 is read-only. Add the same inline edit pattern:

- `Edit` button next to the displayed value.
- Edit view: same checkbox + textarea as above.
- On Save: call `bookingApi.updateHealthNotes(gymnastId, { healthNotes })` then reload the member detail.

### bookingApi.js

```js
updateHealthNotes: (gymnastId, data) =>
  axios.patch(`${API_URL}/gymnasts/${gymnastId}/health-notes`, data, { headers: getHeaders() }),
```

---

## Files

| Action | Path |
|--------|------|
| Modify | `backend/routes/booking/bookings.js` |
| Modify | `backend/routes/gymnasts.js` |
| Modify | `frontend/src/pages/booking/BookingCalendar.js` |
| Modify | `frontend/src/pages/booking/SessionDetail.js` |
| Modify | `frontend/src/pages/booking/MyChildren.js` |
| Modify | `frontend/src/pages/booking/admin/AdminMembers.js` |
| Modify | `frontend/src/utils/bookingApi.js` |

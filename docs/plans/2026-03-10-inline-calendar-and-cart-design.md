# Inline Session Detail & Multi-Session Cart — Design

## Goal

Replace the full-page-swap session detail with an inline expansion inside the day-detail panel, and allow users to add multiple sessions to a cart before checking out in one payment.

## Architecture

Two largely independent changes sharing a single cart state in `BookingCalendar`.

**Inline session detail** is a pure frontend change — restructure the day-detail panel to conditionally show the session list or the selected session's detail, keeping the week strip always visible.

**Multi-session cart** adds cart state to `BookingCalendar`, changes the inline `SessionDetail` to update the cart instead of triggering a booking, adds a cart summary bar, a new `CartCheckout` page, and a new backend batch-booking endpoint.

The existing standalone `/booking/session/:id` route and `Checkout` page are untouched.

---

## Section 1: Inline session detail

**What changes:**
- Remove the `if (selectedSessionId) { return <SessionDetail .../> }` block at the top of `BookingCalendar` that replaces the whole calendar
- In the day-detail panel, render either:
  - The session list (when `selectedSessionId` is null)
  - `<SessionDetail instanceId={selectedSessionId} onClose={() => setSelectedSessionId(null)} ...cartProps />` (when a session is selected)
- The week strip and header never unmount

**Result:** Tapping a session expands the detail inside the existing panel. The week strip stays visible above. The back button returns to the session list.

---

## Section 2: Multi-session cart

### Cart state

Held in `BookingCalendar`:

```js
// Map<sessionInstanceId, { gymnastIds: Set<string>, pendingMemberId: string|null }>
const [cart, setCart] = useState(new Map());
```

Helper: `cartGymnastCount` = sum of all `Set.size` across the map.

### SessionDetail in inline (cart) mode

When rendered inline, `SessionDetail` receives `cart` and `onCartUpdate(sessionId, gymnasts)` props instead of doing its own booking.

- Gymnast toggle → calls `onCartUpdate` immediately (updates parent cart state)
- The `pendingMemberId` confirmation prompt is preserved — the member must confirm before their id is added to the gymnast set
- No "Book" or payment buttons shown in inline mode
- A small per-session summary ("2 gymnasts · £12.00") replaces the "Book" button area

### Cart summary bar

Rendered below the day-detail panel in `BookingCalendar` whenever `cartGymnastCount > 0`:

```
[2 sessions · 3 gymnast-slots · £18.00]  [Checkout →]
```

Clicking Checkout navigates to `/booking/cart-checkout` passing cart contents via `location.state`.

### CartCheckout page (`/booking/cart-checkout`)

- Lists each session with its gymnasts and line amount
- Shows credits applied across the total
- Single "Pay £X" button (or "Confirm (Free)" if credits cover it all)
- Calls `POST /api/bookings/batch`
- On success: navigate to a new `/booking/cart-confirmation` page
- On payment required: navigate to existing `/booking/checkout/:bookingId` with clientSecret (backend returns a single booking id for the batch)

### Backend: `POST /api/bookings/batch`

```
Body: { items: [{ sessionInstanceId, gymnastIds }] }
Response: { bookingIds, booking: { id }, clientSecret? }
```

- Validates each session/gymnast combination (slot availability, insurance, etc.)
- Creates one `Booking` record per item (same as existing `createBooking` logic, looped)
- Sums the charge amounts; if > 0, creates a single Stripe PaymentIntent for the total
- Returns all booking ids plus the clientSecret if payment needed

Credits are applied greedily across items in order.

---

## What stays the same

- Standalone `/booking/session/:id` route
- Existing `POST /api/bookings` single-booking endpoint
- Existing `Checkout` and `BookingConfirmation` pages
- All admin views

---

## Files touched

**Frontend:**
- `BookingCalendar.js` — restructure day-detail panel, add cart state, add cart bar
- `BookingCalendar.css` — styles for cart bar
- `SessionDetail.js` — accept `cartMode`, `cartGymnasts`, `onCartUpdate` props; suppress booking UI when in cart mode
- `CartCheckout.js` — new page
- `CartConfirmation.js` — new page (or reuse BookingConfirmation)
- `App.js` — add routes for cart-checkout and cart-confirmation

**Backend:**
- `backend/routes/booking/bookings.js` — add `POST /batch` handler

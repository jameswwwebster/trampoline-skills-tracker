# Inline Session Detail & Multi-Session Cart — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full-page-swap session detail with inline expansion, add a multi-session cart so users can book several sessions in one checkout.

**Architecture:** Six independent tasks. Tasks 1–4 are pure frontend. Task 5 is backend. Task 6 wires everything up. Cart state lives in `BookingCalendar` as a `Map<sessionInstanceId, gymnast[]>`. A single Stripe PaymentIntent covers the batch total; all batch bookings share the same `stripePaymentIntentId` so the existing webhook `updateMany` confirms them all automatically.

**Tech Stack:** React 18, Express + Prisma 5, Stripe, CSS custom properties.

---

### Task 1: Inline session detail — fix the full-page swap

The problem: `BookingCalendar` has an early-return block at line 118 that replaces the whole calendar with `<SessionDetail>`. Instead, `SessionDetail` should render inside the existing day-detail panel.

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

**Step 1: Remove the early-return block (lines 117–127)**

Delete this entire block:

```js
// ── Inline session detail ──
if (selectedSessionId) {
  return (
    <div className="booking-calendar">
      <SessionDetail
        instanceId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
```

**Step 2: Replace the day-detail panel content (week view only)**

Find the `<div className="booking-calendar__day-detail" ...>` block (currently ~line 266). Replace its contents so it conditionally shows either the `SessionDetail` or the session list:

```jsx
<div
  className="booking-calendar__day-detail"
  style={{ '--detail-arrow': `${(selectedDate.getDay() + 0.5) / 7 * 100}%` }}
>
  {selectedSessionId ? (
    <SessionDetail
      instanceId={selectedSessionId}
      onClose={() => setSelectedSessionId(null)}
    />
  ) : (
    <>
      <p className="booking-calendar__day-detail-heading">
        {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      {dayIsClosed && <p className="booking-calendar__day-closed">Closed</p>}
      {!dayIsClosed && daySessions.length === 0 && (
        <p className="booking-calendar__day-empty">No sessions</p>
      )}
      {!dayIsClosed && daySessions.map(s => (
        <button
          key={s.id}
          className={`booking-calendar__day-session booking-calendar__day-session--${sessionClass(s, dayIsPast)}`}
          disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || dayIsPast}
          onClick={() => setSelectedSessionId(s.id)}
        >
          <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}</span>
          <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
        </button>
      ))}
    </>
  )}
</div>
```

**Step 3: Add the SessionDetail import if not already present**

Check the top of `BookingCalendar.js` — `SessionDetail` should already be imported. If not:

```js
import SessionDetail from './SessionDetail';
```

**Step 4: Manual test**

- Open the booking calendar
- Click any session time — the day-detail panel should expand to show the session detail; the week strip should remain visible above
- Click "← Back to calendar" — should return to the session list in the panel

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "fix: show session detail inline in day-detail panel instead of full-page swap"
```

---

### Task 2: Update SessionDetail to support cart mode

In cart mode, gymnast toggles update an external cart (passed via props) instead of local state, and the booking/payment UI is suppressed. The standalone route keeps its current behaviour.

**Files:**
- Modify: `frontend/src/pages/booking/SessionDetail.js`

**Step 1: Add cart props to the function signature**

```js
export default function SessionDetail({
  instanceId: propInstanceId,
  onClose,
  cartMode = false,
  cartGymnastIds = [],
  onCartUpdate,
}) {
```

**Step 2: Rename the local gymnast selection state**

Change:
```js
const [selectedGymnastIds, setSelectedGymnastIds] = useState([]);
```
To:
```js
const [localSelectedGymnastIds, setLocalSelectedGymnastIds] = useState([]);
```

**Step 3: Add a computed `selectedGymnastIds` that switches based on `cartMode`**

Directly after the renamed state:
```js
const selectedGymnastIds = cartMode ? cartGymnastIds : localSelectedGymnastIds;
```

**Step 4: Replace the `toggleGymnast` function**

```js
const toggleGymnast = (id) => {
  if (cartMode) {
    const isSelected = cartGymnastIds.includes(id);
    const gymnast = myGymnasts.find(g => g.id === id);
    const currentSelected = myGymnasts.filter(g => cartGymnastIds.includes(g.id));
    const newGymnasts = isSelected
      ? currentSelected.filter(g => g.id !== id)
      : [...currentSelected, gymnast];
    onCartUpdate(instanceId, newGymnasts);
  } else {
    setLocalSelectedGymnastIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }
};
```

**Step 5: Suppress the booking/credit/summary UI in cart mode**

Find the block that starts `{!session.cancelledAt && session.availableSlots > 0 && (`. Inside the `<>` block, at the bottom (after the gymnast list section), the credits notice, summary, and Book button are:

```jsx
{totalCreditsAvailable > 0 && (
  <p className="session-detail__credit-notice">...</p>
)}

{selectedGymnastIds.length > 0 && (
  <div className="session-detail__summary">...</div>
)}

{error && <p className="session-detail__error">{error}</p>}

<button className="session-detail__book-btn" ...>...</button>
```

Replace these four blocks with:

```jsx
{cartMode ? (
  selectedGymnastIds.length > 0 && (
    <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--booking-success)', fontWeight: 600 }}>
      {selectedGymnastIds.length} gymnast{selectedGymnastIds.length !== 1 ? 's' : ''} added to cart
    </p>
  )
) : (
  <>
    {totalCreditsAvailable > 0 && (
      <p className="session-detail__credit-notice">
        £{(creditAmount / 100).toFixed(2)} credit will be applied automatically.
      </p>
    )}
    {selectedGymnastIds.length > 0 && (
      <div className="session-detail__summary">
        <p>Gymnasts: {selectedGymnastIds.length} × £6.00 = £{(totalAmount / 100).toFixed(2)}</p>
        {creditAmount > 0 && <p>Credits applied: –£{(creditAmount / 100).toFixed(2)}</p>}
        <p><strong>Total: £{(chargeAmount / 100).toFixed(2)}</strong></p>
      </div>
    )}
    {error && <p className="session-detail__error">{error}</p>}
    <button
      className="session-detail__book-btn"
      disabled={selectedGymnastIds.length === 0 || booking}
      onClick={handleBook}
    >
      {booking ? 'Processing...' : `Book${chargeAmount > 0 ? ` — £${(chargeAmount / 100).toFixed(2)}` : ' (Free)'}`}
    </button>
  </>
)}
```

**Step 6: Manual test**

- The standalone `/booking/session/:id` route (if you navigate directly) should still show the Book button and payment flow unchanged
- From the calendar, clicking a session should show the session detail inline with no Book button (cart mode will be wired up in Task 3)

**Step 7: Commit**

```bash
git add frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: add cart mode to SessionDetail — gymnast toggles update external cart, suppress booking UI"
```

---

### Task 3: Add cart state to BookingCalendar and wire to SessionDetail

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

**Step 1: Add cart state**

After the existing `useState` declarations (near line 23):

```js
const [cart, setCart] = useState(new Map()); // Map<sessionInstanceId, gymnast[]>
```

**Step 2: Add the cart update handler**

After the `sessionClass` helper:

```js
const handleCartUpdate = (sessionId, gymnasts) => {
  setCart(prev => {
    const next = new Map(prev);
    if (gymnasts.length === 0) {
      next.delete(sessionId);
    } else {
      next.set(sessionId, gymnasts);
    }
    return next;
  });
};
```

**Step 3: Pass cart props to inline SessionDetail**

Find the `SessionDetail` render inside the day-detail panel (from Task 1). Add the cart props:

```jsx
<SessionDetail
  instanceId={selectedSessionId}
  onClose={() => setSelectedSessionId(null)}
  cartMode
  cartGymnastIds={(cart.get(selectedSessionId) || []).map(g => g.id)}
  onCartUpdate={handleCartUpdate}
/>
```

**Step 4: Manual test**

- Click a session — session detail opens inline
- Tick a gymnast — gymnast shows as selected (✓), "1 gymnast added to cart" appears
- Click "← Back to calendar" — session list shows again
- Click the same session again — gymnast is still checked (cart persisted)
- Click a different session — select a gymnast there too

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "feat: add cart state to BookingCalendar and wire to inline SessionDetail"
```

---

### Task 4: Add cart summary bar to BookingCalendar

When the cart has items, a bar appears below the day-detail panel showing the total and a Checkout button.

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`
- Modify: `frontend/src/pages/booking/BookingCalendar.css`

**Step 1: Add cart total computation**

After `handleCartUpdate`:

```js
const cartEntries = Array.from(cart.entries()); // [[sessionId, gymnasts[]], ...]
const cartTotalSlots = cartEntries.reduce((sum, [, g]) => sum + g.length, 0);
const cartTotalAmount = cartTotalSlots * 600;
```

**Step 2: Add checkout navigation**

Add `useNavigate` import if not already present:
```js
import { useNavigate } from 'react-router-dom';
```

Inside the component, after the cart total computation:
```js
const navigate = useNavigate();

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
```

**Step 3: Render the cart bar in the week view**

After the closing `</div>` of `.booking-calendar__day-detail` (but before the `{loading && ...}` line), add:

```jsx
{cartTotalSlots > 0 && (
  <div className="booking-calendar__cart-bar">
    <span>
      {cartTotalSlots} gymnast-slot{cartTotalSlots !== 1 ? 's' : ''} · £{(cartTotalAmount / 100).toFixed(2)}
    </span>
    <button className="booking-calendar__cart-checkout-btn" onClick={handleCartCheckout}>
      Checkout →
    </button>
  </div>
)}
```

**Step 4: Add CSS for the cart bar**

In `BookingCalendar.css`, append:

```css
/* ── Cart bar ── */
.booking-calendar__cart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.65rem 0.9rem;
  background: var(--booking-accent-gradient);
  color: var(--booking-text-on-dark);
  border-radius: var(--booking-radius);
  font-size: 0.875rem;
  font-weight: 600;
}

.booking-calendar__cart-checkout-btn {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: var(--booking-radius);
  color: var(--booking-text-on-dark);
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 700;
}

.booking-calendar__cart-checkout-btn:hover {
  background: rgba(255,255,255,0.25);
}
```

**Step 5: Manual test**

- Select gymnasts for one or more sessions
- Cart bar appears below the day-detail with slot count and price
- Clicking Checkout navigates to `/booking/cart-checkout` (will 404 until Task 6 adds the route)

**Step 6: Commit**

```bash
git add frontend/src/pages/booking/BookingCalendar.js frontend/src/pages/booking/BookingCalendar.css
git commit -m "feat: add cart summary bar to BookingCalendar with checkout navigation"
```

---

### Task 5: Backend — POST /api/booking/bookings/batch

Creates multiple bookings from a cart in a single request, with one Stripe PaymentIntent for the combined total.

**Files:**
- Modify: `backend/routes/booking/bookings.js`
- Modify: `backend/routes/booking/webhook.js`

**Step 1: Add the batch schema and route**

Add this after the `createBookingSchema` declaration (line ~14) in `bookings.js`:

```js
const batchBookingSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    sessionInstanceId: Joi.string().required(),
    gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
  })).min(1).required(),
});
```

**Step 2: Add the route handler**

Add before `router.get('/my', ...)` (i.e., after the existing `router.post('/', ...)` handler, around line 200):

```js
// POST /api/booking/bookings/batch
// Create multiple bookings with a single Stripe PaymentIntent
router.post('/batch', auth, async (req, res) => {
  try {
    const { error, value } = batchBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { items } = value;
    const now = new Date();

    // ── Validate all items before creating anything ──
    const validatedItems = [];
    for (const item of items) {
      const { sessionInstanceId, gymnastIds } = item;

      const instance = await prisma.sessionInstance.findUnique({
        where: { id: sessionInstanceId },
        include: {
          template: true,
          bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
        },
      });
      if (!instance) return res.status(404).json({ error: `Session ${sessionInstanceId} not found` });
      if (instance.cancelledAt) return res.status(400).json({ error: 'A session in your cart is cancelled' });
      if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

      const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      if (bookedCount + gymnastIds.length > capacity) {
        return res.status(400).json({ error: `Not enough slots available for session at ${instance.date} ${instance.template.startTime}` });
      }

      // BG insurance check
      const insuranceChecks = await Promise.all(
        gymnastIds.map(async (gId) => {
          const g = await prisma.gymnast.findUnique({ where: { id: gId }, select: { firstName: true, bgInsuranceConfirmed: true } });
          const pastCount = await prisma.bookingLine.count({
            where: { gymnastId: gId, booking: { status: 'CONFIRMED', sessionInstance: { date: { lte: now } } } },
          });
          return { ...g, pastCount };
        })
      );
      const needsInsurance = insuranceChecks.filter(g => g.pastCount >= 2 && !g.bgInsuranceConfirmed);
      if (needsInsurance.length > 0) {
        return res.status(400).json({
          error: `BG insurance confirmation required for: ${needsInsurance.map(g => g.firstName).join(', ')}`,
          code: 'INSURANCE_REQUIRED',
        });
      }

      // Age restriction check
      if (instance.template.minAge) {
        const gymnasts = await prisma.gymnast.findMany({ where: { id: { in: gymnastIds } } });
        const instanceDate = new Date(instance.date);
        for (const g of gymnasts) {
          if (g.dateOfBirth) {
            const age = Math.floor((instanceDate - new Date(g.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < instance.template.minAge) {
              return res.status(400).json({ error: `${g.firstName} doesn't meet the minimum age requirement` });
            }
          }
        }
      }

      // Parent ownership check
      if (req.user.role === 'PARENT') {
        const myGymnasts = await prisma.gymnast.findMany({
          where: { id: { in: gymnastIds }, guardians: { some: { id: req.user.id } } },
        });
        if (myGymnasts.length !== gymnastIds.length) {
          return res.status(403).json({ error: 'Access denied to one or more gymnasts' });
        }
      }

      validatedItems.push({
        sessionInstanceId,
        gymnastIds,
        itemAmount: PRICE_PER_GYMNAST_PENCE * gymnastIds.length,
      });
    }

    // ── Total and credits ──
    const totalAmount = validatedItems.reduce((sum, item) => sum + item.itemAmount, 0);

    const availableCredits = await prisma.credit.findMany({
      where: { userId: req.user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    let remaining = totalAmount;
    const creditsToUse = [];
    for (const credit of availableCredits) {
      if (remaining <= 0) break;
      const consume = Math.min(credit.amount, remaining);
      remaining -= consume;
      creditsToUse.push({ id: credit.id, consume, remainder: credit.amount - consume, expiresAt: credit.expiresAt });
    }
    const chargeAmount = Math.max(0, remaining);

    // ── Cancel stale PENDING bookings for all sessions ──
    for (const item of validatedItems) {
      const stalePending = await prisma.booking.findMany({
        where: { userId: req.user.id, sessionInstanceId: item.sessionInstanceId, status: 'PENDING' },
      });
      for (const stale of stalePending) {
        await prisma.credit.updateMany({ where: { usedOnBookingId: stale.id }, data: { usedAt: null, usedOnBookingId: null } });
        await prisma.booking.update({ where: { id: stale.id }, data: { status: 'CANCELLED' } });
      }
    }

    // ── Single Stripe PaymentIntent for the combined total ──
    let paymentIntentId = null;
    let clientSecret = null;
    if (chargeAmount > 0) {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: chargeAmount,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        metadata: { userId: req.user.id, batchSize: String(validatedItems.length) },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    // ── Create one booking per item, all sharing the same paymentIntentId ──
    const bookings = [];
    for (const item of validatedItems) {
      const booking = await prisma.booking.create({
        data: {
          userId: req.user.id,
          sessionInstanceId: item.sessionInstanceId,
          stripePaymentIntentId: paymentIntentId,
          status: chargeAmount === 0 ? 'CONFIRMED' : 'PENDING',
          totalAmount: item.itemAmount,
          lines: {
            create: item.gymnastIds.map(id => ({ gymnastId: id, amount: PRICE_PER_GYMNAST_PENCE })),
          },
        },
        include: { lines: true },
      });
      bookings.push(booking);
    }

    // ── Mark credits as used (attached to first booking) ──
    for (const c of creditsToUse) {
      await prisma.credit.update({
        where: { id: c.id },
        data: { amount: c.consume, usedAt: new Date(), usedOnBookingId: bookings[0].id },
      });
      if (c.remainder > 0) {
        await prisma.credit.create({
          data: { userId: req.user.id, amount: c.remainder, expiresAt: c.expiresAt },
        });
      }
    }

    res.json({ bookings, clientSecret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

**Step 3: Fix webhook payment_failed handler for batch bookings**

In `webhook.js`, the `payment_intent.payment_failed` / `payment_intent.canceled` handler currently uses `findFirst` and cancels a single booking. Replace it to handle multiple bookings sharing the same PaymentIntent:

```js
if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
  const paymentIntent = event.data.object;
  // Release credits (may be attached to any of the batch bookings)
  const pendingBookings = await prisma.booking.findMany({
    where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
  });
  for (const booking of pendingBookings) {
    await prisma.credit.updateMany({
      where: { usedOnBookingId: booking.id },
      data: { usedAt: null, usedOnBookingId: null },
    });
  }
  await prisma.booking.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  console.log(`Bookings cancelled and credits released for payment intent ${paymentIntent.id} (${event.type})`);
}
```

**Step 4: Manual test with curl or Postman**

```bash
curl -X POST http://localhost:5000/api/booking/bookings/batch \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "sessionInstanceId": "<id1>", "gymnastIds": ["<gymnastId>"] },
      { "sessionInstanceId": "<id2>", "gymnastIds": ["<gymnastId>"] }
    ]
  }'
```

Expected: `200` with `{ bookings: [...], clientSecret: "pi_..." }` (or no clientSecret if credits covered it)

**Step 5: Commit**

```bash
git add backend/routes/booking/bookings.js backend/routes/booking/webhook.js
git commit -m "feat: add POST /api/booking/bookings/batch and fix webhook to handle batch cancellation"
```

---

### Task 6: CartCheckout page + API method + routes

**Files:**
- Create: `frontend/src/pages/booking/CartCheckout.js`
- Modify: `frontend/src/utils/bookingApi.js`
- Modify: `frontend/src/App.js`

**Step 1: Add `createBatchBooking` to bookingApi.js**

Inside the `bookingApi` object, after `createBooking`:

```js
createBatchBooking: (data) =>
  axios.post(`${API_URL}/booking/bookings/batch`, data, { headers: getHeaders() }),
```

**Step 2: Create CartCheckout.js**

```jsx
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function CartCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems = location.state?.cart || [];
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const totalSlots = cartItems.reduce((sum, item) => sum + item.gymnasts.length, 0);
  const totalAmount = totalSlots * 600;

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await bookingApi.createBatchBooking({
        items: cartItems.map(item => ({
          sessionInstanceId: item.sessionInstanceId,
          gymnastIds: item.gymnasts.map(g => g.id),
        })),
      });
      if (res.data.clientSecret) {
        navigate(`/booking/checkout/${res.data.bookings[0].id}`, {
          state: { clientSecret: res.data.clientSecret },
        });
      } else {
        navigate(`/booking/confirmation/${res.data.bookings[0].id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
      setProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="bk-page bk-page--sm bk-center">
        <p style={{ color: 'var(--booking-text-muted)' }}>Your cart is empty.</p>
        <Link to="/booking" className="bk-link">Back to calendar</Link>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--sm">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="bk-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 style={{ margin: 0 }}>Confirm Booking</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {cartItems.map(item => (
          <div key={item.sessionInstanceId} className="bk-card" style={{ padding: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {new Date(item.date).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}{' '}
              {item.startTime}–{item.endTime}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
              {item.gymnasts.map(g => `${g.firstName} ${g.lastName}`).join(', ')}
              {' · '}£{((item.gymnasts.length * 600) / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.5rem' }}>
        Total: £{(totalAmount / 100).toFixed(2)}
      </div>

      {error && <p style={{ color: 'var(--booking-danger)', marginBottom: '1rem' }}>{error}</p>}

      <button
        className="bk-btn bk-btn--primary bk-btn--full"
        disabled={processing}
        onClick={handleConfirm}
      >
        {processing ? 'Processing...' : `Pay £${(totalAmount / 100).toFixed(2)}`}
      </button>
    </div>
  );
}
```

**Step 3: Add the import and route in App.js**

Add the import with other booking imports:

```js
import CartCheckout from './pages/booking/CartCheckout';
```

Inside the `/booking` `<Route>` block, after the `checkout/:bookingId` route:

```jsx
<Route path="cart-checkout" element={<CartCheckout />} />
```

**Step 4: Manual end-to-end test**

1. Open the calendar, click a session, select a gymnast → "1 gymnast added to cart" appears, cart bar appears below
2. Click back, click another session, select another gymnast → cart bar updates to 2 slots
3. Click "Checkout →" → CartCheckout page shows both sessions with gymnasts and total
4. Click "Pay £X" → proceeds to Stripe checkout (or straight to confirmation if credits cover it)
5. After payment → BookingConfirmation shows "Booking confirmed!"
6. Check My Bookings → both sessions should appear

**Step 5: Commit and push**

```bash
git add frontend/src/pages/booking/CartCheckout.js \
        frontend/src/utils/bookingApi.js \
        frontend/src/App.js
git commit -m "feat: add CartCheckout page, createBatchBooking API method, and cart-checkout route"
git push
```

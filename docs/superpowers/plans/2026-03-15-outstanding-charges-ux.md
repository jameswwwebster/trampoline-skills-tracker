# Outstanding Charges UX — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make outstanding charges discoverable and payable with a direct "Pay now" button, a red dot on the Account nav link, and a Cart nav link that appears when charges exist.

**Architecture:** Pure frontend. BookingLayout adds hasOutstandingCharge state driven by the existing getMyCharges() call. Account and MyCharges pages get Pay now links to /booking/cart.

**Tech Stack:** React 18, React Router

---

## Task 1: BookingLayout.js + BookingLayout.css

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`
- Modify: `frontend/src/pages/booking/BookingLayout.css`

- [ ] **Add `hasOutstandingCharge` state and extend the existing `getMyCharges()` effect**

At line 28, **after** the existing `hasOverdueCharge` state declaration, add a new state variable:
```js
const [hasOverdueCharge, setHasOverdueCharge] = useState(false);  // existing — keep unchanged
const [hasOutstandingCharge, setHasOutstandingCharge] = useState(false);  // new
```

In the existing `getMyCharges()` effect (lines 83–91), extend it to also set `hasOutstandingCharge`. The existing `setHasOverdueCharge` call must be preserved (it drives the overdue payment banner at line 327):
```js
useEffect(() => {
  if (!user || isAdmin) return;
  bookingApi.getMyCharges()
    .then(r => {
      const now = new Date();
      setHasOverdueCharge(r.data.some(c => new Date(c.dueDate) < now));
      setHasOutstandingCharge(r.data.length > 0);
    })
    .catch(() => {});
}, [user, isAdmin]);
```

- [ ] **Add `position: 'relative'` and the red dot badge to the Account NavLink**

Replace the Account NavLink (lines 203–206):
```jsx
<NavLink to="/booking/my-account" onClick={() => setOpenDropdown(null)}>
  Account
</NavLink>
```
with:
```jsx
<NavLink to="/booking/my-account" style={{ position: 'relative' }} onClick={() => setOpenDropdown(null)}>
  Account
  {hasOutstandingCharge && (
    <span className="booking-layout__unread-badge booking-layout__unread-badge--dot" />
  )}
</NavLink>
```

- [ ] **Show Cart link when charges exist (in addition to when cartCount > 0)**

Replace the Cart link block (lines 209–213):
```jsx
{cartCount > 0 && (
  <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
    Cart ({cartCount})
  </NavLink>
)}
```
with:
```jsx
{(cartCount > 0 || hasOutstandingCharge) && (
  <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
    Cart{cartCount > 0 ? ` (${cartCount})` : ''}
  </NavLink>
)}
```

- [ ] **Add `.booking-layout__unread-badge--dot` CSS modifier**

In `BookingLayout.css`, after the existing `.booking-layout__unread-badge` block (lines 228–244), add:
```css
.booking-layout__unread-badge--dot {
  width: 8px;
  height: 8px;
  min-width: unset;
  padding: 0;
  border-radius: 50%;
  background: var(--booking-danger);
}
```

- [ ] **Manual verification**

  1. Log in as a member who has at least one outstanding charge.
  2. Confirm a small red dot appears on the Account nav link.
  3. Confirm the Cart nav link is visible even when the cart is empty.
  4. Log in as a member with no charges — confirm no dot and Cart link is hidden (assuming empty cart).
  5. Log in as admin — confirm no dot (isAdmin guard).

- [ ] **Commit**

```bash
git add frontend/src/pages/booking/BookingLayout.js frontend/src/pages/booking/BookingLayout.css
git commit -m "feat: add outstanding-charge red dot on Account nav and show Cart link when charges exist"
```

---

## Task 2: MyChildren.js — Pay now button in charges card

**Files:**
- Modify: `frontend/src/pages/booking/MyChildren.js`

- [ ] **Remove the "Settled automatically" sub-label paragraph**

In the charges card (around lines 689–707), remove:
```jsx
<p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>
  Settled automatically at checkout — go to your cart to pay.
</p>
```

- [ ] **Add a Pay now Link after the charges list**

After the closing `</div>` of the charges map block (the inner `flexDirection: 'column'` div), add:
```jsx
<Link
  to="/booking/cart"
  className="bk-btn bk-btn--primary"
  style={{ display: 'inline-block', marginTop: '0.75rem' }}
>
  Pay now →
</Link>
```

The full updated charges card should read:
```jsx
{charges.length > 0 && (
  <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
    <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Outstanding charges</p>
    <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--booking-danger)' }}>
      £{(charges.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} outstanding
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {charges.map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span>{c.description}</span>
          <span className="bk-muted">Due {new Date(c.dueDate).toLocaleDateString('en-GB')}</span>
        </div>
      ))}
    </div>
    <Link
      to="/booking/cart"
      className="bk-btn bk-btn--primary"
      style={{ display: 'inline-block', marginTop: '0.75rem' }}
    >
      Pay now →
    </Link>
  </div>
)}
```

**Important:** `MyChildren.js` does not currently import `Link` from react-router-dom. Add this import at the top of the file:
```js
import { Link } from 'react-router-dom';
```
(Check first with a search; if it is already imported, skip this step.)

- [ ] **Manual verification**

  1. Navigate to Account > child details as a member with outstanding charges.
  2. Confirm the "Settled automatically at checkout" text is gone.
  3. Confirm a "Pay now →" button appears below the charge rows.
  4. Click it — confirm navigation to `/booking/cart`.
  5. With no charges, confirm the card does not appear.

- [ ] **Commit**

```bash
git add frontend/src/pages/booking/MyChildren.js
git commit -m "feat: add Pay now button to outstanding charges card in MyChildren"
```

---

## Task 3: MyCharges.js — replace paragraph with Pay now Link

**Files:**
- Modify: `frontend/src/pages/booking/MyCharges.js`

- [ ] **Check whether `Link` is already imported**

Read the top of `MyCharges.js`. If `Link` from `react-router-dom` is not already imported, add it:
```js
import { Link } from 'react-router-dom';
```

- [ ] **Replace the "Outstanding charges are settled through the [cart link]" paragraph**

Inside the `charges.length > 0` block, find and remove the `<p>` that reads something like:
```jsx
<p>Outstanding charges are settled through the <Link to="/booking/cart">cart</Link>.</p>
```
Replace it with:
```jsx
<Link
  to="/booking/cart"
  className="bk-btn bk-btn--primary"
  style={{ display: 'inline-block', marginBottom: '1rem' }}
>
  Pay now →
</Link>
```

- [ ] **Manual verification**

  1. Navigate to Account > My Charges as a member with outstanding charges.
  2. Confirm the old explanatory paragraph is gone.
  3. Confirm a "Pay now →" primary button appears near the top of the charges list.
  4. Click it — confirm navigation to `/booking/cart`.
  5. With no charges, confirm the button does not appear.

- [ ] **Commit**

```bash
git add frontend/src/pages/booking/MyCharges.js
git commit -m "feat: replace charges paragraph with Pay now button in MyCharges"
```

---

## Task 4: Push to remote

- [ ] **Push**

```bash
git push
```

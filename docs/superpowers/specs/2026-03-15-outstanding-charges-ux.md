# Outstanding Charges UX

**Date:** 2026-03-15

## Goal

Make it easy for members to discover and pay outstanding charges. Currently the cart nav link is hidden when there are no session/shop items in the cart, so members with only outstanding charges have no obvious path to payment.

## Changes

### 1. BookingLayout.js

**New state:** `hasOutstandingCharge` — boolean, `false` initially.

**Extend the existing `getMyCharges()` effect** (currently sets `hasOverdueCharge`) to also set `hasOutstandingCharge`:

```js
bookingApi.getMyCharges()
  .then(r => {
    const now = new Date();
    setHasOverdueCharge(r.data.some(c => new Date(c.dueDate) < now));
    setHasOutstandingCharge(r.data.length > 0);
  })
  .catch(() => {});
```

**Account nav link — red dot indicator:**

Add `style={{ position: 'relative' }}` to the Account `NavLink` (matching the Noticeboard NavLink pattern) and render a dot badge when `hasOutstandingCharge` is true:

```jsx
<NavLink to="/booking/my-account" style={{ position: 'relative' }} onClick={() => setOpenDropdown(null)}>
  Account
  {hasOutstandingCharge && (
    <span className="booking-layout__unread-badge booking-layout__unread-badge--dot" />
  )}
</NavLink>
```

**Cart nav link — show when charges exist:**

Change the cart link condition from `cartCount > 0` to `cartCount > 0 || hasOutstandingCharge`.

Label:
- When `cartCount > 0`: `Cart ({cartCount})` — unchanged
- When `cartCount === 0` and `hasOutstandingCharge`: plain `Cart`

```jsx
{(cartCount > 0 || hasOutstandingCharge) && (
  <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
    {cartCount > 0 ? `Cart (${cartCount})` : 'Cart'}
  </NavLink>
)}
```

**Stale state:** `hasOutstandingCharge` is only fetched on mount. After a member pays via the cart they are redirected to `/booking/my-charges?paid=true`, which is a new page load — the layout re-mounts and re-fetches, clearing the indicator. No special handling needed.

### 2. BookingLayout.css

Add a CSS modifier for the dot variant of the badge:

```css
.booking-layout__unread-badge--dot {
  width: 8px;
  height: 8px;
  min-width: unset;
  padding: 0;
  border-radius: 50%;
}
```

This overrides the base `.booking-layout__unread-badge` text/count styles and renders a plain filled circle.

### 3. MyChildren.js (Account page — charges card)

The charges card renders when `charges.length > 0`. It currently shows (in order):
1. Heading
2. Sub-label `<p>`: "Settled automatically at checkout — go to your cart to pay."
3. Total
4. Itemised charge list

**Remove the sub-label `<p>` entirely.** Add a `<Link to="/booking/cart">` styled as a primary button after the itemised charge list:

```jsx
<Link to="/booking/cart" className="bk-btn bk-btn--primary" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
  Pay now →
</Link>
```

The card sequence becomes: heading → total → itemised list → Pay now button.

### 4. MyCharges.js

The page currently shows a `<p>` element with "Outstanding charges are settled through the [cart link]." inside the `charges.length > 0` block.

**Remove that `<p>` element entirely.** Add a `<Link to="/booking/cart">` styled as a primary button immediately before the charges table (within the same `charges.length > 0` block):

```jsx
<Link to="/booking/cart" className="bk-btn bk-btn--primary" style={{ display: 'inline-block', marginBottom: '1rem' }}>
  Pay now →
</Link>
```

The charges table below remains unchanged.

## Files

| Action | Path |
|--------|------|
| Modify | `frontend/src/pages/booking/BookingLayout.js` |
| Modify | `frontend/src/pages/booking/BookingLayout.css` |
| Modify | `frontend/src/pages/booking/MyChildren.js` |
| Modify | `frontend/src/pages/booking/MyCharges.js` |

## Scope

Frontend only. No backend or API changes. No changes to cart logic.

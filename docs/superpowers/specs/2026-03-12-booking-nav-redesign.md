# Design: Booking Nav Redesign for Parents

**Date:** 2026-03-12
**Status:** Approved

---

## Problem

The parent-facing booking nav bar has 7 flat links (Calendar, Cart, My Bookings, My Account, Shop, My Orders, Noticeboard) which is becoming cluttered as the feature set grows. Admins and coaches also land on the parent-facing calendar at `/booking` rather than the admin sessions view.

---

## Solution

Group the parent nav into dropdowns, rename items for clarity, give the cart a distinct visual treatment, and redirect admins/coaches from `/booking` to `/booking/admin`.

---

## Parent Nav Structure (after)

| Item | Type | Destination(s) |
|------|------|----------------|
| **Bookings ▾** | Dropdown | Book → `/booking`, My Bookings → `/booking/my-bookings` |
| **Shop ▾** | Dropdown | Shop → `/booking/shop`, My Orders → `/booking/my-orders` |
| **Noticeboard** | Standalone | `/booking/noticeboard` — unread badge unchanged |
| **Account** | Standalone | `/booking/my-account` — renamed from "My Account" |
| **Cart (N)** | Conditional standalone | `/booking/cart` — only shown when `cartCount > 0`, colour-inverted styling |

Admin nav is untouched.

---

## Changes

### 1. `BookingLayout.js` — Parent nav links

**Import change:** Add `useLocation` to the react-router-dom import (it is not currently imported).

**Hook:** Add `const location = useLocation();` to the component body alongside the existing hooks.

**Delete** the existing flat parent nav links (lines 105–124 in the current file — the unguarded `NavLink` blocks for Calendar, Cart, My Bookings, My Account, Shop, My Orders, Noticeboard). These render for all users including admins today; they are fully replaced by the `{!isAdmin && ...}` block below. The admin section (lines 125–174) is untouched.

Replace with:

```jsx
{/* Parent nav */}
{!isAdmin && (
  <>
    {/* Bookings dropdown */}
    <div className="booking-layout__dropdown">
      <button
        className={`booking-layout__dropdown-btn${openDropdown === 'bookings' ? ' active' : ''}`}
        onClick={() => toggleDropdown('bookings')}
      >
        Bookings ▾
      </button>
      {openDropdown === 'bookings' && (
        <div className="booking-layout__dropdown-menu">
          <NavLink to="/booking" end className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
            Book
          </NavLink>
          <NavLink to="/booking/my-bookings" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
            My Bookings
          </NavLink>
        </div>
      )}
    </div>

    {/* Shop dropdown */}
    <div className="booking-layout__dropdown">
      <button
        className={`booking-layout__dropdown-btn${openDropdown === 'shop' ? ' active' : ''}`}
        onClick={() => toggleDropdown('shop')}
      >
        Shop ▾
      </button>
      {openDropdown === 'shop' && (
        <div className="booking-layout__dropdown-menu">
          <NavLink to="/booking/shop" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
            Shop
          </NavLink>
          <NavLink to="/booking/my-orders" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
            My Orders
          </NavLink>
        </div>
      )}
    </div>

    {/* Noticeboard */}
    <NavLink
      to="/booking/noticeboard"
      style={{ position: 'relative' }}
      onClick={() => { setNoticeBanner(false); setOpenDropdown(null); }}
    >
      Noticeboard
      {unreadCount > 0 && (
        <span className="booking-layout__unread-badge">{unreadCount}</span>
      )}
    </NavLink>

    {/* Account */}
    <NavLink to="/booking/my-account" onClick={() => setOpenDropdown(null)}>
      Account
    </NavLink>

    {/* Cart — standalone, conditional, inverted */}
    {cartCount > 0 && (
      <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
        Cart ({cartCount})
      </NavLink>
    )}
  </>
)}
```

**Active state on dropdown buttons:** Apply a persistent active class when the current route is within the group:

```js
const isBookingsActive = location.pathname === '/booking' || location.pathname.startsWith('/booking/my-bookings');
const isShopActive = location.pathname.startsWith('/booking/shop') || location.pathname.startsWith('/booking/my-orders');
```

Use `startsWith` throughout for consistency so sub-routes (e.g. `/booking/my-orders/123`) are also captured. Pass these as additional conditions on each button's active class alongside the open-dropdown condition.

**Click-outside ref:** The `dropdownRef` currently wraps only the admin group (`booking-layout__admin-group`). Move it to wrap the entire `booking-layout__links` div. The existing `handleClickOutside` handler sets `openDropdown` to null on any click outside the ref — this correctly closes both parent and admin dropdowns. Individual nav links already call `setOpenDropdown(null)` on click, so this change does not affect admin dropdown behaviour.

### 2. `BookingLayout.js` — Admin/coach landing redirect

Using `location` (from `useLocation`, added in step 1), add a `useEffect` that redirects admins and coaches from `/booking` (exact) to `/booking/admin`:

```js
useEffect(() => {
  if (isAdmin && location.pathname === '/booking') {
    navigate('/booking/admin', { replace: true });
  }
}, [isAdmin, location.pathname, navigate]);
```

Note: the deletion of the unguarded parent nav links (step 1) is also what prevents admins from seeing the parent-facing Calendar/Shop/etc links — the redirect alone would not hide them.

### 3. `BookingLayout.css` — Cart link styling

Add an inverted/highlighted style for the cart link:

```css
.booking-layout__cart-link {
  background-color: var(--color-primary, #1a1a2e);
  color: #fff;
  border-radius: 4px;
  padding: 4px 10px;
  font-weight: 600;
}

.booking-layout__cart-link:hover,
.booking-layout__cart-link.active {
  background-color: var(--color-primary-dark, #e94560);
  color: #fff;
}
```

Adjust colours to match the app's existing palette once the exact values are known.

---

## Files Changed

- `frontend/src/pages/booking/BookingLayout.js`
- `frontend/src/pages/booking/BookingLayout.css`

No route changes, no backend changes.

---

## Out of Scope

- Mobile nav treatment (booking section appears to use a scrollable horizontal nav, not a hamburger menu — no separate mobile layout to update)
- Admin nav restructuring

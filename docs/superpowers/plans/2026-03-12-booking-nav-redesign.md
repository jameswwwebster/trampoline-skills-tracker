# Booking Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the parent-facing booking nav into grouped dropdowns, give the cart a distinct visual treatment, and redirect admins/coaches from `/booking` to `/booking/admin`.

**Architecture:** All changes are contained in `BookingLayout.js` and `BookingLayout.css`. The existing `openDropdown` state, `toggleDropdown` helper, and dropdown CSS classes are reused for the new parent dropdowns. A `useEffect` handles the admin redirect.

**Tech Stack:** React 18, React Router v6 (`NavLink`, `useLocation`, `useNavigate`), CSS custom properties

---

## Chunk 1: JS changes

### Task 1: Add `useLocation` and active-state variables

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`

- [ ] **Step 1: Add `useLocation` to the import**

  In `BookingLayout.js` line 2, change:
  ```js
  import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
  ```
  to:
  ```js
  import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
  ```

- [ ] **Step 2: Add the `useLocation` hook call and active-state variables**

  After the existing `const navigate = useNavigate();` line, add:
  ```js
  const location = useLocation();
  const isBookingsActive = location.pathname === '/booking' || location.pathname.startsWith('/booking/my-bookings');
  const isShopActive = location.pathname.startsWith('/booking/shop') || location.pathname.startsWith('/booking/my-orders');
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/pages/booking/BookingLayout.js
  git commit -m "feat: add useLocation and active-state vars to BookingLayout"
  ```

---

### Task 2: Replace flat parent nav links with grouped dropdowns

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`

The current flat links (inside `booking-layout__links`, before the `{isAdmin && ...}` block) look like this:

```jsx
<NavLink to="/booking" end>Calendar</NavLink>
{!isAdmin && cartCount > 0 && (
  <NavLink to="/booking/cart" className="booking-layout__cart-link">
    Cart ({cartCount})
  </NavLink>
)}
<NavLink to="/booking/my-bookings">My Bookings</NavLink>
<NavLink to="/booking/my-account">My Account</NavLink>
<NavLink to="/booking/shop">Shop</NavLink>
<NavLink to="/booking/my-orders">My Orders</NavLink>
<NavLink
  to="/booking/noticeboard"
  style={{ position: 'relative' }}
  onClick={() => setNoticeBanner(false)}
>
  Noticeboard
  {unreadCount > 0 && (
    <span className="booking-layout__unread-badge">{unreadCount}</span>
  )}
</NavLink>
```

- [ ] **Step 1: Replace those lines with the grouped parent nav**

  Manually select and delete **lines 105–124** of `BookingLayout.js` (the full block of flat `NavLink` elements — Calendar, Cart, My Bookings, My Account, Shop, My Orders, Noticeboard — including the `{!isAdmin && cartCount > 0 && ...}` cart conditional). Do not use find-and-replace on the snippet above; use line numbers. Replace with:

  ```jsx
  {!isAdmin && (
    <>
      {/* Bookings dropdown */}
      <div className="booking-layout__dropdown">
        <button
          className={`booking-layout__dropdown-btn${openDropdown === 'bookings' || isBookingsActive ? ' active' : ''}`}
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
          className={`booking-layout__dropdown-btn${openDropdown === 'shop' || isShopActive ? ' active' : ''}`}
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

      {/* Cart — standalone, conditional, visually inverted */}
      {cartCount > 0 && (
        <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
          Cart ({cartCount})
        </NavLink>
      )}
    </>
  )}
  ```

- [ ] **Step 2: Verify the admin block is still intact below this new block**

  The `{isAdmin && (...)}` block should be the next thing after the closing `)}` of the new parent block. Confirm it is untouched.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/pages/booking/BookingLayout.js
  git commit -m "feat: group parent booking nav into Bookings/Shop dropdowns"
  ```

---

### Task 3: Move `dropdownRef` to cover the full links row

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`

Currently `dropdownRef` is on the `booking-layout__admin-group` div. It needs to be on the `booking-layout__links` div so clicking outside closes parent dropdowns too.

- [ ] **Step 1: Move the ref**

  Change:
  ```jsx
  <div className="booking-layout__links">
  ```
  to:
  ```jsx
  <div className="booking-layout__links" ref={dropdownRef}>
  ```

  Then remove `ref={dropdownRef}` from the `booking-layout__admin-group` div inside the admin block.

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/pages/booking/BookingLayout.js
  git commit -m "fix: move dropdownRef to links row to close parent dropdowns on outside click"
  ```

---

### Task 4: Add admin redirect

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`

- [ ] **Step 1: Add the redirect `useEffect`**

  Add after the existing `useEffect` blocks (before the `return` statement):

  ```js
  useEffect(() => {
    if (isAdmin && location.pathname === '/booking') {
      navigate('/booking/admin', { replace: true });
    }
  }, [isAdmin, location.pathname, navigate]);
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/pages/booking/BookingLayout.js
  git commit -m "feat: redirect admins from /booking to /booking/admin"
  ```

---

## Chunk 2: CSS and verification

### Task 5: Update cart link CSS

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.css`

The existing `.booking-layout__cart-link` already applies an accent background and white text (the booking section uses `var(--booking-accent)`, not `var(--color-primary)` which belongs to the tracking section). Add a distinct hover state so it reads clearly as an interactive element:

- [ ] **Step 1: Update the cart link rule**

  Find the existing `.booking-layout__cart-link` block:
  ```css
  .booking-layout__cart-link {
    background: var(--booking-accent) !important;
    color: #fff !important;
    font-weight: 700;
    border-radius: var(--booking-radius);
  }
  ```

  Replace it with:
  ```css
  .booking-layout__cart-link {
    background: var(--booking-accent) !important;
    color: #fff !important;
    font-weight: 700;
    border-radius: var(--booking-radius);
    transition: filter 0.15s;
  }

  .booking-layout__cart-link:hover,
  .booking-layout__cart-link.active {
    filter: brightness(1.15);
    color: #fff !important;
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/pages/booking/BookingLayout.css
  git commit -m "style: improve cart link hover state in booking nav"
  ```

---

### Task 6: Manual verification

- [ ] **Step 1: Start the app locally**
  ```bash
  npm start --prefix frontend
  ```

- [ ] **Step 2: Log in as a parent and verify**
  - Nav shows: Bookings ▾, Shop ▾, Noticeboard, Account
  - Bookings dropdown opens and contains: Book, My Bookings
  - Shop dropdown opens and contains: Shop, My Orders
  - Clicking outside any dropdown closes it
  - Navigating to `/booking` highlights the Bookings button
  - Navigating to `/booking/my-orders` highlights the Shop button
  - Noticeboard shows unread badge when notices are unread
  - Cart item appears with inverted colour when cart has items
  - Cart disappears from nav when cart is empty

- [ ] **Step 3: Log in as a coach or admin and verify**
  - Going to `/booking` redirects to `/booking/admin` automatically
  - Admin nav (Sessions ▾, Members ▾, Shop Orders, Tools ▾) is intact and unchanged
  - Parent-facing links (Bookings, Shop, Noticeboard, Account) are not visible

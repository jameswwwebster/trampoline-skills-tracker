# Help Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two static help pages — one for parents at `/booking/help` and one for admins at `/booking/admin/help` — each reachable via a footer link in `BookingLayout.js`.

**Architecture:** Two new React page components (no API calls, no backend changes). A footer is added to `BookingLayout.js` with conditional links: parents see `/booking/help`, admins see `/booking/admin/help`. Both routes are registered as child routes under the existing `/booking` `<Route>` in `App.js`.

**Tech Stack:** React 18, React Router v6, existing `bk-*` CSS classes from `booking-shared.css`, `BookingLayout.css`.

---

## Chunk 1: Parent help page, footer link, and route

### Task 1: Create `HelpPage.js` and wire it up

**Files:**
- Create: `frontend/src/pages/booking/HelpPage.js`
- Modify: `frontend/src/pages/booking/BookingLayout.js`
- Modify: `frontend/src/App.js`

#### Step 1: Create `frontend/src/pages/booking/HelpPage.js`

The page uses `bk-page bk-page--lg` for layout and `bk-card` for each section. No imports beyond React.

```jsx
import React from 'react';
import './booking-shared.css';

export default function HelpPage() {
  return (
    <div className="bk-page bk-page--lg">
      <h2>Help</h2>

      <div className="bk-card">
        <h3>Bookings</h3>
        <p>Use the <strong>Book</strong> tab to view available sessions and add them to your cart. Once in your cart, proceed to checkout to confirm your bookings. You can view upcoming and past bookings under <strong>My Bookings</strong>.</p>
        <p>To cancel a booking, open it from My Bookings and use the cancel option. Cancellations within the club's notice period may not be eligible for a refund — check with your club.</p>
      </div>

      <div className="bk-card">
        <h3>Memberships</h3>
        <p>Memberships are set up by your club admin and linked to a gymnast. Once active, your membership renews monthly via the payment method on your account.</p>
        <p>If your membership shows <strong>Pending Payment</strong>, you need to complete payment setup from your Account page. If it shows <strong>Needs Payment Method</strong>, add a card to prevent your membership from lapsing.</p>
      </div>

      <div className="bk-card">
        <h3>Standing slots</h3>
        <p>A standing slot reserves the same session for your gymnast every week automatically. Your club admin assigns standing slots — contact them if you would like one set up or changed.</p>
        <p>Standing slot bookings appear in My Bookings like any other booking. You can cancel individual occurrences if your gymnast cannot attend.</p>
      </div>

      <div className="bk-card">
        <h3>Shop</h3>
        <p>Browse available products in the <strong>Shop</strong> tab. Add items to your cart and check out alongside any session bookings. You can view your order history under <strong>My Orders</strong>.</p>
      </div>

      <div className="bk-card">
        <h3>Account &amp; payments</h3>
        <p>Your Account page lets you manage your gymnasts' profiles and your payment method. The payment method on file is used for membership renewals and any outstanding charges.</p>
        <p>Outstanding charges appear in your cart. Pay them to restore the ability to make new bookings.</p>
      </div>

      <div className="bk-card">
        <h3>Noticeboard</h3>
        <p>The Noticeboard shows announcements from your club. Unread posts are highlighted with a badge on the nav link. Posts may have an expiry date — they are removed automatically once they expire.</p>
      </div>
    </div>
  );
}
```

#### Step 2: Add a footer to `BookingLayout.js`

The footer sits below `<main>` (after `<Outlet />`). It is conditional: parents see a link to `/booking/help`; admins see a link to `/booking/admin/help`. Add the import for `Link` — it is already imported at the top of the file.

Locate the closing section of the `return` in `BookingLayout.js`:

```jsx
      <main className="booking-layout__main">
        <Outlet />
      </main>
    </div>
```

Replace it with:

```jsx
      <main className="booking-layout__main">
        <Outlet />
      </main>
      <footer className="booking-layout__footer">
        <Link to={isAdmin ? '/booking/admin/help' : '/booking/help'}>Help</Link>
      </footer>
    </div>
```

Then add the footer CSS to `BookingLayout.css` (append at the end of the file):

```css
.booking-layout__footer {
  text-align: center;
  padding: 1.25rem 1rem;
  border-top: 1px solid var(--booking-border);
  font-size: 0.82rem;
}

.booking-layout__footer a {
  color: var(--booking-muted);
  text-decoration: none;
}

.booking-layout__footer a:hover {
  color: var(--booking-accent);
  text-decoration: underline;
}
```

#### Step 3: Register the route in `App.js`

Add the import near the other booking page imports (around line 51):

```js
import HelpPage from './pages/booking/HelpPage';
```

Add the route inside the `/booking` `<Route>` block, after the `noticeboard` route (around line 221):

```jsx
<Route path="help" element={<HelpPage />} />
```

#### Step 4: Manual verification

- Log in as a parent, navigate to `/booking/help` — page renders with all six sections.
- Footer "Help" link is visible on every booking page and navigates correctly.
- No console errors.

#### Step 5: Commit

```bash
git add frontend/src/pages/booking/HelpPage.js \
        frontend/src/pages/booking/BookingLayout.js \
        frontend/src/pages/booking/BookingLayout.css \
        frontend/src/App.js
git commit -m "feat: add parent help page at /booking/help with footer link"
```

---

## Chunk 2: Admin help page and route

### Task 2: Create `AdminHelpPage.js` and wire it up

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminHelpPage.js`
- Modify: `frontend/src/App.js`

#### Step 1: Create `frontend/src/pages/booking/admin/AdminHelpPage.js`

The page follows the same `bk-page bk-page--lg` / `bk-card` pattern. The Automation section uses `bk-table` for the reference table.

```jsx
import React from 'react';
import '../booking-shared.css';

export default function AdminHelpPage() {
  return (
    <div className="bk-page bk-page--lg">
      <h2>Admin Help</h2>

      <div className="bk-card">
        <h3>Members</h3>
        <p>The Members page lists all registered parents and gymnasts. You can edit profiles, assign credits, manage memberships, and view booking history per gymnast. Use the search box to filter by name or email.</p>
        <p>Removed members are accessible via the Removed Members tab at the bottom of the page. Accounts are automatically deleted after 6 months of inactivity.</p>
      </div>

      <div className="bk-card">
        <h3>Sessions</h3>
        <p>The Sessions view shows all upcoming session instances. Use <strong>Session Management</strong> to create and edit session templates — each template generates daily instances automatically. Use <strong>Closures</strong> to block out dates so no sessions are generated for that period.</p>
      </div>

      <div className="bk-card">
        <h3>Register</h3>
        <p>Open any session instance to access the register. Mark gymnasts as present or absent. The register can be used on the day to track attendance and is saved in real time.</p>
      </div>

      <div className="bk-card">
        <h3>Bookings</h3>
        <p>Bookings are created by parents via the calendar. From a session instance you can also make bookings on behalf of a member. PENDING bookings that are not checked out within 2 hours are cancelled automatically by the stale booking cleanup job.</p>
      </div>

      <div className="bk-card">
        <h3>Charges &amp; credits</h3>
        <p>Use <strong>Credits &amp; Charges</strong> to issue ad-hoc credits or charges to members. Credits can have an expiry date and are applied automatically at checkout. Overdue charges block new bookings until paid.</p>
      </div>

      <div className="bk-card">
        <h3>Shop</h3>
        <p>Manage shop products and view orders under <strong>Shop Orders</strong>. Orders are fulfilled manually — update the order status once dispatched or collected.</p>
      </div>

      <div className="bk-card">
        <h3>Noticeboard</h3>
        <p>Post announcements via <strong>Messages</strong>. Messages can be scheduled for future delivery, targeted to specific recipient groups, and given an expiry date. The scheduled message delivery job runs every minute to send queued posts.</p>
        <p>Use <strong>Recipient Groups</strong> to define reusable audiences (e.g. "Monday session parents") for targeted messages.</p>
      </div>

      <div className="bk-card">
        <h3>Automation reference</h3>
        <p>The following background jobs run automatically. All times are server time (UTC).</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="bk-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Schedule</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Session generation</td>
                <td>Daily 02:00</td>
                <td>Generates session instances from active templates</td>
              </tr>
              <tr>
                <td>Membership activation</td>
                <td>Daily 01:00</td>
                <td>Activates SCHEDULED memberships on their start date</td>
              </tr>
              <tr>
                <td>Waitlist expiry</td>
                <td>Every 15 min</td>
                <td>Expires stale waitlist offers and offers the spot to the next person in the queue</td>
              </tr>
              <tr>
                <td>Stale booking cleanup</td>
                <td>Every hour</td>
                <td>Cancels PENDING bookings abandoned for 2 or more hours</td>
              </tr>
              <tr>
                <td>Weekly session reminder</td>
                <td>Monday 08:00</td>
                <td>Emails parents about available sessions for the coming week</td>
              </tr>
              <tr>
                <td>Membership payment reminder</td>
                <td>Daily 09:00</td>
                <td>Reminds PENDING_PAYMENT members to add a payment method</td>
              </tr>
              <tr>
                <td>Scheduled message delivery</td>
                <td>Every minute</td>
                <td>Sends noticeboard messages that are scheduled for delivery</td>
              </tr>
              <tr>
                <td>Inactivity warning &amp; deletion</td>
                <td>Daily 02:30</td>
                <td>Warns members at ~5.75 months of inactivity; deletes their account at 6 months</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2: Register the route in `App.js`

Add the import near the other admin page imports (around line 67):

```js
import AdminHelpPage from './pages/booking/admin/AdminHelpPage';
```

Add the route inside the `/booking` `<Route>` block, after the `admin/charges` route (around line 224):

```jsx
<Route path="admin/help" element={<AdminHelpPage />} />
```

#### Step 3: Manual verification

- Log in as an admin, navigate to `/booking/admin/help` — page renders with all sections and the automation table.
- Footer "Help" link from any admin page navigates to `/booking/admin/help`.
- Footer "Help" link from a parent-view page navigates to `/booking/help`.
- No console errors.

#### Step 4: Commit

```bash
git add frontend/src/pages/booking/admin/AdminHelpPage.js \
        frontend/src/App.js
git commit -m "feat: add admin help page at /booking/admin/help with automation reference table"
```

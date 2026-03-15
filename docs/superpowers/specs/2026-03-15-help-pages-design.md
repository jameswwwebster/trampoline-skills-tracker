# Help Pages — Design Spec

**Date:** 2026-03-15

## Goal

Provide reference pages for parents and coaches/admins listing the features available to them and how to access each one. Accessible via footer links in each layout.

## Architecture

Two static React pages — no backend, no database. A footer link is added to `BookingLayout` (parents) and the admin layout. Content is hardcoded in the components.

## Pages

### Parent help — `/booking/help`

Accessible from a "Help" footer link in `BookingLayout`.

Sections:

| Section | Content |
|---------|---------|
| Bookings | How to view the calendar, book a session, cancel a booking, and what happens when a session is full (waitlist) |
| Memberships | What a membership is, who it's available to, what ACTIVE / SCHEDULED / PENDING PAYMENT / PAUSED status means |
| Standing slots | What a standing slot is, how it relates to membership, and where to see your gymnast's slots |
| Shop | How to browse products, add to cart, and complete checkout |
| Account & payments | How to view your account, add/update a payment method, view and pay outstanding charges, and view credit balance |
| Noticeboard | How to view announcements from the club |

### Admin / coach help — `/booking/admin/help`

Accessible from a "Help" footer link in the admin layout. This page is thorough — coaches use it as a reference and need to understand both the features and the background automation that affects them.

#### Feature sections

| Section | Content |
|---------|---------|
| Members | How to find a member; view their details, consents, BG insurance and health notes; manage membership (create, pause, resume, cancel, edit amount); manage standing slots (add, remove, pause); and remove a gymnast |
| Sessions | How to create and edit session templates (day, time, capacity, type, price, age restriction); view booked gymnasts per session; open the attendance register |
| Register | How to take attendance: navigate via the Register nav link (active during a session ±15 min) or via the session detail; tap to mark Present/Absent; register is always editable after the session |
| Bookings | How to view individual bookings, see booking status (CONFIRMED / PENDING / CANCELLED), and view booking history |
| Charges & credits | How to assign a charge to a member (amount, description); how to assign a credit; how charges appear in a parent's checkout and offset their cart total; what happens when a charge is overdue (booking is blocked) |
| Shop | How to manage products (create, edit, toggle active); view and advance order status (PENDING → PROCESSING → SHIPPED → DELIVERED) |
| Noticeboard | How to post an announcement; how to target recipients (all members, members-only, specific groups); how to schedule a post for a future date/time |

#### Automation reference

Coaches should understand what runs automatically so they can anticipate system behaviour and diagnose unexpected events.

| Job | Schedule | What it does |
|-----|----------|-------------|
| Session generation | Daily at 02:00 | Generates session instances for upcoming weeks based on active templates. New templates are picked up the next morning. |
| Membership activation | Daily at 01:00 | Activates any SCHEDULED membership whose start date has arrived. Standing slots attached to that membership become active from the same date. |
| Waitlist expiry | Every 15 minutes | Expires waitlist offers that have not been accepted within the offer window. The next person on the waitlist is automatically offered the spot. |
| Stale booking cleanup | Every hour | Cancels PENDING bookings (abandoned checkouts) that are more than 2 hours old. Credits used on cancelled bookings are restored. |
| Weekly session reminder | Monday at 08:00 | Emails parents about sessions with available spots in the coming week. Only sent to parents who have at least one gymnast without an active membership (members are assumed to have standing slots). |
| Membership payment reminder | Daily at 09:00 | Emails guardians whose membership is in PENDING_PAYMENT status reminding them to add a payment method. |
| Scheduled message delivery | Every minute | Sends noticeboard messages that were scheduled for a future date/time. |
| Inactivity warning & deletion | Daily at 02:30 | Warns accounts that have been inactive for ~5.75 months; deletes accounts inactive for 6 months. |

## Implementation

Two new files:
- `frontend/src/pages/booking/HelpPage.js` — parent help
- `frontend/src/pages/booking/admin/AdminHelpPage.js` — admin help

Both are plain React components with no props. Content is inline JSX — no CMS, no markdown parsing.

Routes added to the existing React Router config:
- `/booking/help` → `HelpPage`
- `/booking/admin/help` → `AdminHelpPage`

Footer links added to:
- `BookingLayout.js` — "Help" link pointing to `/booking/help`
- Admin layout — "Help" link pointing to `/booking/admin/help`

## Testing

Manual verification:
- Footer "Help" link visible on parent booking pages, navigates to `/booking/help`
- Footer "Help" link visible on admin pages, navigates to `/booking/admin/help`
- Both pages render all sections without errors
- Automation reference table visible on admin help page with correct schedules

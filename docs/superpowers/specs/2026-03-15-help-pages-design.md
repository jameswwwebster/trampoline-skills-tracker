# Help Pages — Design Spec

**Date:** 2026-03-15

## Goal

Provide simple reference pages for parents and coaches/admins listing the features available to them and how to access each one. Accessible via footer links in each layout.

## Architecture

Two static React pages — no backend, no database. A footer link is added to `BookingLayout` (parents) and the admin layout. Content is hardcoded in the components.

## Pages

### Parent help — `/booking/help`

Accessible from a "Help" footer link in `BookingLayout`.

Sections:

| Section | Content |
|---------|---------|
| Bookings | How to view the calendar, book a session, cancel a booking |
| Standing slots | What a standing slot is, where to see your gymnast's slots |
| Shop | How to browse and purchase items |
| Account & payments | How to view your account, payment method, outstanding charges |
| Memberships | What a membership is, how to view your gymnast's membership status |

### Admin / coach help — `/booking/admin/help`

Accessible from a "Help" footer link in the admin layout.

Sections:

| Section | Content |
|---------|---------|
| Members | How to find a member, view their details, manage membership and slots |
| Sessions | How to manage session templates, view bookings, open the register |
| Bookings | How to view and manage individual bookings |
| Charges & credits | How to assign charges and credits to members |
| Shop | How to manage orders and products |
| Noticeboard | How to post announcements and target specific groups |
| Register | How to take attendance during a session |

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

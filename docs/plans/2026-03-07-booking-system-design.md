# Booking System Design

**Date:** 2026-03-07
**Status:** Approved

## Overview

A booking system for the trampoline club, hosted within the existing app under a separate `/booking/...` route namespace. Handles two types of attendance:

1. **Open slot bookings** — up to 12 casual slots per session, booked and paid online in advance
2. **Monthly memberships** — recurring members billed monthly, no pre-booking required

## Architecture

### Hosting

Single Render service — same React frontend build, same Express backend, same PostgreSQL database. The booking system lives at `/booking/...` (frontend routes) and `/api/booking/...` (backend routes). No new Render services needed. No overlap with existing app sections.

Responsive design required — all booking UI must work on mobile and desktop.

### Session Timetable

Fixed weekly timetable (7 sessions):

| Day       | Time  |
|-----------|-------|
| Tuesday   | 17:00 |
| Tuesday   | 18:00 |
| Wednesday | 17:00 |
| Wednesday | 18:00 |
| Thursday  | 17:00 |
| Thursday  | 18:00 |
| Thursday  | 19:00 — **16+ only** |

All sessions are 1 hour. Open slots default to 12 per session.

## Data Models

### SessionTemplate
Defines a recurring weekly slot.

- `id`, `clubId`
- `dayOfWeek` (0–6)
- `startTime` (HH:MM)
- `endTime` (HH:MM)
- `openSlots` (default: 12)
- `minAge` (nullable — 16 for Thu 19:00, null otherwise)
- `isActive`

### SessionInstance
A generated occurrence of a template for a specific date.

- `id`, `templateId`, `date`
- `openSlotsOverride` (nullable — overrides template capacity for this date)
- `cancelledAt` (nullable — set when cancelled)
- `cancellationReason`

### Booking
One transaction per parent per session instance.

- `id`, `userId` (parent), `sessionInstanceId`
- `stripePaymentIntentId`
- `status` (PENDING | CONFIRMED | CANCELLED)
- `totalAmount` (in pence)
- `createdAt`

### BookingLine
One row per gymnast within a booking.

- `id`, `bookingId`, `gymnastId`
- `amount` (£6.00 in pence)

### Credit
Issued when a booking is cancelled; redeemable on any future booking.

- `id`, `userId`
- `amount` (in pence)
- `expiresAt` (1 month from creation)
- `usedAt`, `usedOnBookingId` (nullable)
- `sourceBookingId` (the cancelled booking that generated this credit)

### Membership
Monthly recurring membership — not tied to a specific session.

- `id`, `gymnastId`, `clubId`
- `monthlyAmount` (custom, in pence — set by admin)
- `stripeSubscriptionId`
- `status` (ACTIVE | CANCELLED | PAUSED)
- `startDate`

### ClosurePeriod
Blocks all sessions for a date range.

- `id`, `clubId`
- `startDate`, `endDate`
- `reason` (e.g. "Christmas 2025")
- `createdAt`

## Key Flows

### Rolling Session Generation

A daily cron job ensures session instances exist for the next 4 weeks. For each `SessionTemplate`:

1. Calculate dates for the next 4 weeks matching the template's day of week
2. Skip any dates that fall within an active `ClosurePeriod`
3. Create `SessionInstance` records that don't already exist

### Booking Flow (Parent)

1. Parent opens the monthly calendar view — days with available open slots are highlighted; closure periods are greyed out
2. Parent clicks a date — sees the sessions for that day with remaining slot counts
3. Parent selects a session — picks which gymnasts to bring (checkbox list from their linked gymnasts)
4. Thu 19:00 session is hidden or disabled if any selected gymnast is under 16
5. System checks for unexpired credits — displayed and automatically applied (oldest first)
6. Remaining balance charged via Stripe Payment Intent
7. Booking created with status PENDING; Stripe webhook confirms payment → status → CONFIRMED

### Cancellation & Credits

When a parent cancels a booking:

1. One `Credit` of £6 created per gymnast in the booking
2. Each credit expires 1 month from cancellation date
3. No Stripe refund issued
4. Booking status set to CANCELLED

When an admin creates a `ClosurePeriod`:

1. All `SessionInstance` records in the date range are cancelled
2. All CONFIRMED bookings for those instances are cancelled
3. Credits are automatically issued to all affected parents

### Monthly Memberships

- Admin adds a gymnast as a member, sets a custom monthly amount
- Stripe Subscription created, billed on the 1st of each calendar month
- Members do not need to pre-book sessions — they just show up
- Members do not consume open slots
- Admin can cancel or pause a membership

### Pricing

- Open slot: **£6.00 per gymnast per session**
- Membership: **custom amount per gymnast per month** (set by admin)

## Stripe Integration

| Use case | Stripe mechanism |
|---|---|
| Open slot booking | Payment Intent + webhook to confirm |
| Credit applied (full) | No charge created |
| Credit applied (partial) | Payment Intent for remaining balance |
| Monthly membership | Subscription, billed 1st of month |

## Frontend Pages (under `/booking/...`)

| Path | Description |
|---|---|
| `/booking` | Monthly calendar — entry point |
| `/booking/session/:instanceId` | Session detail + gymnast picker + checkout |
| `/booking/confirmation/:bookingId` | Post-payment confirmation |
| `/booking/my-bookings` | Parent's upcoming and past bookings, cancel option |
| `/booking/my-credits` | Parent's available credits |
| `/booking/admin` | Admin dashboard: sessions, bookings, closures, memberships |
| `/booking/admin/memberships` | Manage monthly members |
| `/booking/admin/closures` | Manage closure periods |

## Out of Scope (for now)

- 1:1 coaching slots
- Competition payment flows
- Waitlists

# Permissions & Audit Log Design

Date: 2026-03-08

## Overview

Tighten coach vs admin permissions in the booking system, and add a full audit log for all staff actions with an admin-only view page.

## 1. Permission Changes

Two routes currently allow coaches to perform admin-only destructive actions. These need restricting to `CLUB_ADMIN` only:

- `DELETE /api/booking/admin/gymnasts/:id` — change `requireRole(['CLUB_ADMIN', 'COACH'])` to `requireRole(['CLUB_ADMIN'])`
- `DELETE /api/booking/admin/members/:userId` — same change

All other booking routes remain open to both `CLUB_ADMIN` and `COACH`:
- Add/edit members
- Manage session instances (cancel occurrences, attendance, waitlist)
- Create/delete credits and memberships
- Manually book or cancel bookings
- Issue refunds

## 2. Audit Log Data Model

New `AuditLog` table in Prisma schema:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String
  entityType String
  entityId   String?
  metadata   Json?
  clubId     String
  club       Club     @relation(fields: [clubId], references: [id])
  createdAt  DateTime @default(now())

  @@index([clubId, createdAt])
  @@index([userId])
}
```

- `userId` — staff member who performed the action (kept even if user is deleted via soft reference)
- `action` — namespaced free-form string (e.g. `booking.cancel`, `credit.create`)
- `entityType` — affected model (e.g. `"Booking"`, `"Credit"`, `"User"`)
- `entityId` — affected record ID (nullable for bulk/non-entity actions)
- `metadata` — JSON blob for extra context: amounts, names, reasons, before/after values
- `clubId` — scopes log to the correct club

## 3. Actions Logged

Staff-initiated actions only. Self-service member actions and Stripe webhook events are excluded.

| Action | Trigger |
|---|---|
| `member.create` | Staff adds a new member |
| `member.edit` | Staff edits a member profile |
| `member.delete` | Admin deletes a member or gymnast |
| `booking.create` | Staff manually creates a booking |
| `booking.cancel` | Staff cancels a booking |
| `credit.create` | Staff adds a credit to a member |
| `credit.delete` | Staff removes a credit |
| `membership.create` | Staff adds a membership |
| `membership.delete` | Staff removes a membership |
| `refund.issue` | Staff issues a refund |
| `session.cancel` | Staff cancels a session instance |

Each log entry is written inline in the route handler immediately after the action succeeds.

## 4. Admin UI

**Route:** `/booking/admin/audit-log`
**Access:** `CLUB_ADMIN` only
**Nav:** Linked from booking admin navigation

### Display

Reverse-chronological table with columns:
- Date/time
- Staff member name
- Action (human-readable label, e.g. "Cancelled booking")
- Affected member (name, linked to their profile)
- Details (key metadata inline, e.g. "£10 credit removed — reason: duplicate charge")

### Filtering (server-side)

- Date range
- Staff member
- Action type

Filters are applied in the database query so pagination always reflects the correct filtered total.

### Pagination

Infinite scroll — 25 entries per page, additional entries load automatically as the user scrolls to the bottom.

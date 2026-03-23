# Waitlist UX — Design Spec
**Date:** 2026-03-23

## Overview

The waitlist backend (join/leave routes, offer logic, 2-hour expiry cron) is already built. This spec covers the missing pieces: email notifications, a smarter offer strategy based on session proximity, booking route enforcement, frontend UI improvements, and a My Waitlist page.

---

## 1. Offer Logic (`waitlistService.processWaitlist`)

When a cancellation frees a slot, offer strategy depends on how far away the session is:

**>6 hours out — exclusive offer**
- Fetch the next `WAITING` entry (`take: 1`, ordered by `createdAt asc`)
- Set to `OFFERED` with `offerType: EXCLUSIVE` and a 2-hour `offerExpiresAt`
- Send the offered user an email (see Section 3)

**≤6 hours out — open offer**
- Fetch ALL `WAITING` entries (no `take` limit)
- Set all to `OFFERED` with `offerType: OPEN`; leave `offerExpiresAt` as null (no expiry window — the session is imminent, the race resolves when someone books)
- Send each waiting user an email (see Section 3)

`expireStaleOffers` queries `{ status: 'OFFERED', offerExpiresAt: { lt: new Date() } }` — null `offerExpiresAt` on open offers means they are never accidentally expired by this cron. No changes needed to `expireStaleOffers`.

`processWaitlist` must include `instance.template.club` in its query to check `club.emailEnabled` before sending emails.

---

## 2. Booking Route (`bookings.js`)

**Capacity bypass for OFFERED users**
Before the capacity check (`bookedCount + activeCommitments + gymnastIds.length > capacity`), check if the requesting user has an active `OFFERED` entry for the session. If so, skip the capacity check entirely and allow the booking through.

**Post-booking cleanup**
After a successful booking by an OFFERED user:
- Expire all other `OFFERED` entries for that session (covers the open case)
- Call `processWaitlist` to cascade to the next `WAITING` person if applicable
- Mark the user's own `WaitlistEntry` as `BOOKED`

---

## 3. Email Notifications

Both emails are gated by `club.emailEnabled`. Sent from `waitlistService.processWaitlist` at the point of transitioning entries to `OFFERED`.

**Exclusive offer (>6hrs):**
- Subject: `A slot has opened up — [Day, Date] at [Time]`
- Body: A spot has become available in your session on [date] at [time]. It's being held for you until [expiry time]. Open the app to claim it.

**Open offer (≤6hrs):**
- Subject: `Last-minute slot — [Day, Date] at [Time]`
- Body: A spot has come up in today's session at [time]. Since it's close to session time, we've let everyone on the waitlist know — first to book gets it. Open the app to claim it.

---

## 4. Data Model

Add `offerType` field to `WaitlistEntry`:

```prisma
enum WaitlistOfferType {
  EXCLUSIVE
  OPEN
}

model WaitlistEntry {
  // existing fields...
  offerType     WaitlistOfferType?
}
```

`offerType` is null while status is `WAITING`, set when transitioning to `OFFERED`.

`CLAIMED` already exists in the `WaitlistStatus` enum — use it (not a new `BOOKED` value) when marking a successfully claimed offer.

**Migration note:** `WaitlistOfferType` is a new enum. Per project convention, `ALTER TYPE ... ADD VALUE` cannot run in the same transaction as usage of the new enum value — split into two migration files: one to create the enum, one to add the `offerType` column.

---

## 5. Session Detail UI (`SessionDetail.js`)

The existing waitlist panel already handles `WAITING` and `OFFERED` states but the `OFFERED` state has no book button — it just says "go back and book." Replace this with an inline booking flow:

**WAITING state** — no change. "You're on the waitlist. We'll let you know if a slot becomes available." + Leave waitlist button.

**OFFERED state** — replace the current message with:
- Exclusive: "A slot has been held for you until [time]."
- Open: "A slot has come up close to session time — we've let everyone on the waitlist know. First to book gets it."
- Gymnast selector + Book Now button (same flow as the normal booking UI)
- The capacity counter stays at 0 for everyone else (correct — slot isn't held in data)

---

## 6. My Waitlist Page (`/booking/my-waitlist`)

New page using the existing `GET /api/booking/waitlist/my` endpoint. Shows active entries only (no historical).

**Per entry:**
- **WAITING** — session name, date/time, "You're on the waitlist" + Leave button
- **OFFERED** — session name, date/time, "A slot is available — claim it before [time]" (omit time for open offers) + Book Now button linking to SessionDetail

Linked from booking nav. No new API endpoint needed.

---

## 7. Help Pages

Both member and admin help pages updated to cover:
- What happens when a session is full (join waitlist prompt)
- How the waitlist works (queue order, offers)
- The difference between a held slot (>6hrs) and a last-minute open offer (≤6hrs)
- The 2-hour claim window for exclusive offers
- What the email notifications look like

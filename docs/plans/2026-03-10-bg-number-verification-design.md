# BG Number Verification — Design

## Goal

Replace the boolean `bgInsuranceConfirmed` field with a full BG membership number field, coach verification workflow, grace period enforcement, and parent-facing guidance.

## Architecture

Schema change on `Gymnast`, new API endpoints for setting and verifying numbers, updated booking gate, new daily cron, updated parent UI (`MyChildren.js`), updated admin inline view (`AdminMembers.js`), and a new dedicated admin "BG Numbers" page.

---

## Section 1: Data model

### Gymnast schema — remove

```
bgInsuranceConfirmed         Boolean   @default(false)
bgInsuranceConfirmedAt       DateTime?
bgInsuranceConfirmedBy       String?
```

### Gymnast schema — add

```
bgNumber               String?
bgNumberStatus         BgNumberStatus?   // PENDING | VERIFIED | INVALID (null = no number yet)
bgNumberEnteredAt      DateTime?
bgNumberEnteredBy      String?           // userId
bgNumberVerifiedAt     DateTime?
bgNumberVerifiedBy     String?
```

New enum: `enum BgNumberStatus { PENDING VERIFIED INVALID }`

No `bgNumberReminderSentAt` — daily cron sends the full pending list every day without tracking.

### Migration

Gymnasts with `bgInsuranceConfirmed = true` → set `bgNumberStatus = VERIFIED` (they remain unblocked; coaches can add their actual number later).

---

## Section 2: Verification workflow

### Entry by parent/guardian

- First entry or previous status was `VERIFIED` → status = `PENDING`, grace period = **14 days** from `bgNumberEnteredAt`
- Re-entry after `INVALID` → status = `PENDING`, grace period = **3 days** (closes looping abuse window)

### Entry by staff (CLUB_ADMIN or COACH)

- Status = `VERIFIED` immediately; `bgNumberVerifiedAt` and `bgNumberVerifiedBy` set

### Coach marks verified

- Status → `VERIFIED`; `bgNumberVerifiedAt` + `bgNumberVerifiedBy` recorded

### Coach marks invalid

- Status → `INVALID`; gymnast immediately blocked from booking
- Email sent to parent:
  > "We weren't able to confirm [Name]'s British Gymnastics membership number. Please check it was entered correctly, and make sure you've added Trampoline Life as a club on GymNet — if we can't see your membership from our end, we're unable to confirm it."

### Daily cron

Runs every morning. If any gymnasts have `bgNumberStatus = PENDING`, send one consolidated email to all coaches listing them (gymnast name, parent name, number, days since entry). Only sends if the list is non-empty.

---

## Section 3: Booking gate

A gymnast is blocked from being selected if **any** of the following are true:

1. `bgNumber IS NULL` AND `pastSessionCount >= 2`
2. `bgNumberStatus = INVALID`
3. `bgNumberStatus = PENDING` AND `bgNumberEnteredAt < NOW() - 14 days` (or 3 days if re-entry after INVALID — determined by grace period logic at entry time)

The 2-session threshold gives new joiners a couple of sessions while they sort BG registration.

**Note:** Grace period length is not stored separately — it's inferred from context. Simpler: store `bgNumberGraceDays Int? @default(14)` set at entry time (14 for first entry, 3 for re-entry after INVALID). Booking gate checks `bgNumberEnteredAt < NOW() - bgNumberGraceDays days`.

---

## Section 4: Parent UI — `MyChildren.js`

Replace `InsuranceSection` with `BgNumberSection` for each gymnast.

### Fewer than 2 sessions attended

Informational only — not blocking. Show guidance text and a number entry field, but no warning.

### 2+ sessions, no number entered

- Warning: number required to continue booking
- Guidance text (see below)
- Input + save

### Number entered, status PENDING or VERIFIED

- Shows the number (no status label shown to parent)
- Small "Update" link for typo corrections

### Status INVALID

- Red warning: "Your BG number couldn't be confirmed. Please check it was entered correctly and make sure you've added Trampoline Life as a club on GymNet."
- Re-entry input (submitting resets to PENDING with 3-day grace)

### Guidance text (shown in all states)

> "British Gymnastics membership provides personal accident insurance cover for all participants. It's required for everyone who trains with us.
>
> Start with **Community** membership at [british-gymnastics.org/memberships](https://www.british-gymnastics.org/memberships). Upgrade to **Competitive** if you enter regional competitions, or **National** for national competitions.
>
> If you already have BG membership with another club, you don't need to purchase it again — just log in to GymNet and add Trampoline Life as a club so we can see your membership from our end."

---

## Section 5: Admin/coach UI

### Inline in `AdminMembers.js` — per gymnast row

- BG number shown (or "No number")
- Status badge: PENDING / VERIFIED / INVALID
- Text input to set/update number (staff entry auto-verifies)
- Verify and Mark Invalid buttons shown when status is PENDING

### New "BG Numbers" admin page

Route: `/booking/admin/bg-numbers`

Two sections:

1. **Pending verification** — gymnasts with `bgNumberStatus = PENDING`, sorted by days since entry (oldest first). Columns: gymnast, parent, number, days pending, Verify / Mark Invalid.
2. **Missing number** — gymnasts with no number and 2+ sessions. Columns: gymnast, parent, sessions attended.

Linked from admin nav.

---

## Section 6: Emails

### Daily coach digest (if any pending)

**To:** all COACH and CLUB_ADMIN users in the club

**Subject:** BG numbers awaiting verification

**Body:** table of gymnast name, parent name, BG number, days since entry. Link to the BG Numbers admin page.

### Invalid number notification (sent immediately on coach action)

**To:** parent/guardian of the gymnast

**Subject:** Action needed — BG membership number for [Name]

**Body:** as specified above — check number, check GymNet club link.

---

## Files touched

**Backend:**
- `prisma/schema.prisma` — add fields, add enum, remove old fields
- `prisma/migrations/` — two migrations: add new fields, drop old (separate to avoid enum-in-transaction issue)
- `routes/gymnasts.js` — add `PATCH /:id/bg-number` and `PATCH /:id/bg-number/verify` endpoints
- `routes/booking/bookings.js` — update booking gate logic
- `server.js` — add daily BG pending cron
- `services/emailService.js` — add BG digest email and invalid notification email templates

**Frontend:**
- `MyChildren.js` — replace InsuranceSection with BgNumberSection
- `SessionDetail.js` — update block condition and messaging
- `admin/AdminMembers.js` — add BG number inline controls to GymnastRow
- `admin/AdminBgNumbers.js` — new page
- `BookingLayout.js` — add BG Numbers link to admin nav
- `utils/bookingApi.js` — add `setBgNumber`, `verifyBgNumber` methods

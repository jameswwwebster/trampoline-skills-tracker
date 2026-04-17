# Competition Entry Flow Redesign

## Goal

Simplify the competition entry lifecycle by moving all decisions (categories, price) to invite time, so guardians only need to accept and pay or decline — removing the current "coach reviews → sends invoice" middle step.

## Architecture

The ACCEPTED status is retired from the guardian-facing journey. New entries go INVITED → PAYMENT_PENDING (on guardian accept) → PAID. Existing ACCEPTED entries are left as-is; admins can still send invoices on them via the existing path during transition. No database migration is required.

The tier pricing calculation is also fixed: tiers are a replacement model (select the tier that matches the category count), not additive.

## Tech Stack

- Backend: Express + Prisma 5 + PostgreSQL
- Frontend: React 18
- Payments: Stripe (PaymentIntent + Elements inline)
- Email: Gmail SMTP via nodemailer

---

## Entry Status Flow (new)

```
INVITED → PAYMENT_PENDING (guardian clicks "Accept and pay")
        → DECLINED (guardian clicks "Decline")

PAYMENT_PENDING → PAID (Stripe payment confirmed)
               → PAID (admin "Mark paid" — offline/cash)
               → WAIVED (admin waives fee)
               → INVITED (admin "Re-invite" — resets to change categories or price)

PAID / DECLINED / WAIVED — terminal (admin can Re-invite from any)
```

The ACCEPTED status remains in the schema for backward compatibility but is never created by new code paths.

---

## Tier Pricing Fix

Tiers are a replacement model: the total cost is the single tier value that corresponds to the number of categories selected.

```
1 category  → tier[0]
2 categories → tier[1]
3 categories → tier[2]
N categories → tier[min(N-1, tiers.length-1)]
```

Example: tiers £65 / £85 / £105, 2 categories selected → suggested price = £85.

This replaces the current additive calculation everywhere it is used (invite form suggestion and any remaining "send invoice" calculation).

---

## Admin Invite Form Changes

Categories and price are now required fields on the invite form — an invite cannot be sent without both.

**Form fields:**
- Gymnast(s) — existing, unchanged
- Categories — multi-select, at least one required
- Suggested price — auto-populated from tier calculation based on number of categories selected, shown as an editable number input (pounds). Coach can override.

The per-gymnast price override that previously lived on the "send invoice" screen is removed from that screen and is only available here at invite time.

**Invite email** (sent immediately on form submit) is updated to include:
- Categories entered (bulleted list)
- Total cost
- CTA button: "Accept and pay — £X"
- A note: "Entries will not be submitted to the competition organiser until payment is complete"

---

## Admin Entries Tab Changes

The "Confirm & send invoice" button is removed from ACCEPTED entries. No new entries will reach ACCEPTED state.

**PAYMENT_PENDING entry actions:**
- **Send reminder** — re-sends the payment email (replaces "Resend invoice")
- **Waive** — marks entry as WAIVED with optional reason
- **Mark paid** — records offline/cash payment with optional amount and note
- **Re-invite** — resets entry to INVITED and sends a new invite email

All other entry states (PAID, DECLINED, WAIVED) retain their existing actions (Re-invite, toggle Submitted to organiser on PAID).

---

## Guardian Entry Page Changes

### INVITED state

The category-selection form is removed. The page becomes a read-only summary:

- Competition name, location, date
- Gymnast name
- Categories (list, set by coach — not editable by guardian)
- Total cost
- Notice: *"Entries will not be submitted to the competition organiser until payment is complete."*
- **Accept and pay** button — moves entry to PAYMENT_PENDING and opens Stripe payment form inline on the same page
- **Decline** button — moves entry to DECLINED

### PAYMENT_PENDING state

Unchanged from current implementation: Stripe Elements payment form shown inline. Guardian can complete payment or close the tab and return later. "Pay now" button visible on competitions list for any PAYMENT_PENDING entry.

### All other states

Unchanged (PAID, DECLINED, WAIVED confirmation cards remain as-is).

---

## My Competitions List Changes

Status label for PAYMENT_PENDING entries: **"Payment due"** — unchanged.

The action button for INVITED entries changes from "Respond to invite" to **"View invite"** (since there is no longer a form to fill in, just a page to read and respond from).

---

## Files to Change

| File | Change |
|---|---|
| `backend/routes/booking/competitionEntries.js` | Remove `confirm-invoice` endpoint (or keep but mark deprecated); update `accept` endpoint to set status PAYMENT_PENDING, create a Stripe PaymentIntent for the entry amount, and store the PI ID on the entry (same as what `confirm-invoice` previously did); rename `resend-invoice` to `send-reminder` |
| `backend/routes/booking/competitionEvents.js` | Make categories required on invite; apply fixed tier calculation to suggested price; include categories + price in invite email |
| `backend/services/emailService.js` | Update invite email template to include categories, total cost, and "Accept and pay" CTA; update/rename invoice email to "payment reminder" |
| `frontend/src/pages/booking/admin/AdminCompetitionDetail.js` | Invite form: add required categories + price fields with tier suggestion; entries tab: remove "Confirm & send invoice", rename "Resend invoice" to "Send reminder" |
| `frontend/src/pages/booking/CompetitionEntry.js` | INVITED state: remove category checkboxes, show read-only summary, change button to "Accept and pay"; wire accept to move straight to payment |
| `frontend/src/pages/booking/MyCompetitions.js` | Change INVITED action button label to "View invite" |

---

## Out of Scope

- Heat sheets, results, or any competition-day tooling
- Changes to competition event creation or category management
- Changes to the synchro pair invite flow (works the same way — each gymnast gets their own invite with categories + price set at invite time)
- Removing the ACCEPTED status from the database schema

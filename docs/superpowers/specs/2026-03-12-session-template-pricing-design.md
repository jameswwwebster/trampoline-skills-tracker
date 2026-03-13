# Session Template Pricing — Design Spec

**Date:** 2026-03-12

## Overview

Add a configurable price per gymnast to each session template. This replaces the hardcoded £6.00 constant used across the booking system and enables different sessions (e.g. private sessions, advanced classes) to have different prices.

## Database

Add `pricePerGymnast Int @default(600)` to the `SessionTemplate` model (pence, e.g. 600 = £6.00). The default ensures all existing templates remain correctly priced without a data migration.

No change to `SessionInstance` — there is no per-instance price override (parallel to `openSlotsOverride`). Price is always read from the template at booking time and stored in `BookingLine.amount`.

## Backend

### Template routes (`routes/booking/templates.js`)

- Add `pricePerGymnast: Joi.number().integer().min(1).required()` to `templateSchema`
- Include `pricePerGymnast` in POST create and PUT update data
- GET already returns all template fields; no change needed there

### Booking routes (`routes/booking/bookings.js`)

Replace all uses of hardcoded `PRICE_PER_GYMNAST_PENCE = 600` with `instance.template.pricePerGymnast`. Affected locations:

- `POST /` — single booking: `totalAmount` and `BookingLine.amount`. `instance` is in scope throughout, straightforward substitution.
- `POST /batch` — validation loop stores entries into `validatedItems`. The `instance` variable only exists inside the validation loop, so `pricePerGymnast` must be stored on each `validatedItems` entry (alongside `itemAmount`) so it is accessible in the separate booking-creation loop that runs afterwards. Both `itemAmount` and the per-line `amount` in the creation loop must use this stored value.
- `POST /combined` — same pattern as `/batch`: `validatedSessions` entries must carry `pricePerGymnast` from the validation loop into the creation loop.

All three routes already `include: { template: true }` on the `SessionInstance` query, so no extra DB query is needed.

**Credit on cancellation (line ~540):** The hardcoded `amount: 600` is inside a `booking.lines.map(() => ...)` lambda. The fix requires two changes: (1) capture the line parameter — change `() =>` to `(line) =>`, and (2) use `line.amount` for the credit amount. This ensures a cancellation credit reflects what was originally paid, regardless of whether the template price has since changed.

### Sessions list route (`routes/booking/sessions.js`)

Add `pricePerGymnast: instance.template.pricePerGymnast` to the object returned inside the result map for each session. The template is already included in the query, so no query change is needed.

## Frontend

### `SessionTemplates.js`

- Add `pricePerGymnast: '6'` to `EMPTY_FORM` — the form stores and displays the value in **pounds** (e.g. `'6'` = £6.00), not pence
- Add a price input to the create/edit form: number input, step 0.01, min 0.01, label "Price per gymnast (£)"
- `buildPayload()`: include `pricePerGymnast: Math.round(parseFloat(form.pricePerGymnast) * 100)` to convert to pence for the API
- `openEdit()`: populate `pricePerGymnast: String(t.pricePerGymnast / 100)` to convert from pence to pounds for display
- Template list row: show price alongside slots, e.g. `12 slots · £6.00`

### `BookingCalendar.js`

- Replace `const cartTotalAmount = cartTotalSlots * 600` with a per-session sum: iterate `cartEntries`, look up each session's `pricePerGymnast` from the `sessions` array, multiply by gymnast count
- Sessions objects from the API will now include `pricePerGymnast` — fall back to 600 if missing (defensive)

## Migration

Add `pricePerGymnast Int @default(600)` to the `SessionTemplate` model in `schema.prisma`, then run:

```
npx prisma migrate dev --name add_price_per_gymnast_to_session_templates
```

Prisma generates the SQL automatically (`ALTER TABLE ... ADD COLUMN price_per_gymnast INTEGER NOT NULL DEFAULT 600`). The default backfills all existing rows to £6.00 with no separate data migration needed. No enum changes, so no need to split into two files.

## What is NOT changing

- `BookingLine.amount` schema — already stores per-gymnast pence amount, no change
- `SessionInstance` — no per-instance price override (YAGNI)
- `Credit.amount` — credits are issued at the booking line's original amount, which is correct
- Admin-add route — no charge, so price is irrelevant there

## Success criteria

- Admin can set a price on each template (in £, stored in pence)
- Existing templates default to £6.00 without manual update
- Booking total uses the template's price, not a hardcoded constant
- Cart total in the parent booking UI reflects per-session prices correctly
- Cancellation credits match what was originally paid

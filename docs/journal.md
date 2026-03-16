# Development Journal

---

## 2026-03-16

### Parent UX Fixes
Three improvements based on parent feedback:

- **Double-booking prevention** — all three booking endpoints (single, batch, combined) now reject a second confirmed booking for the same gymnast in the same session, returning `400 Already booked: <name>`. PENDING bookings are intentionally not blocked.
- **Spaces remaining prominence** — booking calendar tiles and session detail panel now colour the available slot count: ≤3 slots red/bold, 4–5 slots amber/semibold.
- **Health notes editing** — parents can edit a gymnast's health notes inline on the My Children page; admins can do the same on the member card. Supports the `'none'` sentinel ("No known health issues") and null ("Not recorded"). New `PATCH /api/gymnasts/:id/health-notes` endpoint with guardian + staff auth.

### Outstanding Charges UX
Made it easier for members to discover and pay outstanding charges:

- Red dot badge on the Account nav link when charges exist.
- Cart nav link now appears even when the cart is empty, if there are outstanding charges.
- "Pay now →" button added to the charges card on the My Children page and the My Charges page, replacing the old explanatory text.

### Admin Member Card — Credits & Charges Layout
Restructured both expandable rows in the admin member card:

- Each row header now shows the total (credits balance or outstanding charges) alongside an action button (+ Assign credit / + Add charge).
- Clicking the row or arrow toggles the expanded list; clicking the action button expands directly to the form.
- Fixed: closing either panel via the toggle now resets the form state (`assigningCredit` / `addingCharge`).

### Credit Deletion
Added a Delete button to unused credits in the admin member card expanded section, wiring up the existing `DELETE /api/booking/credits/:id` backend endpoint. Used credits (applied to a booking) do not show the button.

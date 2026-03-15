# Admin Member Card — Credits & Charges Row Layout

**Date:** 2026-03-15

## Goal

Move the "add" actions for credits and charges into the expandable row headers, so admins can assign a credit or add a charge without needing to open the section first.

## Current Layout

- Credits and charges are rendered as `<li>` key/value entries in a profile info list.
- **Credits row:** shows total balance as a toggle button; expands to show a credits list. The row is hidden/non-interactive when `totalCredits === 0`. The expanded section is gated on `creditsOpen && totalCredits > 0`.
- **Charges row:** shows "View charges" before first load, then outstanding total once loaded. Expands to show the charges list + inline add-charge form.
- **`AssignCreditForm`:** rendered in a standalone `<div>` *below* both expandable rows, separately from the credits expand region, gated on `assigningCredit === true`.
- **`+ Assign credit` button:** renders alongside `AssignCreditForm`, always visible.

## New Layout

### Row headers

Both rows are restructured into a three-part flex layout. The existing `<li>` key/value pattern is replaced for these two rows:

```
[Label + summary]    [+ action button]    [▾/▴]
```

**Credits header:**
- Label: "Credits"
- Summary: `£X.XX total` when balance > 0, or `No credits` when balance is zero
- Action button: `+ Assign credit` (small, secondary style)
- Toggle arrow: always shown

**Charges header:**
- Label: "Charges"
- Summary: `View charges` when `memberCharges === null` (not yet loaded), `£X.XX outstanding` when loaded and outstanding > 0, `No outstanding charges` when loaded and outstanding is zero
- Action button: `+ Add charge` (small, secondary style)
- Toggle arrow: always shown

### Interaction

- Clicking the row label area or toggle arrow: toggles open/closed (existing behaviour). For charges, this continues to trigger `handleToggleCharges()` which lazy-loads on first open.
- Clicking `+ Assign credit`: sets `creditsOpen = true` and `assigningCredit = true`. Expands the credits section with the add-credit form visible.
- Clicking `+ Add charge`: sets `chargesOpen = true` and `addingCharge = true`, and calls `loadCharges()` if `memberCharges === null`. The expanded section shows the loading indicator while fetching, then the form once loaded.
- **Both action buttons must call `e.stopPropagation()`** to prevent the click from toggling the row simultaneously.
- Clicking an action button when the section is already open is idempotent — the form remains visible.

### Expanded content

**Credits expanded section (`creditsOpen === true`):**
- Remove the `totalCredits > 0` guard — the section now renders whenever `creditsOpen` is true.
- Shows the credits list as before when credits exist.
- When `totalCredits === 0` and `assigningCredit === false`: shows a brief empty state (e.g. "No credits").
- Shows `AssignCreditForm` when `assigningCredit === true`. **`AssignCreditForm` moves inside this section** (no longer rendered in the standalone div below the rows).

**Charges expanded section:** unchanged — charges list + add-charge form when `addingCharge === true`.

### Removed

- The standalone `+ Assign credit` button and its surrounding `<div>` below the expandable rows.
- The `AssignCreditForm` in that standalone area (it moves inside the credits expanded section).

## Files

| Action | Path |
|--------|------|
| Modify | `frontend/src/pages/booking/admin/AdminMembers.js` |

## Scope

Frontend only. No backend or API changes.

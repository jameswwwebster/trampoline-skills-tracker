# AdminMembers Redesign

**Date:** 2026-03-10

## Goal

Redesign the AdminMembers page to improve mobile readability, remove duplication, and restructure information by importance. The list row should never truncate. The expanded detail should surface compliance issues clearly and hide low-frequency data behind a secondary expander.

---

## Backend Change

Add a `hasPendingBg` boolean to each user object returned by `GET /api/users` (the members list endpoint). It is `true` if any gymnast linked to that user has `bgNumberStatus === 'PENDING'`.

---

## List Row

Each member row shows:

- **Left:** Name + role badge + optional `⚠ BG pending` badge (orange, shown if `hasPendingBg === true`)
- **Subtitle:** `X gymnast(s)` — derived client-side using the existing flat gymnasts array (already returned by the list endpoint) and the `guardianIds` mapping, which is the same approach the current code uses to build `childrenByUser`. No email shown in the list row.
- **Right:** Chevron `▾` / `▴`
- **Archived members:** rendered at 0.5 opacity (preserve existing behaviour)

The stats that currently appear in the row (confirmed bookings, cancelled bookings, last login, email) are removed.

---

## Expanded Detail

### Profile section

A key/value list (no name row — name is already the heading of the expanded section):

| Key | Value |
|---|---|
| Email | email address |
| Phone | phone number as `tel:` link, or "No phone number" in red |
| Role | role label + inline "Change" button |
| Member since | Month Year |
| Credits | `£X.XX ▾` (click to expand inline) or "No credits" muted |

If the member is archived, show an `Archived` badge beneath the key/value list.

**Credits expand:** Clicking `£X.XX ▾` expands an inline panel showing individual credit lines (amount + expiry date) and a `+ Assign credit` button. Reuses existing `AssignCreditForm`. After a credit is successfully assigned, the panel stays open and the credit list refreshes (same `load()` pattern as the current code). Collapses on second click of the toggle.

**Actions (bottom of profile section):**
- Edit profile (opens existing `EditProfileForm` inline)
- ↺ Password reset
- Remove member (danger style) — two-step confirmation required, matching existing confirmation copy: "Remove [name] and all their children? This cannot be undone."

---

### Gymnasts section

Header row: `GYMNASTS` label (uppercase) + `+ Add child` button (right).

Each gymnast renders as a card. Two variants: **child** and **adult participant** (`isSelf === true`).

#### Card border/background

- No issues: light purple tint (`#f9f8ff` background, `#e8e0ff` border)
- Has pending/missing issues: light orange tint (`#fffaf5` background, orange border) — triggered when any of the following are true: `bgNumberStatus === 'PENDING'`, `bgNumberStatus === 'INVALID'`, DOB missing, emergency contact missing (adult participants only)

#### Child card

- **Header:** Name (bold, left) + membership badge (right)
- **Info list (key/value rows):**
  - DOB — formatted date with an inline "Edit" link; or "Missing" in red with a "Set" link
  - Coaching photos — `✓ Allowed` (green) or `✗ Not allowed` (red)
  - Social media — `✓ Allowed` (green) or `✗ Not allowed` (red)
  - BG insurance — see BG status table below
- **BG action bar** — shown when `bgNumberStatus` is `PENDING` or `INVALID` (see below)
- **Details expander** `▸ Health notes, membership, remove` — collapsed by default; expands to show:
  - Health notes text (read-only display)
  - Full membership management (reuses existing `GymnastMembership` component)
  - Remove child button (danger, with two-step confirmation — preserve existing copy)

No emergency contact row for children — the parent account is the emergency contact.

#### Adult participant card (`isSelf === true`)

Same as child card, with one addition in the info list:

- Emergency contact — `✓ On file` (green) or `✗ Missing` (red)

The details expander label becomes `▸ Emergency contact, health notes, membership, remove` — collapsed by default — and includes emergency contact details (name, relationship, phone number as `tel:` link) at the top of the expanded content.

#### Membership badge

| Status | Display |
|---|---|
| `ACTIVE` | `Active £X/mo` green |
| `PAUSED` | `Paused £X/mo` orange |
| `PENDING_PAYMENT` | `Pending payment` orange |
| `SCHEDULED` | `Scheduled £X/mo` purple |
| `CANCELLED` or none | `Ad-hoc` muted |

#### BG insurance display

| Condition | Display |
|---|---|
| `bgNumberStatus === 'VERIFIED'` | `✓ Verified` (green) + monospace number |
| `bgNumberStatus === 'PENDING'` | `⚠ Pending` (orange) + monospace number |
| `bgNumberStatus === 'INVALID'` | `✗ Invalid` (red) + monospace number (only shown if non-null) |
| No BG number, `pastSessionCount < 2` and no active membership | Row not shown |
| No BG number, `pastSessionCount >= 2` or has active membership | `✗ Not provided` (red) |

#### BG action bar

Shown below the BG insurance row when `bgNumberStatus` is `PENDING` or `INVALID`. Orange-tinted, contains:

- **PENDING:** `Verify` (accent) · `Mark invalid` (red) · `Edit` (muted)
- **INVALID:** `Edit BG number` (accent) — allows admin to re-enter the number which triggers auto-verify

Reuses existing `BgNumberAdminRow` logic.

---

## What does NOT change

- The A–Z letter filter strip
- Search input (which also searches by child name)
- Pagination
- Create user form
- Memberships collapsible panel (bottom of page)
- Credits collapsible panel (bottom of page)
- Removed Members collapsible panel (bottom of page)

---

## Files

- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`
- Modify: `backend/routes/users.js` (or wherever `GET /api/users` is handled) — add `hasPendingBg` to list response

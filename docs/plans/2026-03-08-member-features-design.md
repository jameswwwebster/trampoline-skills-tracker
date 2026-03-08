# Member Features Design

Date: 2026-03-08

## Overview

Three improvements to member management: role assignment UI, health notes on gymnasts, and alphabetical filtering + pagination on list pages.

---

## 1. Role Management

**Backend:** `PUT /api/users/:userId/role` already exists and accepts `CLUB_ADMIN`, `COACH`, `PARENT`. Extend it to also accept `GYMNAST`.

**Frontend — AdminMembers.js:**

Add a role selector to the profile section of `MemberDetail` (alongside the existing `EditProfileForm`). Options: Admin, Coach, Parent, Gymnast. SUPER_ADMIN is never shown.

- Displayed as a labelled dropdown with a "Save" button, separate from the name/email/phone edit form
- Promoting to `CLUB_ADMIN` shows a confirmation: *"This gives full admin access. Are you sure?"*
- Role change is audited via the existing `audit()` helper (`user.role_change` action)

---

## 2. Health / Learning Differences

### Data model

New optional field on `Gymnast`:

```prisma
healthNotes String?  // "none" = confirmed no issues; free text = described issues
```

Nullable in DB so existing records are unaffected. Required at the UI level for all new gymnast registrations.

### UI — add-child forms

Applies to both `MyChildren.js` and `AdminMembers.js` add-child form.

Field order:
1. Checkbox: *"No known health issues or learning differences"*
2. Textarea: *"Health issues or learning differences"* (disabled when checkbox is ticked, value preserved)

Submit logic:
- If checkbox ticked → send `healthNotes: "none"` (textarea value ignored)
- If checkbox unticked → textarea is required; send its value as `healthNotes`

### Backend

Add `healthNotes` to the Joi validation schema in `POST /api/gymnasts/add-child` and `POST /api/gymnasts/admin-add-child`. Required in both.

### Viewing health notes

| Where | Who sees it |
|---|---|
| AdminMembers — gymnast detail panel | CLUB_ADMIN, COACH |
| MyChildren — child detail | Parent (own children only) |

> **Note:** This data is sensitive. Do not expose it to other parents or in public-facing views.

> **Future scale note:** Client-side data loading is appropriate for clubs of typical size (hundreds of members). If datasets grow to thousands of records or objects become very large, server-side pagination with filtered API queries should replace the current approach.

---

## 3. Alphabetical Filtering + Pagination

Applies to: **AdminMembers** (`/booking/admin/members`) and **Gymnasts** (`/gymnasts`).

### A–Z bar

A row of letter buttons (A–Z) plus an "All" button. Clicking a letter filters the list to records whose **last name** starts with that letter. "All" clears the filter. Works in combination with the existing search input.

### Pagination

- 25 records per page
- Prev / Next buttons with a "Page N of M" indicator
- Applied after search + A–Z filter
- Resets to page 1 whenever the filter or search changes

### Implementation

Both pages already load all data client-side. The filter and pagination are purely UI state — no API changes needed.

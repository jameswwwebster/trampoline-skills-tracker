# Session Templates Admin Design

Date: 2026-03-08

## Overview

Build a full CRUD admin UI for managing session templates (recurring session schedules), including a new rich-text "session information" field visible to members on the booking page.

## 1. Data Model

Add one optional field to `SessionTemplate`:

```prisma
information  String?   // rich text stored as HTML (TipTap output)
```

Stored as raw HTML. No changes to `SessionInstance` — information lives on the template and is always current. If updated, all future session detail pages reflect the change immediately.

## 2. Backend API

New router at `backend/routes/booking/templates.js`, registered as `/api/booking/templates`.

All endpoints require `auth` + `requireRole(['CLUB_ADMIN'])`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List all templates for the club (active and inactive) |
| `POST` | `/` | Create a new template, then run generateRollingInstances |
| `PUT` | `/:id` | Update template fields |
| `PATCH` | `/:id/toggle` | Flip isActive |
| `DELETE` | `/:id` | Delete template |

### `applyToFutureInstances` flag

`PUT`, `PATCH /toggle` (to deactivate), and `DELETE` all accept an optional `applyToFutureInstances: boolean` in the request body.

- **PUT** with flag: updates `openSlotsOverride` on future instances (date > today) that have no CONFIRMED bookings to match new `openSlots`
- **PATCH toggle** to deactivate with flag: sets `cancelledAt = now()` on future instances with no CONFIRMED bookings
- **DELETE** with flag: cancels future instances (as above) then deletes the template
- **DELETE** without flag: only deletes if no future instances exist, otherwise returns 400 with a message explaining there are future instances

### After create/update

Always re-run `generateRollingInstances(clubId)` after a successful create or update to ensure instances are up to date.

### Existing sessions API

`GET /api/booking/sessions/:instanceId` already returns the template — ensure `information` is included in the template select so it reaches the frontend.

## 3. Frontend — Admin UI

Location: top of the existing booking admin Sessions page (`BookingAdmin.js`), above the instance list.

### Template list

Card/row per template showing:
- Day of week + time range (e.g. "Tuesday 17:00–18:00")
- Capacity (e.g. "12 slots")
- Age restriction (e.g. "8+" or "All ages")
- Active/inactive badge
- Snippet of information text (plain text truncated, if set)
- Edit, Delete, and Activate/Deactivate buttons

### Create/Edit form

Inline expand panel (matching existing admin UI pattern) with fields:
- Day of week (select: Monday–Sunday)
- Start time / End time (time inputs)
- Open slots (number input)
- Min age (number input, optional)
- Information (TipTap rich text editor: bold, italic, bullet list, numbered list, links)

On save of an existing template, show a confirmation modal:
> "Apply these changes to already-scheduled future sessions that have no confirmed bookings?"
> [Yes] [No — future only] [Cancel]

### Deactivate confirmation modal

> "Stop generating new sessions for this template. Cancel future sessions with no confirmed bookings?"
> [Yes, cancel future sessions] [No, keep future sessions] [Cancel]

### Delete confirmation modal

> "Permanently delete this template. This cannot be undone. Also cancel future sessions with no confirmed bookings?"
> [Yes, delete and cancel future sessions] [Yes, delete only] [Cancel]

## 4. Session Detail Page

Render `information` HTML below the session time/capacity block on `SessionDetail.js`, visible to all authenticated users. Use `dangerouslySetInnerHTML` with the stored HTML. Wrap in a styled container matching the booking theme.

## 5. Rich Text Editor

Library: **TipTap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`)

Toolbar: Bold, Italic, Bullet list, Ordered list, Link, Clear formatting.

Output: HTML string stored directly in the `information` field.

Styling: minimal toolbar matching booking CSS variables; editor area styled like a text input.

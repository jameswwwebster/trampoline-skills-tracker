# Cover-coach session register export

Date: 2026-06-03

## Problem

Sometimes a coach covers a session at short notice without having a
Trampoline Life account. They need to know who is on the register and
what each gymnast is currently working on — and, more importantly, who
has medical notes or allergies they might need to act on. Today the only
way to get that info is to read it off the admin's logged-in screen.

## Design

### User flow

In the admin booking panel, the existing session detail view gets a new
**"Share register with cover coach"** button. Clicking it opens a small
form: pick an expiry (24h / 72h / 7d, default 72h), confirm. The system
generates a tokenised URL like

```
https://trampoline.life/coach-register/<token>
```

The admin sees the URL with a "Copy link" button. They paste it into a
text/WhatsApp to the cover coach. The coach opens it on phone or laptop
— no login — and sees a printable register page. The page has a
print-friendly stylesheet so ⌘P / browser print gives a clean PDF.

### Schema

New model:

```prisma
model SessionRegisterToken {
  id                String         @id @default(cuid())
  token             String         @unique
  sessionInstanceId String
  sessionInstance   SessionInstance @relation(fields: [sessionInstanceId], references: [id], onDelete: Cascade)
  createdById       String
  createdBy         User           @relation("SessionRegisterTokenCreatedBy", fields: [createdById], references: [id])
  expiresAt         DateTime
  createdAt         DateTime       @default(now())
  lastViewedAt      DateTime?

  @@index([token])
  @@index([sessionInstanceId])
  @@map("session_register_tokens")
}
```

`token` is a 32-char URL-safe random string generated via
`crypto.randomBytes(24).toString('base64url')`.

`lastViewedAt` is bumped on each successful page view so the admin can
see whether the cover coach actually opened the link.

### Backend

**POST `/api/booking/admin/sessions/:sessionInstanceId/register-token`**
— staff-only. Body `{ expiresInHours }` where allowed values are
`24 | 72 | 168`. Validates the session belongs to the user's club,
creates a token row, returns `{ url, expiresAt }`. Idempotency: each
call creates a fresh token (so admin can re-issue if they think a link
leaked) and the previous tokens for that session are not deleted but
will simply expire. Audit `session.register-token.create`.

**GET `/api/booking/coach-register/:token`** — public, no auth header
required. Loads the token row, verifies `expiresAt > now`, bumps
`lastViewedAt`, then returns server-rendered HTML with `Content-Type:
text/html`. Token-expired or unknown-token gets a plain 404 HTML page
with a "this link has expired" message — no leakage of session
existence.

**Frontend route** `/coach-register/:token` — small React page that
calls the public endpoint above. (Or even simpler: the public endpoint
returns full HTML inline, no React routing needed. I'll go with the
inline-HTML approach — fewer moving parts and trivially printable.)

Actually we'll go with the server-HTML approach: the URL
`https://trampoline.life/api/booking/coach-register/:token` returns a
self-contained HTML page (CSS inline, no external assets). The admin
share URL points directly to that endpoint. No React route, no client
fetch.

### Page contents

Header:

- Club logo + name (from `Club` row)
- "Session register — `<Day> <Date>` at `<Time>`"
- Session type pill (Trampoline / DMT)
- Capacity / how many are booked
- Coach-only note: "This link expires `<expiresAt>`. Please don't share it."

For each gymnast (sorted alphabetically by first name):

- **Name** (first + last)
- **Age** + age group
- **Current level** (highest `LevelProgress.status = IN_PROGRESS` for
  the gymnast at the club; if none, the highest COMPLETED + 1)
- **Skills currently working on** — every `SkillProgress` for the
  gymnast with `status = IN_PROGRESS`, grouped by level, listed by
  skill name in level order.
- **Allergies / health notes** — `Gymnast.healthNotes` if non-empty,
  shown in a bold "Health" callout. If empty, "No notes."
- **Emergency contact** — name, phone, relationship.
- **BG number status** — pill (Verified / Pending / Expired etc.).
- **DMT approval** — Yes / No (only shown when the session is a DMT
  session — otherwise hidden).
- **Photo consent flags** — small badges for any `Consent.granted`
  rows on the gymnast (`photo_coaching`, `photo_social_media`).

Roster is the union of:

1. CONFIRMED `Booking.line.gymnast` (active, not cancelled) on the
   session instance.
2. ACTIVE `Commitment` gymnasts on the template (with `startDate <=
   sessionDate`), minus anyone whose `Attendance.status = ABSENT` for
   this instance.

Footer: small print "Generated on `<now>` from Trampoline Life. Token
expires `<expiresAt>`."

### Printable styling

Inline CSS, `@page { size: A4; margin: 1cm; }`. Per-gymnast block is
roughly half a page so a typical 8-12-person session prints to 4-6
pages. `page-break-inside: avoid` on each gymnast block.

### Privacy

The token is the only auth. It's 192 bits of entropy — not guessable.
A leaked URL grants read access until expiry. We make it clear in the
share dialog ("Please don't share beyond the cover coach"). Tokens are
single-session — they can't be used to read any other session's
register.

### Admin UI

In `SessionDetailPanel` (admin booking page), add a section above the
register table:

- Button: "Share register with cover coach".
- On click: open a small modal with the expiry dropdown and a "Generate"
  button.
- After generate: show the URL in a read-only input + a "Copy link"
  button, plus the expiry timestamp.
- A small list below shows any **currently live** tokens for this
  session (token shortcode, created by, expires in X hours, viewed Y
  times), each with a "Revoke" button that sets `expiresAt = now()`.

### Out of scope

- Email the link directly from the platform (admin pastes it themselves).
- PDF generation server-side.
- Customising which fields appear (all listed fields included by default).
- A "view as cover coach" preview from inside the admin UI.

## Tests

Backend Jest:

1. Create token: returns URL + expiry, persists row.
2. Non-admin (parent / coach from other club) cannot create.
3. GET with valid token returns 200 + `text/html` containing every
   roster gymnast's name and health notes.
4. GET with expired token returns 404 with the "link expired" message.
5. GET with unknown token returns 404.
6. `lastViewedAt` updates on a successful GET.
7. Revoking a token sets `expiresAt = now()` and the next GET returns
   404.
8. Roster includes both booked gymnasts and active commitments, and
   excludes anyone marked absent.

No frontend Jest tests for the modal — covered by manual smoke.

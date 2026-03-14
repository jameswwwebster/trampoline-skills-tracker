# New Member Digest Email — Design Spec

## Goal

Send a daily email to all coaches and admins listing any new user accounts created in the previous 24 hours. Only sent on days where at least one new account exists.

## Architecture

A single new cron job in `server.js` runs at 08:00 daily. It queries the database for users created in the 24-hour rolling window ending at cron run time (i.e. `createdAt >= now - 24h`). If none are found, it exits silently. If any are found, it sends one digest email per active coach/admin in the club via a new `sendNewMemberDigestEmail` method on `emailService.js`.

This application has a single club ("Trampoline Life"). `prisma.club.findFirst` is safe and consistent with other single-club lookups in the codebase (e.g. `POST /api/auth/register`).

No schema changes are required.

## Components

### `backend/services/emailService.js`

New method: `sendNewMemberDigestEmail(coachEmail, coachFirstName, newMembers)`

- `newMembers`: array of `{ firstName, lastName, email, createdAt }`
- Renders an HTML table with one row per new member: full name, email address, sign-up time (formatted as `DD MMM YYYY HH:mm`)
- Plain-text fallback lists the same fields
- Subject: `"New members (last 24 hours) — <N> sign-up(s)"`
- Calls `_send` directly — no `emailEnabled` guard inside the method (the guard lives in the cron, same as all other digest emails)

### `backend/server.js`

New cron block after the BG number digest (currently at 07:30):

```js
// New member digest — runs daily at 08:00
cron.schedule('0 8 * * *', async () => { ... });
```

Logic:
1. Find the club (`prisma.club.findFirst`)
2. If `!club?.emailEnabled`, return
3. Query new users: `{ clubId: club.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }`
4. If none, return
5. Find all active staff: `{ clubId: club.id, role: { in: ['CLUB_ADMIN', 'COACH'] }, isArchived: false, email: { not: null } }`
6. For each, call `emailService.sendNewMemberDigestEmail(...).catch(() => {})`
7. Log count on success

## Error Handling

- Cron errors caught and logged as `console.error('New member digest cron error:', err)`
- Per-recipient send failures swallowed with `.catch(() => {})` (same as BG digest)
- `emailEnabled` checked in the cron before sending, not inside the service method

## Testing

Tested manually by temporarily adjusting the cron schedule or calling the logic directly. No automated test required — the cron pattern is already established and trusted in this codebase. The email method follows an identical pattern to existing tested email methods.

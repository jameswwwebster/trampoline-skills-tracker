# New Member Digest Email — Design Spec

## Goal

Send a daily email to all coaches and admins listing any new user accounts created in the previous 24 hours. Only sent on days where at least one new account exists.

## Architecture

A single new cron job in `server.js` runs at 08:00 daily. It queries the database for users created since yesterday at the same time. If none are found, it exits silently. If any are found, it sends one digest email per coach/admin in the club via a new `sendNewMemberDigestEmail` method on `emailService.js`.

No schema changes are required.

## Components

### `backend/services/emailService.js`

New method: `sendNewMemberDigestEmail(coachEmail, coachFirstName, newMembers)`

- `newMembers`: array of `{ firstName, lastName, email, createdAt }`
- Renders an HTML table with one row per new member: full name, email address, sign-up time (formatted as `DD MMM YYYY HH:mm`)
- Plain-text fallback lists the same fields
- Subject: `"New members today — <N> sign-up(s)"`
- Follows the same `_send` / `emailEnabled` guard pattern as the rest of the service

### `backend/server.js`

New cron block after the BG number digest (currently at 07:30):

```
// New member digest — runs daily at 08:00
cron.schedule('0 8 * * *', async () => { ... });
```

Logic:
1. Find the club (`prisma.club.findFirst`)
2. If `!club.emailEnabled`, return
3. Query new users: `createdAt >= 24 hours ago`, scoped to `clubId`
4. If none, return
5. Find all `CLUB_ADMIN` and `COACH` users in the club
6. For each, call `emailService.sendNewMemberDigestEmail(...).catch(() => {})`
7. Log count on success

## Error Handling

- Cron errors caught and logged as `console.error('New member digest cron error:', err)`
- Per-recipient send failures swallowed with `.catch(() => {})` (same as BG digest)
- `emailEnabled` checked before any DB work beyond club lookup

## Testing

Tested manually by temporarily adjusting the cron schedule or calling the logic directly. No automated test required — the cron pattern is already established and trusted in this codebase. The email method follows an identical pattern to existing tested email methods.

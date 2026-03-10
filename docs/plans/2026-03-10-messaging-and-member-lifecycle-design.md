# Messaging & Member Lifecycle Design

**Date:** 2026-03-10

---

## Goal

Give admins the ability to send targeted bulk email campaigns to members, automate routine notifications, and cleanly manage the lifecycle of inactive or removed members.

## Scope

Three distinct areas:

1. **Manual campaigns** — admin composes, targets, and schedules bulk emails
2. **Automated messages** — system-triggered emails based on conditions, no admin involvement
3. **Member lifecycle** — inactivity detection, warnings, deletion with summary record

SMS is out of scope for now but the channel layer should be pluggable (Aircall API is a likely future addition).

---

## 1. Manual Campaigns

### Data Model

```
Message
  id
  clubId
  authorId             -- user who created it
  subject
  htmlBody
  status               -- DRAFT | SCHEDULED | SENDING | SENT | FAILED
  scheduledAt          -- null = send immediately on publish
  sentAt
  recipientFilter      -- JSON: stores targeting criteria (see below)
  createdAt
  updatedAt

MessageRecipient
  id
  messageId
  userId
  email                -- snapshot at send time
  status               -- PENDING | SENT | FAILED
  error                -- failure reason if applicable
  sentAt
```

### Recipient Filters

Stored as JSON in `recipientFilter`. Resolved into a user list at send time (not draft time), so late bookings are included.

| Filter type | Resolves to |
|---|---|
| All members | Every non-archived user in the club |
| By role | All PARENTs or all COACHes |
| Session attendees | Users with a CONFIRMED booking on a specific session instance |
| Active membership | Users whose gymnast has an ACTIVE or SCHEDULED membership |
| Expiring credits | Users with a credit expiring within N days |
| No upcoming bookings | Users with no CONFIRMED booking in the next N days |
| Ad-hoc | Admin selects specific users from a searchable list |

Multiple filters can be combined with AND/OR logic.

Example filter JSON:
```json
{ "operator": "AND", "filters": [
  { "type": "role", "role": "PARENT" },
  { "type": "no_upcoming_bookings", "withinDays": 30 }
]}
```

### Sending

- Cron runs every minute
- Picks up SCHEDULED messages where `scheduledAt <= now` and `status = SCHEDULED`
- Sets status to SENDING, resolves recipients, sends via existing `emailService`
- Records SENT or FAILED per recipient
- Sets message status to SENT (or FAILED if all recipients failed)

### Admin UI

- Campaign list: status, subject, scheduled/sent time, sent/failed count
- Composer: subject, rich text body, filter builder, recipient preview (resolved list before sending)
- Save as draft or schedule to a specific date and time (minute precision)

---

## 2. Automated Messages

Configured per club with on/off toggles and threshold values stored in club settings. No template editing — built-in templates only.

| Message | Trigger | Configurable |
|---|---|---|
| Session reminder | Daily cron — sessions tomorrow with available slots | On/off |
| Membership payment reminder | Daily cron — membership renewal within 3 days | On/off |
| Inactivity warning | Daily cron — no login and no booking in 5 months 3 weeks | On/off |

Automated messages are sent via `emailService` with the same `emailEnabled` gate as all other emails.

---

## 3. Member Lifecycle

### Inactivity Definition

A member is inactive if they have had **no login and no confirmed booking in 6 months**.

### Flow

```
5 months 3 weeks inactive
  → Warning email sent: "Your account will be deleted in one week"

6 months inactive
  → Never booked: hard delete, no summary
  → Has booking/membership history: save ArchivedMemberSummary, then hard delete
```

### Manual Deletion

Admin can manually remove a member at any time. Same logic applies:
- No history → hard delete
- Has history → save ArchivedMemberSummary, then hard delete

A GDPR erasure request is handled as a manual deletion.

### ArchivedMemberSummary

```
ArchivedMemberSummary
  id
  clubId
  firstName
  lastName
  totalAmountPaid      -- sum of confirmed booking amounts + membership payments
  sessionsAttended     -- count of confirmed bookings with past session dates
  membershipCount      -- number of memberships held
  deletionReason       -- INACTIVITY | MANUAL
  deletedBy            -- userId of admin (null for inactivity cron)
  deletedAt
```

No email address stored. No booking details, login history, or custom field values.

### Admin UI

- Summaries visible in a dedicated "Removed Members" section in admin
- Filterable by deletion reason and date range

---

## Key Decisions

- **Email only for now** — SMS (Aircall) is a future addition; channel layer should be designed to be pluggable
- **Gmail SMTP retained** — no switch to Resend; delivery status is SENT/FAILED only, no open/click tracking
- **Automated message templates are not editable** — built-in copy only, on/off toggle per message type
- **Recipients resolved at send time** — ensures late bookings/changes are captured
- **Two deletion reasons only** — INACTIVITY and MANUAL; GDPR requests are manual deletions
- **Anonymised summary** — name + financial totals only; no email, no personal detail beyond name

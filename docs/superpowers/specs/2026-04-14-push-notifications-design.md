# Push Notifications Design

**Date:** 2026-04-14
**Status:** Approved

## Overview

Add Web Push notification support to the app, starting with a coach-facing "session starting soon" notification sent 5 minutes before each session. The infrastructure is designed to be role-agnostic and extensible to additional notification types without schema changes to `User`.

## Scope

- Native Web Push using the `web-push` npm package (VAPID)
- PWA manifest + service worker to make the app installable and receive background push
- Per-user, per-type notification preferences
- Initial notification type: `SESSION_REMINDER` — sent to all coaches 5 minutes before a session starts
- All authenticated users can subscribe to push; the backend filters recipients by role and preference at send time

## Data Model

### New enum

```prisma
enum PushNotificationType {
  SESSION_REMINDER
}
```

### New models

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@map("push_subscriptions")
}

model PushNotificationPreference {
  userId           String
  notificationType PushNotificationType
  enabled          Boolean              @default(true)
  user             User                 @relation(fields: [userId], references: [id])

  @@id([userId, notificationType])
  @@map("push_notification_preferences")
}
```

`endpoint` is unique so re-subscribing from the same device upserts cleanly. When a user first subscribes, a preference record is created for every known `PushNotificationType` with `enabled: true`. Absence of a record for a given type also defaults to enabled, so existing subscribers are not affected when new types are added.

### Environment variables

Generated once via `web-push generate-vapid-keys`, stored in `.env`:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

## Backend

### `backend/services/pushNotificationService.js`

- Initialises `web-push` with VAPID keys at module load
- `sendToCoaches(clubId, notificationType, payload)` — finds all `PushSubscription` records for users with `role: COACH` and the given `clubId` who have the notification type enabled (or no preference record for it), calls `webpush.sendNotification()` for each, silently removes stale subscriptions (410/404 responses indicate the browser has revoked them)

### `backend/routes/push.js`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/push/vapid-public-key` | public | Returns the VAPID public key |
| `POST` | `/api/push/subscribe` | required | Upserts subscription by endpoint; creates default preference records |
| `DELETE` | `/api/push/subscribe` | required | Deletes subscription by endpoint |
| `PATCH` | `/api/push/preferences` | required | Updates `enabled` for a given `notificationType` |

### Cron job (added to `server.js`)

Runs every minute. Logic:

1. Compute `now + 5 minutes` converted to UK local time using `Intl.DateTimeFormat` with `timeZone: 'Europe/London'`, formatted as `"HH:MM"`.
2. Get today's calendar date in UK local time (to handle the midnight edge case during BST).
3. Query `SessionInstance` where `date` = today (UK), `template.startTime` = target `"HH:MM"`, and `cancelledAt` is null.
4. For each matching instance, call `sendToCoaches(clubId, 'SESSION_REMINDER', payload)`.
5. Log errors but do not throw — a push failure must not crash the server.

**Timezone note:** `Europe/London` is hardcoded for now. When multi-club international support is needed, replace with `club.timezone` (a future field on the `Club` model).

**Notification payload:**

```json
{
  "title": "Session starting in 5 minutes",
  "body": "Don't forget to take the register!",
  "url": "/booking/admin"
}
```

## Frontend

### PWA setup

**`frontend/public/manifest.json`**
- `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color`, icons
- Linked from `frontend/public/index.html` via `<link rel="manifest">`

**`frontend/public/service-worker.js`**
- `push` event: parses JSON payload, calls `self.registration.showNotification(title, { body, icon, data: { url } })`
- `notificationclick` event: closes notification, opens/focuses the app, navigates to `data.url` if the app is already open

**Service worker registration** added to `frontend/src/index.js`, guarded by `'serviceWorker' in navigator`.

### `usePushNotifications` hook

Manages the full subscription lifecycle:

- Exposes: `permissionState` (`"default"` | `"granted"` | `"denied"`), `isSubscribed`, `subscribe()`, `unsubscribe()`, `preferences`, `updatePreference(type, enabled)`
- `subscribe()`: requests permission → fetches VAPID public key → calls `pushManager.subscribe()` → POSTs to `/api/push/subscribe`
- `unsubscribe()`: calls `pushManager.unsubscribe()` → DELETEs from `/api/push/subscribe`
- `updatePreference()`: calls `PATCH /api/push/preferences`

### Permission UI

Available to all authenticated users. Two layers:

**Layer 1 — master toggle:** shown in an appropriate settings or profile location.

| State | Display |
|-------|---------|
| `default` | "Get notified about upcoming sessions and club updates" + Enable button |
| `granted` + subscribed | "Notifications enabled" + Disable button |
| `denied` | "Notifications are blocked — enable them in your browser settings" (no button) |

**Layer 2 — per-type toggles:** visible only when subscribed. Initially one toggle:
- **Session reminders** — "Notify me 5 minutes before a session starts"

Adding a new notification type in future requires: adding to the enum, running a migration, and adding a toggle label here.

## Error handling

- Stale push subscriptions (410/404) are silently deleted on first failed send
- If `Notification.permission` is `"denied"`, the UI explains the user must unblock in browser settings
- Push send failures are logged server-side but do not affect other operations

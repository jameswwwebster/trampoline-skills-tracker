# Member Management Removal — Design Spec

## Goal

Remove all member management features from the skill tracker section. The booking section's existing Members page already covers this functionality. This is a clean-up: delete dead code, remove unused routes, and trim the tracking nav.

## Background

The tracking section accumulated member management pages (Users, Adults, Invites, Import, etc.) over time. With the booking Members page now handling role editing, profile editing, credit assignment, membership info, guardian/children display, and password reset, these tracking-side pages are redundant. Several flows (adult connection requests, guardian invitations, staff invitations) have also been superseded by newer patterns and are no longer needed.

## Scope

### Frontend pages removed

For each page: delete the file, remove its `import` statement from `App.js`, and remove its `<Route>` declaration from `App.js`.

| Page | Route | Reason |
|------|-------|--------|
| `Users.js` | `/users` | Covered by booking AdminMembers |
| `Adults.js` | `/adults` | Redundant with booking Members view |
| `AdultRequests.js` | `/adult-requests` | Flow replaced — adults now add children directly |
| `Invites.js` | `/invites` | Coaches add parents manually; invitations not needed |
| `ImportGymnasts.js` | `/import` | Being scrapped entirely |
| `CustomFields.js` | `/custom-fields` | Was only used for CSV import mapping |
| `AcceptInvite.js` | `/invite/:token` | Goes with invitation removal |
| `AdultConnectionRequest.js` | `/adult-connection-request` | Old parent request flow, now superseded |

Neither `Adults.js` nor `Users.js` imports a CSS file — no CSS cleanup needed for those two.

### App.js — additional cleanup

`App.js` has a `pathname.startsWith(...)` block (~lines 92–107) that sets the document title for the tracking section. Remove these stale entries from that block: `/users`, `/invites`, `/import`, `/custom-fields`, `/adult-requests`. (Leave all other entries — `/gymnasts`, `/levels`, `/competitions`, `/progress`, etc. — untouched.) Note: `/adults` and `/adult-connection-request` were never added to this block, so no action is needed for them there.

### Frontend components removed

| Component | Notes |
|-----------|-------|
| `components/SendInviteForm.js` | Only used by Invites.js |
| `components/InviteList.js` | Only used by Invites.js |
| `components/GuardianInvite.js` | Rendered in Profile.js but permanently inert: the backend's `isUnder18()` helper passes `null` as the DOB which always returns `false`, so the component always renders "Guardian invitations are only available for users under 18 years old." Remove the `<GuardianInvite />` JSX and its `import` from `Profile.js`, then delete the file. |

### CSS files removed

- `pages/AdultRequests.css`
- `pages/AdultConnectionRequest.css`
- `pages/CustomFields.css`

### Backend routes removed (+ server.js mounts)

For each: remove the `require(...)` at the top of `server.js`, the `app.use(...)` mount, and delete the route file.

| File | Mount | Notes |
|------|-------|-------|
| `routes/invites.js` | `/api/invites` | Staff invitation flow |
| `routes/guardianRequests.js` | `/api/guardian-requests` | Parent request flow |
| `routes/guardianInvites.js` | `/api/guardian-invites` | Already disabled; `isUnder18` hardcoded false |
| `routes/import.js` | `/api/import` | Gymnast CSV import |
| `routes/userCustomFields.js` | `/api/user-custom-fields` | Custom field definitions and values |

### Tracking nav (Layout.js)

Remove from Administration dropdown (desktop nav and mobile nav both):
- Manage Users (`/users`)
- Invitations (`/invites`)
- Adults (`/adults`)
- Adult Requests (`/adult-requests`)
- Import Gymnasts (`/import`)
- Custom Fields (`/custom-fields`)

After removal the Administration dropdown contains: **Club Settings** and **Club Branding** only.

---

## What Is Not Changed

- `frontend/src/pages/booking/admin/AdminMembers.js` — unchanged; already covers member management
- `frontend/src/pages/ClubSettings.js` — stays in tracking Administration
- `frontend/src/pages/Branding.js` — stays in tracking Administration
- `frontend/src/pages/ChildLogin.js` — unrelated auth flow, stays
- `frontend/src/pages/Profile.js` — stays; only the `<GuardianInvite />` section is removed
- `frontend/src/pages/Dashboard.js` — unchanged
- All booking-side pages — unchanged

---

## Out of Scope

- Any changes to booking's AdminMembers.js
- Database migrations (no schema changes needed)
- Redirects for removed routes (internal tool; no public-facing SEO concern)

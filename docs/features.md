# Trampoline Life — Feature Inventory

> Generated for use as input to e2e test scenario planning.
> Roles: **PARENT**, **COACH**, **CLUB_ADMIN**, **SUPER_ADMIN**

---

## 1. Authentication & Account Management

### Login & Registration
- Register with email, phone, and password (auto-assigned to default club as PARENT)
- Login with email/password, receive JWT token
- Token validation on protected routes

### Password Management
- Forgot password — generates 1-hour reset token, sends email
- Reset password via token (public endpoint)
- Change own password (requires current password)
- Admin-triggered password reset for another user (sends email with temp password)

### Profile Management
- Update own profile (first name, last name, email, phone)
- View another user's full profile including memberships (COACH/ADMIN)
- Update another user's profile (ADMIN)
- Update another user's role (ADMIN; cannot change own role)
- Must-change-password flag on first login after admin reset

### Child / Share Code Access
- Generate personal share code (6-digit, per user)
- Child login with share code + name (no password required)
- Disambiguation when multiple children share the same name
- Generate "code of the day" for club-wide gym access (24-hour expiry)
- View / deactivate code of the day (COACH/ADMIN)

---

## 2. Club & Organisation Management

### Club Setup
- Create a new club (creator auto-promoted to CLUB_ADMIN)
- Get club details (user and gymnast counts)
- Update club info (name, address, phone, email, website, description)
- Delete club (only if empty — no users except admin, no gymnasts)
- Archive / restore users
- Archive / restore gymnasts
- Hard-delete users and gymnasts (only if no progress data)

### Branding & Theming
- Customise colours (primary, secondary, accent, background, text)
- Set custom font family
- Upload club logo (5 MB image limit)
- Remove club logo
- Add custom CSS
- Public theme endpoint (no auth required)

### Club Settings & Email
- Enable / disable email sending for club (gates all email notifications)
- Send test email to verify SMTP configuration
- `emailEnabled` flag enforced on all outbound email

---

## 3. User & Member Management

### Users
- Create new user (admin generates temp password, sends welcome email)
- List all members (users + gymnasts combined with custom fields)
- View member detail including booking history and active credits (ADMIN/COACH)
- Add email address to a user without one (creates account if needed, sets mustChangePassword)
- Update role (ADMIN only)
- Archive / restore users
- Delete users (only if no progress data, no linked gymnasts)

### Custom Fields
- Create custom fields for users or gymnasts (types: TEXT, NUMBER, DATE, BOOLEAN, EMAIL, PHONE, DROPDOWN, MULTI_SELECT, TEXTAREA)
- Mark fields required or optional
- Set dropdown/multi-select options
- Set display order
- Activate / deactivate fields
- Populate field values per user

### Invites
- Create invite with role assignment (COACH or PARENT), 7-day expiry
- Accept invite via token (public)
- Reject invite
- Send invite email (if email enabled)
- Prevent duplicate invites to same email

---

## 4. Gymnast Management

### Gymnast Records
- Create gymnast record (with optional guardian emails)
- List all club gymnasts with progress summary (COACH/ADMIN)
- View single gymnast detail with full progress history
- Update gymnast info (name, DOB, notes)
- Update coach notes (COACH)
- Archive / restore gymnasts
- Delete gymnasts (only if no progress data)
- "Bookable for me" endpoint — returns gymnasts the current user can book for (self + linked children)
- Create self as gymnast (registers own adult profile; requires DOB)
- Parent add child (links child to own account)
- Admin add child (links child to a specific parent account)

### Guardian Relationships
- Connect guardian(s) when creating gymnast
- Guardian request connection to their child (self-serve)
- COACH/ADMIN approves guardian requests
- Create new parent account if guardian doesn't exist yet

### Gymnast Profile Data
- Update health notes / learning differences
- Manage emergency contact (name, phone, relationship)
- Confirm British Gymnastics insurance (guardian or staff)
- Manage photo consents (coaching use, social media)
- Track insurance confirmation date and confirming user

---

## 5. Skills & Progress Tracking

### Levels
- Create levels (identifier, name, type: SEQUENTIAL / SIDE_PATH)
- List all levels with nested skills, routines, and competitions
- Update level info
- Link levels to competitions
- Define prerequisites (next level)
- Support side-path levels (e.g., 3, 3a, 3b)
- Default data auto-created for new clubs

### Skills
- Create skills per level with order
- Update skill info (name, description, order)
- Include skills in routines

### Routines
- Create routines per level (alternative routines supported)
- Add / remove skills to routine with order
- Add custom skill names to routines

### Progress Tracking
- Record skill progress (NOT_STARTED, IN_PROGRESS, COMPLETED)
- Record level and routine progress with optional notes
- Track completion dates
- View progress timeline per gymnast (COACH/ADMIN)
- Children / parents view own progress (read-only)

---

## 6. Certificates

### Certificate Templates
- Upload PDF templates
- Define template fields: GYMNAST_NAME, COACH_NAME, DATE, LEVEL_NAME, LEVEL_NUMBER, CLUB_NAME, CUSTOM_TEXT
- Set field position, font, size, colour, rotation, alignment
- Mark templates as default / active

### Certificate Awards
- Award certificates for levels, special achievements, or participation (COACH/ADMIN)
- Track status: AWARDED → PRINTED → DELIVERED
- Mark as physically awarded / printed
- Add notes to certificates
- View certificate history per gymnast
- Parent/child view own certificates

---

## 7. Booking System

### Session Templates & Instances
- Create session templates (day of week, start/end time, capacity, minimum age, info text)
- Auto-generate monthly session instances from templates
- Override capacity for specific dates
- Cancel sessions (reason tracked, existing bookings unaffected until separately cancelled)
- View calendar of sessions with per-day availability
- Define closure periods (gym closures, bank holidays)

### Booking & Payment
- Create bookings for self and/or children (£6.00 per gymnast per session)
- Multi-gymnast bookings in a single transaction
- Age restriction enforcement per session
- British Gymnastics insurance check — required after 2 past sessions, blocks booking if unconfirmed
- Credits auto-applied at booking (oldest/soonest-expiring first, partial usage supported)
- Stripe Payment Intent created for remaining balance after credits
- Booking status: PENDING (awaiting payment) → CONFIRMED (webhook confirms) or CONFIRMED immediately if £0
- Stale PENDING bookings cancelled automatically when user re-initiates checkout (credits released)
- Cancel a booking — credits issued for future sessions; no credit for same-day cancellations
- Admin can add gymnasts to sessions without payment (admin-add)
- View upcoming and past bookings

### Waitlist
- Join waitlist when session is full
- Automatic email offer when a slot opens (24-hour offer expiry)
- Claim offered spot (converts waitlist entry to booking)
- Leave waitlist
- Statuses: WAITING → OFFERED → CLAIMED / EXPIRED
- Waitlist processed automatically on booking cancellation

### Credits
- Credits generated automatically on booking cancellation (amount = £6.00 per gymnast, 1-month expiry)
- Admin manually assigns credits (amount, expiry in days, note)
- Credits auto-applied server-side at booking time — no user selection required
- Partial credit usage: remainder splits into a new credit record
- View own credit balance
- Admin views all member credit balances
- Delete unused credits (admin, cannot delete credits used on a booking)

### Memberships (Recurring Billing)
- Admin creates membership for a gymnast: sets monthly amount, start date
- Creates Stripe Customer for guardian (if not already exists), stored on User record
- Creates Stripe Subscription with billing cycle anchored to 1st of next month (pro-rata first payment)
- Existing guardian credits auto-applied to first invoice as negative invoice items
- If credits fully cover first invoice: invoice finalised and paid out-of-band, subscription activates immediately — no card needed
- Member sees PENDING_PAYMENT status; follows hosted Stripe URL to complete payment setup
- First month pro-rata amount displayed in My Account so member understands the charge
- Membership statuses: PENDING_PAYMENT, ACTIVE, PAUSED, CANCELLED
- Admin can pause membership (calls Stripe `pause_collection`)
- Admin can resume membership
- Admin can cancel membership (calls Stripe subscription cancel)
- Admin can edit monthly amount (updates Stripe subscription item price)
- Stripe webhooks: `invoice.paid` → mark ACTIVE, send payment success email; `invoice.payment_failed` → send failure email; `customer.subscription.deleted` → mark CANCELLED; `customer.subscription.paused` → mark PAUSED; `customer.subscription.resumed` → mark ACTIVE
- Gymnasts with ACTIVE membership excluded from open slot counts (they attend without booking)

---

## 8. Guardian Request System (Self-Service Signup)
- Parent submits request using club code + gymnast name/DOB + their own info
- Admin reviews and matches to actual gymnast
- Admin can create new parent account during approval
- Approve (links parent to gymnast) or reject with notes
- Statuses: PENDING → APPROVED / REJECTED

---

## 9. Dashboard & Reporting
- Level distribution — gymnast count per level/working level
- Completions by competition type
- Gymnast list per level
- Total member counts

---

## 10. Audit Logging (ADMIN)
- All create / update / delete actions logged with timestamp and acting user
- Covers: role changes, member add/remove, credit assignments, certificate awards, booking events, membership changes
- Searchable by entity type and entity ID
- Metadata attached (what changed, from/to values)

---

## 11. Super Admin
- Switch between clubs via `X-Switch-Club-Id` header
- Access all clubs' data
- Manage global competitions

---

---

## Planned Features (Backlog)

Priority order as agreed:

1. **Basic club info / home page** — a public-facing landing page at `/` with club details, session times, and a link to the booking system
2. **Competition management** — entry management, heat sheets, results, possibly linked to the existing skills/levels system
3. **Email / messaging system** — direct messaging and bulk emails from admin to members or groups (separate from transactional emails already in place)
4. **Finance summary** — admin view of revenue: bookings, memberships, credits issued/used, outstanding balances
5. **Move the rest of the website** — migrate existing Wix content (about, contact, etc.) into this app so everything lives under one roof

---

## Key Constraints & Business Rules

| Rule | Detail |
|---|---|
| BG Insurance | Required after 2 past confirmed sessions; blocks booking if unconfirmed |
| Session capacity | Bookings (CONFIRMED + PENDING) count against capacity; members excluded |
| Age restriction | Per-session minimum age enforced at booking time |
| Credit order | Applied oldest-expiring first; partial use creates remainder credit |
| Credit expiry | Cancellation credits: 1 month. Admin-assigned: configurable (default 90 days) |
| Same-day cancellation | No credit issued |
| Membership billing anchor | Always 1st of next calendar month; Stripe calculates pro-rata first month |
| Email gating | All outbound email blocked if `club.emailEnabled` is false |
| Password reset token | 1-hour expiry |
| Invites | 7-day expiry |
| Waitlist offer | 24-hour expiry |
| Role hierarchy | SUPER_ADMIN > CLUB_ADMIN > COACH > PARENT > GYMNAST |
| Gymnast deletion | Blocked if any progress data or active membership exists |
| User deletion | Blocked if linked gymnasts with progress data exist |
| Member deletion | Blocked if active/pending/paused membership exists |

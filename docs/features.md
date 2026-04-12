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

### Account Inactivity & Deletion
- Accounts inactive for ~6 months receive an inactivity warning email
- Warning states the account will be permanently deleted in one week if no login
- Logging in resets the inactivity timer
- Account auto-deleted after the warning period if still inactive

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
- Add a **co-guardian** (second adult linked to the gymnast's account, receives emails and can manage bookings)
- Add a **named contact** (emergency contact separate from the primary guardian; name, phone, relationship)

### Gymnast Profile Data
- Update health notes / learning differences
- Manage emergency contact (name, phone, relationship)
- Confirm British Gymnastics insurance (guardian or staff)
- Manage photo consents (coaching use, social media)
- Track insurance confirmation date and confirming user

### British Gymnastics (BG) Membership Number
- Parent enters BG membership number for a gymnast in My Account
- Number is stored with status: PENDING (awaiting verification) / INVALID / CONFIRMED
- Coach/admin verifies numbers via the admin member view
- If a number is marked INVALID: warning shown in My Account, email sent to guardian with instructions
- If a number cannot be confirmed (not added to correct club on BG portal): guardian directed to add "Trampoline Life" as a club on mybg.british-gymnastics.org
- Grace period applies — bookings allowed while number is PENDING; blocked only once INVALID or if past session threshold with no number
- Coach receives digest email listing all gymnasts with unverified BG numbers (with days pending)
- Guardian can update/correct their BG number at any time
- `pastSessionCount` tracked per gymnast — triggers BG number requirement after 2 sessions

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
- Add FIG difficulty score (DD) per skill (decimal, e.g. 0.4)
- Add FIG notation string per skill (e.g. "o<")
- FIG data displayed on routines and cheat sheets; DD auto-totalled per routine
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

## 5b. Incident & Welfare Reporting

### First Aid Incident Reports
- Coaches and admins can file a first aid incident report for any gymnast
- Records: date/time, gymnast, description of incident, first aid given, follow-up required flag
- Staff (COACH/ADMIN) can view all incident reports for the club
- Incident report tile shown on admin dashboard

### Welfare Reports
- Coaches and admins can file a welfare concern report for any gymnast
- Records: date/time, gymnast, concern description, actions taken
- Staff (COACH/ADMIN) can view all welfare reports for the club
- Welfare report tile shown on admin dashboard
- Separate access control — welfare reports are not shown to adults

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
- If start date is today or in the past: activates immediately via `membershipActivationService`
- If start date is in the future: status is SCHEDULED until the activation service processes it
- On activation: creates Stripe Customer for guardian (if not already exists), stored on User record
- Creates Stripe Subscription with billing cycle anchored to 1st of next month (pro-rata first payment)
- Existing guardian credits auto-applied to the pending first invoice as negative invoice items
- **Credits fully cover first invoice**: invoice finalised and paid out-of-band; subscription activates immediately; `needsPaymentMethod = true` set on membership so member is prompted to add a card for future billing
- **Credits partially cover or don't apply**: member directed to hosted Stripe invoice URL to complete card payment; subscription moves to ACTIVE after payment
- First month pro-rata amount calculated and displayed in My Account (with "from [date]" label for ongoing amount)
- `needsPaymentMethod` flag triggers a "Payment method needed" card in My Account, explaining credits covered the first payment and a card is needed for future months
- Member adds card via Stripe SetupIntent (`POST /:id/setup-intent`) collected in-app with Stripe Elements
- On confirmation (`POST /:id/confirm-payment-method`): card set as default on Stripe Customer and Subscription; clears `needsPaymentMethod` on all of that guardian's memberships
- Membership statuses: **SCHEDULED** → **PENDING_PAYMENT** → **ACTIVE** → **PAUSED** / **CANCELLED**
- Admin can pause membership (calls Stripe `pause_collection: void`)
- Admin can resume membership (clears `pause_collection`)
- Admin can cancel membership (calls Stripe subscription cancel)
- Admin can edit monthly amount inline in admin table; syncs to Stripe subscription price
- Amount update supports proration behaviour: `create_prorations` (adjust current cycle pro-rata) or `none` (take effect from next billing date)
- Stripe webhooks: `invoice.paid` → mark ACTIVE, send payment success email; `invoice.payment_failed` → send failure email; `customer.subscription.deleted` → mark CANCELLED; `customer.subscription.paused` → mark PAUSED; `customer.subscription.resumed` → mark ACTIVE
- Gymnasts with ACTIVE membership excluded from open slot counts (they attend without booking)
- Admin memberships table: click monthly amount cell to edit inline

---

## 7b. Competition Management

### Competitions & Events
- Admin creates competition events (name, date, venue, description)
- Add categories to a competition, each with a name, price, and optional linked skill levels
- When adding a category to an existing competition, select which active skill levels qualify
- Gymnasts are shown only in their highest eligible category based on skill level completion

### Inviting Gymnasts
- Admin views all eligible gymnasts and their current entry status per competition
- **Individual invite**: select gymnast(s), choose categories, set price (overridable per gymnast), send invite
- **Synchro pair invite**: select two gymnasts, assign a shared pair ID; each gymnast gets a separate entry and separate payment; both entries linked by `synchroPairId`
- **Re-invite**: send a new invitation to a gymnast who previously declined (resets to INVITED, preserves `previousPaidAmount` for reference if they were previously paid)
- Invite email sent to all guardians: explains that payment will be requested through the app after they accept

### Entry Statuses
- `INVITED` — invitation sent, awaiting response
- `ACCEPTED` — gymnast has accepted; awaiting invoice
- `DECLINED` — gymnast declined the invitation
- `PAID` — invoice sent and payment confirmed
- `WAIVED` — entry fee waived by admin

### Payment Flow
- Admin sends invoice to accepted entries; invoice email explains entries won't be submitted until paid
- Guardian pays via the app cart/checkout (competition entry appears as a charge)
- On payment confirmed (Stripe webhook), entry status advances to PAID
- Admin can toggle **submitted to organiser** per entry once paid

### Entries View (Admin)
- EntriesTab shows all entries grouped by status
- Synchro entries show a badge and partner's name
- Re-invite button available on DECLINED entries
- `previousPaidAmount` shown as a note if gymnast is being re-invited after paying previously

### My Competitions (Guardian/Gymnast)
- Members see a dashboard tile showing pending competition invitations
- Competitions page lists all invitations with status, entry details, and accept/decline actions
- Accepted entries show payment status

---

## 8. Transactional Emails

All emails gated by `club.emailEnabled`. Sent via Gmail SMTP (nodemailer). All use the branded HTML template with solid purple header and CTA button.

| Email | Trigger | Recipient |
|---|---|---|
| Account created | Admin creates user account | New user — contains set-password link (1-hour expiry) |
| Welcome | User registers themselves | Registering user |
| Password reset | Forgot password request | Requesting user — contains reset link (1-hour expiry) |
| Invite | Admin sends club invite | Invitee — contains accept link |
| Membership created | Admin creates membership | Guardian — contains payment setup link, fee explanation, flexibility info |
| Payment success | `invoice.paid` Stripe webhook | Guardian — amount paid, next billing date |
| Payment failed | `invoice.payment_failed` webhook | Guardian — retry instructions, link to My Account |
| Payment reminder | Manually triggered by admin | Guardian — upcoming payment amount and date |
| Waitlist offer | Slot opens on full session | Waitlisted user — claim link, 24-hour expiry |
| Session reminder | Triggered for sessions with open slots (day before) | Prospective members — session date/time, book now link |
| BG number invalid | Admin marks BG number as INVALID | Guardian — instructions to correct number and add club on BG portal |
| BG number digest | Triggered for coaches (periodic) | Coach — table of all gymnasts with unverified BG numbers and days pending |
| Inactivity warning | Account inactive for ~6 months | User — 1-week warning before auto-deletion |
| Guardian connection confirmed | Guardian linked to gymnast | Guardian |
| Guardian invitation | Gymnast created with guardian email | Guardian — accept link |
| Competition invite | Admin invites gymnast to competition | Guardian(s) — accept/decline link, note that payment comes later |
| Competition invoice | Admin sends invoice after gymnast accepts | Guardian(s) — amount due, note that entry won't be submitted until paid |

---

## 9. Guardian Request System (Self-Service Signup)
- Parent submits request using club code + gymnast name/DOB + their own info
- Admin reviews and matches to actual gymnast
- Admin can create new parent account during approval
- Approve (links parent to gymnast) or reject with notes
- Statuses: PENDING → APPROVED / REJECTED

---

## 10. Dashboard & Reporting
- Level distribution — gymnast count per level/working level
- Completions by competition type
- Gymnast list per level
- Total member counts
- Admin dashboard tiles: overdue charges count, today's sessions, recent incident/welfare reports
- Member/guardian dashboard tile: pending competition invitations

---

## 11. Audit Logging (ADMIN)
- All create / update / delete actions logged with timestamp and acting user
- Covers: role changes, member add/remove, credit assignments, certificate awards, booking events, membership changes
- Searchable by entity type and entity ID
- Metadata attached (what changed, from/to values)

---

## 12. Super Admin
- Switch between clubs via `X-Switch-Club-Id` header
- Access all clubs' data
- Manage global competitions

---

---

## Planned Features (Backlog)

Priority order as agreed:

1. ~~**Basic club info / home page** — a public-facing landing page at `/` with club details, session times, and a link to the booking system~~ ✓ Done
2. ~~**Competition management** — entry management, heat sheets, results, possibly linked to the existing skills/levels system~~ ✓ Done (invite/accept/pay/submit flow; heat sheets and results not yet implemented)
3. ~~**Email / messaging system** — direct messaging and bulk emails from admin to members or groups (separate from transactional emails already in place)~~ ✓ Done
4. **Finance summary** — admin view of revenue: bookings, memberships, credits issued/used, outstanding balances
5. **Coach invoicing** — coaches submit invoices through the system for sessions coached; admin reviews and approves
6. ~~**Move the rest of the website** — migrate existing Wix content (about, contact, etc.) into this app so everything lives under one roof~~ ✓ Done
7. ~~**Noticeboard** — club announcements visible to members~~ ✓ Done

---

## Key Constraints & Business Rules

| Rule | Detail |
|---|---|
| BG number requirement | Triggered after 2 past confirmed sessions |
| BG number statuses | PENDING (entered, awaiting verification) / INVALID (failed check) / CONFIRMED |
| BG number grace period | Bookings allowed while PENDING; blocked if INVALID or no number past threshold |
| BG Insurance | Required after 2 past confirmed sessions; blocks booking if unconfirmed |
| Session capacity | Bookings (CONFIRMED + PENDING) count against capacity; members excluded |
| Age restriction | Per-session minimum age enforced at booking time |
| Credit order | Applied oldest-expiring first; partial use creates remainder credit |
| Credit expiry | Cancellation credits: 1 month. Admin-assigned: configurable (default 90 days) |
| Same-day cancellation | No credit issued |
| Membership statuses | SCHEDULED → PENDING_PAYMENT → ACTIVE → PAUSED / CANCELLED |
| Membership billing anchor | Always 1st of next calendar month; Stripe calculates pro-rata first month |
| needsPaymentMethod | Set when credits fully cover first invoice; separate SetupIntent flow to collect card |
| Amount update proration | `create_prorations` adjusts current cycle; `none` takes effect from next billing date |
| Email gating | All outbound email blocked if `club.emailEnabled` is false |
| Password reset token | 1-hour expiry |
| Invites | 7-day expiry |
| Waitlist offer | 24-hour expiry |
| Role hierarchy | SUPER_ADMIN > CLUB_ADMIN > COACH > PARENT > GYMNAST |
| Gymnast deletion | Blocked if any progress data or active membership exists |
| User deletion | Blocked if linked gymnasts with progress data exist |
| Member deletion | Blocked if active/pending/paused membership exists |

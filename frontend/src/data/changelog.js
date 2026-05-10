// Newest first. Types: 'feature' | 'improvement' | 'fix'
const changelog = [
  {
    date: '2026-05-10',
    entries: [
      { type: 'fix', text: 'Cancelling a monthly subscription now also removes the gymnast from their standing slots; pausing/resuming a subscription pauses/resumes the matching standing slots. Previously the membership was cancelled in Stripe and marked CANCELLED in the system, but the standing-slot commitments were left active so the gymnast kept appearing in every weekly session. Cleaned up 3 orphaned standing slots from previously-cancelled subscriptions (Hector Shipley x2, James Webster x1).' },
      { type: 'fix', text: 'Closure cancellations now issue a credit equal to what the user actually paid for each booking line. Previously every cancelled line got a flat £6 credit regardless of the session\'s pricePerGymnast, silently short-credited (or over-credited) anyone on a non-£6 session.' },
      { type: 'fix', text: 'Cancelling a booking (or a single gymnast off a booking) now removes any pre-marked PRESENT/ABSENT row from the register, and the register no longer lists cancelled gymnasts.' },
      { type: 'fix', text: 'Timezone bugs across booking flows: same-day cancellation rule, capacity windows, waitlist proximity check, session-start cutoff, closure date range, and the birthdays-this-week dashboard now all compute against UTC. On a non-UTC server these were shifting by a day around midnight (the same family as the recently-fixed session-generator bug).' },
      { type: 'fix', text: 'A guardian self-cancelling their Stripe subscription now cleans up the gymnast\'s standing slots too. Previously the webhook only flipped the membership to CANCELLED and left commitments live, re-introducing the bug fixed earlier today for admin-side cancels.' },
      { type: 'fix', text: 'Archiving a gymnast now cascades: any live monthly subscription is cancelled in Stripe, standing slots are removed, and any future confirmed booking lines for that gymnast are cancelled. Previously archive was purely cosmetic, leaving the parent still being billed and the gymnast still on registers.' },
    ],
  },
  {
    date: '2026-05-08',
    entries: [
      { type: 'feature', text: 'Cancel a single gymnast off a multi-gymnast booking. My Bookings shows each gymnast on its own row with a per-row Cancel button when a booking covers more than one; cancelling one issues a credit (subject to the same-day rule) and leaves the others confirmed. Admins get the same per-row cancel in the booking admin attendee list. Cancelling the last remaining gymnast cancels the whole booking.' },
      { type: 'fix', text: 'Rolling session generator no longer creates duplicate sessions one day earlier when the server runs in a non-UTC zone (e.g. BST). Date arithmetic and the (template, date) uniqueness key now both use UTC midnight. 154 spurious duplicate rows that had been generated were cleaned up.' },
    ],
  },
  {
    date: '2026-05-06',
    entries: [
      { type: 'feature', text: 'BG memberships can now be marked as expired. Admins get a "Mark expired" button on a verified gymnast; bookings continue for a 14-day grace, then pause until renewed. Guardians get a clear email saying they have 14 days to update, and a banner in My Account showing the days remaining.' },
      { type: 'fix', text: 'Gymnast skill tracking page no longer renders blank when a gymnast has progress on a skill whose level was deleted or detached. The earlier null-level fix only patched one of seven similar accesses; the remaining six in the render path were crashing with a TypeError, leaving the page empty.' },
    ],
  },
  {
    date: '2026-05-01',
    entries: [
      { type: 'fix', text: 'Difficulty calculator now applies the §17.1.6.1 backward bonus to twisting backward multi-soms too (e.g. Half In Half Out triple gets +0.1, Half Front Half triple gets +0.2). Previously it only applied to non-twisting backward elements.' },
      { type: 'fix', text: 'Skill editor now lets you enter twists for skills with no somersaults (½ Twist, Full Twist).' },
      { type: 'improvement', text: 'Backfilled structured FIG parameters (quarter soms, twists per som, shape, landing, direction) on the 80 legacy skills that pre-date the calculator. 4 duplicates of imported FIG-library entries were merged. Progression skills (Forward Roll, Cradle, Cruise, Forward Turnover etc.) intentionally have no FIG params.' },
      { type: 'improvement', text: 'Skill editor: Direction now has a "None" option for skills without somersault rotation (jumps, twists, landings). Hands removed from Landing options.' },
      { type: 'improvement', text: 'FIG notation no longer uses letter suffixes (f, s, b) for landing position — direction on the structured row carries that meaning. 9 affected notations updated automatically.' },
      { type: 'feature', text: 'All Skills page: archive button next to each skill (club admins only). Archiving hides the skill from routine search and library lookup but preserves its data, level attachments, routine references and gymnast progress records. "Show archived" filter exposes archived skills, with a restore button to bring them back.' },
      { type: 'fix', text: 'Skill search modals (routine, library lookup) no longer cap typed-query results at 30/50, so common entries like "Tuck Jump" surface even when many earlier-alphabetical skills also match. The list is scrollable.' },
      { type: 'feature', text: 'Routine implicit skills can now carry their own FIG notation and difficulty. The "Add Skill to Routine" modal has optional FIG and difficulty inputs that apply when you click "Add as implicit". Replace flow accepts overrides too.' },
      { type: 'improvement', text: 'A skill can now appear in a routine more than once (transition skills, repeats). Total DD dedupes by skill so duplicates don\'t double-count. Implicit skills with the same name are treated as distinct (they may be physically different — e.g. "to feet" from a seat landing vs from a front landing).' },
    ],
  },
  {
    date: '2026-05-01',
    entries: [
      { type: 'improvement', text: 'All Skills page: click any Name, FIG notation or Difficulty cell to edit it inline. Enter saves, Esc cancels.' },
      { type: 'improvement', text: 'Routines: each skill row in edit mode now has up/down buttons to reorder, plus a "Replace" button that opens the search modal to swap in a different skill (tracked or implicit) without losing the position.' },
      { type: 'improvement', text: 'Admin dashboard tile renamed from "Levels & Skills" to just "Levels".' },
      { type: 'improvement', text: 'Skill search now treats "1/2"/"half"/"½", "1/4"/"quarter"/"¼" and "3/4"/"¾" as the same — matches across the All Skills page, the routine search and the library lookup.' },
      { type: 'fix', text: 'Replacing a skill in a routine no longer fails with "Routine skill not found".' },
      { type: 'improvement', text: 'Skill editor: somersault and twist fields no longer show a leading 0; suggested-name affordance removed.' },
      { type: 'improvement', text: 'All Skills page: a "New skill" button creates a library skill with the full FIG calculator, and each row has an edit pencil that opens the same editor for changes beyond the inline name/FIG/difficulty fields.' },
    ],
  },
  {
    date: '2026-04-30',
    entries: [
      { type: 'feature', text: 'Skill editor now suggests difficulty and FIG notation automatically using FIG Code of Points 2025-2028 §17.1, with a breakdown of how the score was calculated' },
      { type: 'feature', text: 'New "All Skills" page in the admin hub (Skill Tracking) — sortable, searchable list of every skill with its level, FIG notation, difficulty, and routine usage' },
      { type: 'improvement', text: 'Routine construction: replaced the dropdown with a search box that matches by name OR FIG notation, with a single button to add unmatched text as an implicit skill' },
      { type: 'feature', text: 'Skills can now belong to multiple levels. When editing a level, "Add from library" lets you attach existing skills by searching name or FIG notation' },
      { type: 'feature', text: 'Library populated with 90 named skills from FIG Code of Points 2025-2028 Section II.C (Triple Full, Quadruple Full, all the in-out doubles, full triples and quadruple combos, etc.) — search them up and add to your levels as needed' },
    ],
  },
  {
    date: '2026-04-28',
    entries: [
      { type: 'fix', text: 'Joining the waitlist now correctly accounts for standing-slot commitments — it no longer claims a session has space when the booking page says it is full' },
      { type: 'improvement', text: 'Side menu cleanup: the long Admin dropdown is replaced by a single "Admin" link to the admin dashboard' },
      { type: 'improvement', text: 'Recent updates moved to the admin dashboard (Logs section), where it sits alongside the audit log' },
    ],
  },
  {
    date: '2026-04-27',
    entries: [
      { type: 'fix', text: '"Book for myself" now asks for date of birth before creating your gymnast record' },
      { type: 'fix', text: 'Members A–Z filter now correctly sorts by first name' },
      { type: 'fix', text: 'Session filter on the gymnasts page now persists when navigating to a gymnast profile and back' },
      { type: 'improvement', text: 'Session list in booking admin sorted by type (Trampoline first, then DMT) with a visual divider between groups' },
      { type: 'improvement', text: 'Mark-absent button removed from session panel — absence is managed on the register instead' },
    ],
  },
  {
    date: '2026-04-25',
    entries: [
      { type: 'improvement', text: 'Requirements cheatsheet viewer: zoom, pan, and download button added' },
    ],
  },
  {
    date: '2026-04-20',
    entries: [
      { type: 'feature', text: 'Competition categories now support optional age brackets (min/max age) — eligible gymnasts are filtered automatically' },
      { type: 'improvement', text: 'Competition invite panel: name search bar and age bracket tabs for filtering gymnasts' },
    ],
  },
  {
    date: '2026-04-19',
    entries: [
      { type: 'improvement', text: 'Competitions shown prominently on the member dashboard' },
      { type: 'improvement', text: 'Competition description included in invite email; URLs auto-linked' },
      { type: 'fix', text: 'Competition delete was failing with a database constraint error' },
    ],
  },
  {
    date: '2026-04-18',
    entries: [
      { type: 'fix', text: 'Checkout error when competition entry fee is below the Stripe minimum charge amount' },
    ],
  },
  {
    date: '2026-04-17',
    entries: [
      { type: 'improvement', text: 'Competition entry flow redesigned: coaches set the price before sending invites; guardians accept and pay in one step' },
      { type: 'improvement', text: 'Invite form requires at least one competition category and shows a price suggestion' },
      { type: 'improvement', text: 'Re-invite preserves the original categories and price' },
      { type: 'improvement', text: '"Send reminder" replaces the old resend-invoice button' },
    ],
  },
  {
    date: '2026-04-16',
    entries: [
      { type: 'improvement', text: 'Competition entry form shows description, allows category skill editing, and shows credit balance' },
      { type: 'fix', text: 'Capacity check at checkout now correctly accounts for absent standing-slot gymnasts' },
      { type: 'fix', text: 'Alert and prompt dialogs replaced with in-page forms and toast notifications' },
      { type: 'fix', text: 'API errors now shown to users instead of silently swallowed' },
    ],
  },
  {
    date: '2026-04-15',
    entries: [
      { type: 'feature', text: 'Standing-slot gymnasts can be marked absent from the session panel, freeing their place' },
      { type: 'improvement', text: "Today's sessions on the admin dashboard now navigate to booking admin when clicked" },
      { type: 'improvement', text: 'Session type labels (Trampoline/DMT) always visible on the dashboard' },
    ],
  },
  {
    date: '2026-04-14',
    entries: [
      { type: 'feature', text: 'Push notifications: opt in to receive session reminders on your device' },
    ],
  },
  {
    date: '2026-04-12',
    entries: [
      { type: 'fix', text: 'Overdue charge banner now hides correctly once the charge is paid' },
      { type: 'fix', text: 'Competition invite email wording improved' },
    ],
  },
  {
    date: '2026-04-11',
    entries: [
      { type: 'feature', text: 'Synchro competition entries: pairs can be invited and tracked together' },
      { type: 'feature', text: 'Organiser submission toggle on competition entries' },
      { type: 'improvement', text: 'Re-invite functionality added for competition entries' },
      { type: 'fix', text: 'Competition invoice emails fixed' },
    ],
  },
  {
    date: '2026-03-31',
    entries: [
      { type: 'feature', text: '"Track these gymnasts" button in the admin session panel — jumps to skill tracking filtered to session attendees' },
      { type: 'improvement', text: 'Emergency contact details shown for gymnasts in the standing slots list' },
      { type: 'improvement', text: "Standing slots now visible on the parent's My Bookings page" },
      { type: 'feature', text: 'Inline name editing for gymnasts on the members page' },
      { type: 'improvement', text: "Parents can edit their child's name and date of birth" },
    ],
  },
  {
    date: '2026-03-27',
    entries: [
      { type: 'improvement', text: 'Completed levels sorted to the bottom of the skill tracker, with a toggle to show/hide them' },
      { type: 'improvement', text: 'Progress page for parents: explainer section, certificates link, dimmed completed levels' },
      { type: 'improvement', text: 'Profile and My Account merged into a single page' },
      { type: 'improvement', text: 'Mobile: nav stays fixed while scrolling; zoom locked to prevent accidental pinch-zoom' },
      { type: 'feature', text: 'Admin hub dashboard added' },
      { type: 'improvement', text: 'Noticeboard panel on the dashboard shows recent post titles' },
    ],
  },
  {
    date: '2026-03-25',
    entries: [
      { type: 'improvement', text: 'Admin navigation consolidated into a single Admin dropdown' },
      { type: 'feature', text: '"Track these gymnasts" added to the coach session detail view' },
      { type: 'improvement', text: 'Gymnasts page can be pre-filtered via a session link' },
    ],
  },
  {
    date: '2026-03-24',
    entries: [
      { type: 'fix', text: 'Competition readiness counts on the dashboard were always showing zero' },
    ],
  },
  {
    date: '2026-03-19',
    entries: [
      { type: 'improvement', text: 'Session instances generated 3 months ahead instead of 4 weeks' },
      { type: 'feature', text: 'Session templates support a start date' },
      { type: 'improvement', text: 'Booking receipt emails sent on checkout' },
      { type: 'feature', text: 'Scheduled membership email notifications for guardians' },
      { type: 'improvement', text: 'Phone numbers open WhatsApp directly' },
      { type: 'improvement', text: 'Note field added when awarding a credit' },
    ],
  },
  {
    date: '2026-03-17',
    entries: [
      { type: 'feature', text: 'Hamburger mobile menu added to the booking layout' },
      { type: 'improvement', text: 'BG membership details improved throughout the app' },
    ],
  },
  {
    date: '2026-03-09',
    entries: [
      { type: 'improvement', text: 'Mobile: week-strip calendar with day detail panel' },
      { type: 'improvement', text: 'Session credits auto-applied at checkout' },
      { type: 'improvement', text: 'Admin can edit membership subscription amount' },
      { type: 'improvement', text: 'Credits can be partially applied; remainder carries over as a new credit' },
      { type: 'fix', text: 'Calendar session placement was incorrect in BST' },
      { type: 'feature', text: 'Booking emails: account created email on first registration' },
    ],
  },
];

export default changelog;

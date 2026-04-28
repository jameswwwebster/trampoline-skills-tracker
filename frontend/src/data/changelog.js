// Newest first. Types: 'feature' | 'improvement' | 'fix'
const changelog = [
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

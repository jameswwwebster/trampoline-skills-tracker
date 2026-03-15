import React, { useState } from 'react';
import '../booking-shared.css';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{
      marginBottom: '0.5rem',
      border: '1px solid var(--booking-border)',
      borderRadius: 'var(--booking-radius)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.875rem 1rem',
          background: open ? 'var(--booking-bg-light)' : 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '1rem',
          color: 'var(--booking-text)',
          textAlign: 'left',
        }}
      >
        {title}
        <span style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)', marginLeft: '0.5rem', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0.25rem 1rem 1.25rem' }}>
          {children}
        </div>
      )}
    </section>
  );
}

const p = { color: 'var(--booking-text-muted)', marginBottom: '0.6rem', lineHeight: 1.55 };
const h4 = { fontWeight: 600, marginBottom: '0.25rem', marginTop: '1rem', fontSize: '0.95rem' };
const li = { color: 'var(--booking-text-muted)', marginBottom: '0.3rem', lineHeight: 1.5 };

export default function AdminHelpPage() {
  return (
    <div className="bk-page bk-page--md">
      <h2 style={{ marginBottom: '1.5rem' }}>Coach Help</h2>

      <Section title="Members">
        <p style={p}>
          Go to <strong>Members</strong> in the Admin nav to search for any member by name or email.
          Clicking a member opens their full profile.
        </p>
        <h4 style={h4}>What you can see on a member profile</h4>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}>Each gymnast linked to their account, with date of birth, health notes, and emergency contact details</li>
          <li style={li}>Consent status (photo consent, health declaration, code of conduct)</li>
          <li style={li}>British Gymnastics membership number and its verification status</li>
          <li style={li}>Active memberships and standing slots</li>
          <li style={li}>Any outstanding or paid charges</li>
        </ul>
        <h4 style={h4}>Memberships &amp; standing slots</h4>
        <p style={p}>
          From a gymnast's membership card you can create a new membership, pause or resume an existing one,
          cancel it, or edit the monthly amount. Standing slots (the gymnast's regular weekly session place) can
          be added, removed, or paused from the same view — changes take effect from the date you specify.
        </p>
        <p style={p}>
          When a standing slot is added with a future start date, the gymnast's place is reserved from that date
          onwards but does not appear in the register until then.
        </p>
        <h4 style={h4}>Removing a gymnast</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          Use the remove option on a gymnast record to delete them from the system. This also cancels any active
          membership and standing slots for that gymnast. This action cannot be undone.
        </p>
      </Section>

      <Section title="Sessions">
        <p style={p}>
          From the main <strong>Sessions</strong> admin view you can see all upcoming session instances. Click
          any session to see which gymnasts are booked in, view booking details, and manually add gymnasts.
        </p>
        <h4 style={h4}>Adding a gymnast to a session manually</h4>
        <p style={p}>
          From a session's detail page, use <strong>Add gymnast</strong> to place any gymnast from your club
          directly into a session without going through the normal checkout. This bypasses payment — use it for
          make-up sessions, trial sessions, or corrections.
        </p>
        <h4 style={h4}>Cancelling a booking</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          You can cancel any confirmed booking from the session detail page or from a member's profile.
          When cancelling as an admin you are asked whether to issue a credit — you can override the default
          either way. The credit, if issued, expires one month from the date of cancellation.
        </p>
      </Section>

      <Section title="Register">
        <p style={p}>
          The <strong>Register</strong> link in the Sessions dropdown becomes active 15 minutes before a session
          starts and remains accessible until after the session ends. You can also reach it directly from any
          session detail page at any time.
        </p>
        <h4 style={h4}>Taking the register</h4>
        <p style={p}>
          Tap a gymnast's row to cycle through their attendance status: <strong>Unmarked → Present → Absent → Unmarked</strong>.
          Changes save instantly — there is no submit button. If you mark someone incorrectly, tap again to correct it.
        </p>
        <p style={p}>
          The register list is built from two sources: gymnasts with a confirmed booking for that session, and
          gymnasts with an active standing slot for that session's template. If a gymnast has both, they appear
          only once.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          The register can be updated at any time after the session — there is no lock-out. Attendance history
          is stored against each session instance.
        </p>
      </Section>

      <Section title="Session management">
        <p style={p}>
          Go to <strong>Session Management</strong> under the Sessions Admin menu to manage your recurring
          session templates. Templates are the blueprint; individual session instances are generated from them
          automatically each morning.
        </p>
        <h4 style={h4}>Creating a template</h4>
        <p style={p}>
          Each template defines:
        </p>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}><strong>Day of week</strong> — the recurring day this session runs</li>
          <li style={li}><strong>Start and end time</strong> — displayed on all bookings and in the register</li>
          <li style={li}><strong>Capacity</strong> — maximum number of gymnasts per session; bookings are blocked once this is reached</li>
          <li style={li}><strong>Price</strong> — per-gymnast price charged at checkout (in pence internally; entered in £)</li>
          <li style={li}><strong>Session type</strong> — Trampoline or DMT (Double Mini Trampoline)</li>
          <li style={li}><strong>Minimum age</strong> — optional; gymnasts below this age are prevented from booking</li>
        </ul>
        <h4 style={h4}>When do new sessions appear?</h4>
        <p style={p}>
          The session generator runs at 02:00 every morning. New templates or changes to existing templates are
          picked up in the next run. Sessions are generated for a rolling window of upcoming weeks, so parents
          will start seeing the new slot the following day.
        </p>
        <h4 style={h4}>Deactivating vs deleting a template</h4>
        <p style={p}>
          <strong>Deactivating</strong> a template stops new instances from being generated. Existing future
          instances are left in place and bookings on them remain valid. Use this for a temporary pause.
        </p>
        <p style={p}>
          <strong>Deleting</strong> a template lets you optionally remove all future instances at the same time.
          If you remove future instances, any confirmed bookings on those instances will be cancelled and credits
          issued. Use this when a session is stopping permanently.
        </p>
        <h4 style={h4}>Editing a template</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          Changes to capacity, price, or time only affect future instances. Existing bookings on past or
          already-generated instances are not retroactively changed.
        </p>
      </Section>

      <Section title="Closures">
        <p style={p}>
          Closures block a date range from being bookable — useful for holidays, competitions, or facility
          maintenance. Go to <strong>Closures</strong> under the Sessions Admin menu.
        </p>
        <p style={p}>
          <strong>Note:</strong> creating and deleting closures is restricted to Club Admins. Coaches can view
          closures but cannot create or remove them.
        </p>
        <h4 style={h4}>Creating a closure</h4>
        <p style={p}>
          Enter a start date, an end date, and a reason. When you save:
        </p>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}>All session instances within the date range are marked as cancelled</li>
          <li style={li}>Every confirmed booking on those sessions is cancelled automatically</li>
          <li style={li}>A credit is issued to each affected parent for each cancelled booking, valid for one month</li>
          <li style={li}>The sessions disappear from the member-facing booking calendar</li>
        </ul>
        <h4 style={h4}>Single-day closure</h4>
        <p style={p}>
          Set the start date and end date to the same day to close just one session date. This is useful for
          a one-off bank holiday or a single cancelled session.
        </p>
        <h4 style={h4}>Deleting a closure</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          Deleting a closure removes the closure record but does <strong>not</strong> restore the cancelled
          sessions or refund the credits already issued. If you need to reinstate sessions after an accidental
          closure, contact your system administrator.
        </p>
      </Section>

      <Section title="BG numbers">
        <p style={p}>
          British Gymnastics (BG) membership numbers are required for gymnasts to hold insurance cover during
          sessions. The system tracks each gymnast's number and its verification status.
        </p>
        <h4 style={h4}>Status flow</h4>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}><strong>Not set</strong> — no number has been entered. The gymnast gets a 14-day grace period from their first booking to enter one.</li>
          <li style={li}><strong>PENDING</strong> — a number has been entered by the parent and is waiting for staff verification. The gymnast has a 14-day grace period (3 days if re-entered after an INVALID).</li>
          <li style={li}><strong>VERIFIED</strong> — a coach or admin has confirmed the number is correct. No further action needed.</li>
          <li style={li}><strong>INVALID</strong> — a coach or admin has marked the number as incorrect. The parent is notified by email and prompted to re-enter. A 3-day grace period begins.</li>
        </ul>
        <h4 style={h4}>Grace periods and bookings</h4>
        <p style={p}>
          During a valid grace period, bookings are still allowed — the gymnast is not blocked. Once the grace
          period expires without a verified number, new bookings for that gymnast are blocked until the number
          is verified.
        </p>
        <h4 style={h4}>Verifying or invalidating a number</h4>
        <p style={p}>
          Go to <strong>BG Numbers</strong> under the Members Admin menu. This shows all gymnasts with a
          PENDING number, plus gymnasts who have attended 2 or more sessions without any number on file.
        </p>
        <p style={p}>
          Click a gymnast's row to verify or invalidate their number. Verifying sets the status to VERIFIED
          immediately. Invalidating sets the status to INVALID, emails the parent, and starts the 3-day grace
          period.
        </p>
        <h4 style={h4}>Staff-entered numbers</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          If a coach or admin enters the number directly (from a gymnast's profile), it is set to VERIFIED
          immediately — no grace period or pending review is needed.
        </p>
      </Section>

      <Section title="Credits &amp; charges">
        <p style={p}>
          Go to <strong>Credits &amp; Charges</strong> under the Tools Admin menu to manage both one-time
          credits, recurring monthly credits, and charges for any member.
        </p>

        <h4 style={h4}>One-time credits</h4>
        <p style={p}>
          Search for a member and click <strong>Assign credit</strong>. Enter the amount (£) and how many days
          until the credit expires. Credits are applied automatically at checkout — the system uses the
          soonest-expiring credits first. If a credit is larger than the booking total, the remainder is kept
          as a new credit with the same expiry date.
        </p>
        <p style={p}>
          Credits are also issued automatically by the system when:
        </p>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}>A parent cancels a booking for a future (non-same-day) session</li>
          <li style={li}>A closure is created that cancels a session with confirmed bookings</li>
          <li style={li}>An admin cancels a booking and chooses to issue a credit</li>
        </ul>

        <h4 style={h4}>Recurring credits</h4>
        <p style={p}>
          Recurring credits issue a fixed amount to a member on the 1st of every month automatically.
          Use these for ongoing discounts or allowances — for example, a coaching assistant who receives
          a monthly session credit.
        </p>
        <p style={p}>
          To set one up, scroll to the <strong>Recurring credits</strong> section of the Credits &amp; Charges
          page. Select the member, enter the monthly amount, and optionally set an end date. The first credit
          is issued immediately when you save; subsequent credits are issued on the 1st of each month and
          expire at the end of that month.
        </p>
        <p style={p}>
          To stop a recurring credit, click <strong>Cancel</strong> on the rule in the table. Already-issued
          credits are not affected — only future issuances stop.
        </p>
        <p style={p}>
          Multiple recurring credit rules can be active for the same member at the same time if needed.
        </p>

        <h4 style={h4}>Charges</h4>
        <p style={p}>
          Charges are amounts owed by a member to the club — for example, a private coaching fee or equipment
          purchase. To create a charge, search for the member and click the charges button. Enter:
        </p>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}><strong>Amount</strong> — in £ (stored and processed in pence)</li>
          <li style={li}><strong>Description</strong> — shown to the parent in their cart and on receipts</li>
          <li style={li}><strong>Due date</strong> — the date by which the charge should be paid</li>
        </ul>
        <p style={p}>
          Charges appear in the parent's cart and are settled at checkout alongside session bookings. If a member
          has any overdue charge (past its due date), they cannot make new bookings until it is paid.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          To remove a charge, click the delete button on the charge row. Charges can only be deleted before
          they are paid — once settled, the record is kept for audit purposes.
        </p>
      </Section>

      <Section title="Bookings">
        <p style={p}>
          Individual bookings can be viewed from a session's detail page or through the booking history on a
          member's gymnast profile.
        </p>
        <h4 style={h4}>Booking statuses</h4>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
          <li style={li}><strong>CONFIRMED</strong> — the booking is active and the gymnast has a place in the session.</li>
          <li style={li}><strong>PENDING</strong> — the parent started checkout but has not yet completed payment. Abandoned checkouts are cleared automatically after 2 hours and any held credits are restored.</li>
          <li style={li}><strong>CANCELLED</strong> — the booking has been cancelled, either by the parent, by the system (on closure), or by an admin.</li>
        </ul>
        <h4 style={h4}>Waitlist</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          When a session is full, parents can join the waitlist. If a place becomes available (a booking is
          cancelled), the first person on the waitlist is offered the spot automatically by email and has a
          limited window to accept. If they do not accept in time, the offer moves to the next person.
        </p>
      </Section>

      <Section title="Shop">
        <p style={p}>
          Products are managed from the <strong>Shop Orders</strong> admin page. You can create a new product,
          edit an existing one, and toggle a product active or inactive — inactive products are hidden from
          the member-facing shop.
        </p>
        <p style={p}>
          Each product can have multiple variants (e.g. different sizes or colours). Pricing is set per variant.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          Incoming orders are listed on the same page. Each order has a status that you advance manually:
          PENDING → PROCESSING → SHIPPED → DELIVERED. Click an order to update its status and optionally
          add tracking information.
        </p>
      </Section>

      <Section title="Messages &amp; noticeboard">
        <p style={p}>
          There are two ways to communicate with members: the <strong>Noticeboard</strong> (pinned notices
          that members read at their own pace) and <strong>Messages</strong> (emails sent to a defined audience).
        </p>
        <h4 style={h4}>Noticeboard posts</h4>
        <p style={p}>
          Go to <strong>Noticeboard</strong> in the main nav to create, edit, or delete posts. Posts appear on
          the noticeboard for all members. An unread badge shows members how many new posts they have not yet
          seen. Posts can be targeted to specific recipient groups.
        </p>
        <h4 style={h4}>Email messages</h4>
        <p style={p}>
          Go to <strong>Messages</strong> under the Tools Admin menu to compose and send emails. You can target
          all members, members only (excluding staff), or a specific recipient group. Use the recipient preview
          to confirm who will receive the message before sending.
        </p>
        <p style={p}>
          Messages can be scheduled for a future date and time — the background job delivers them automatically.
          Scheduled messages can be edited or deleted before they are sent.
        </p>
        <h4 style={h4}>Recipient groups</h4>
        <p style={{ ...p, marginBottom: 0 }}>
          Recipient groups are reusable lists of members, managed under <strong>Recipient Groups</strong> in
          the Tools Admin menu. Groups are defined by filter criteria (e.g. all members with an active
          membership, members with a gymnast in a specific session template). The membership of a group is
          evaluated at the time a message or noticeboard post is sent.
        </p>
      </Section>

      <Section title="Automation">
        <p style={p}>
          The following background jobs run automatically. No action is needed from coaches or admins.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
            color: 'var(--booking-text-muted)',
          }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)', whiteSpace: 'nowrap' }}>Job</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)', whiteSpace: 'nowrap' }}>Schedule</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)' }}>What it does</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  job: 'Session generation',
                  schedule: 'Daily at 02:00',
                  description: 'Generates session instances for upcoming weeks based on active templates. New templates and changes are picked up the next morning.',
                },
                {
                  job: 'Membership activation',
                  schedule: 'Daily at 01:00',
                  description: 'Activates any SCHEDULED membership whose start date has arrived. Standing slots attached to that membership become active from the same date.',
                },
                {
                  job: 'Recurring credits',
                  schedule: '1st of month at 09:00',
                  description: 'Issues monthly credits for all active recurring credit rules. Skips rules whose end date has passed and skips members who already received a credit this month.',
                },
                {
                  job: 'Waitlist expiry',
                  schedule: 'Every 15 minutes',
                  description: 'Expires waitlist offers that have not been accepted within the offer window. The next person on the waitlist is offered the spot automatically.',
                },
                {
                  job: 'Stale booking cleanup',
                  schedule: 'Every hour',
                  description: 'Cancels PENDING bookings (abandoned checkouts) that are more than 2 hours old. Credits used on cancelled bookings are restored.',
                },
                {
                  job: 'Weekly session reminder',
                  schedule: 'Monday at 08:00',
                  description: 'Emails parents about sessions with available spots in the coming week. Only sent to parents without an active membership (members are assumed to have standing slots).',
                },
                {
                  job: 'Membership payment reminder',
                  schedule: 'Daily at 09:00',
                  description: 'Emails members whose membership is in PENDING_PAYMENT status, reminding them to add a payment method.',
                },
                {
                  job: 'Scheduled message delivery',
                  schedule: 'Every minute',
                  description: 'Sends noticeboard messages and emails that were scheduled for a future date and time.',
                },
                {
                  job: 'Inactivity warning & deletion',
                  schedule: 'Daily at 02:30',
                  description: 'Warns accounts inactive for ~5.75 months; permanently deletes accounts that reach 6 months of inactivity.',
                },
              ].map((row, i) => (
                <tr key={row.job} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--booking-bg-subtle, rgba(0,0,0,0.03))' }}>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{row.job}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{row.schedule}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', verticalAlign: 'top' }}>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <section style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--booking-border)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Still having trouble?</h3>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Message us directly on WhatsApp and we'll get back to you as soon as we can.
        </p>
        <a
          href="https://wa.me/447700149040"
          target="_blank"
          rel="noopener noreferrer"
          className="bk-btn bk-btn--primary"
          style={{ display: 'inline-block', marginTop: '0.5rem' }}
        >
          Message us on WhatsApp
        </a>
      </section>
    </div>
  );
}

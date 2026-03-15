import React from 'react';
import '../booking-shared.css';

export default function AdminHelpPage() {
  return (
    <div className="bk-page bk-page--md">
      <h2 style={{ marginBottom: '2rem' }}>Coach Help</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Members</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Go to <strong>Members</strong> in the Admin nav to search for a member by name or email. Clicking a member
          opens their profile where you can view their gymnasts' details, consents, British Gymnastics insurance
          numbers, and any health notes added by the parent.
        </p>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          From a gymnast's membership card you can create a new membership, pause or resume an existing one,
          cancel it, or edit the monthly amount. Standing slots (the gymnast's regular weekly session place) can
          be added, removed, or paused from the same view — changes take effect from the date you specify.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          To remove a gymnast from the system, use the remove option on the gymnast record. This also cancels
          any active membership and standing slots for that gymnast.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Sessions</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Session templates define the recurring schedule. Go to <strong>Session Management</strong> under the
          Sessions Admin menu to create a new template or edit an existing one. Each template sets the day of
          the week, start and end time, capacity, session type, price, and an optional age restriction.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          From the main <strong>Sessions</strong> admin view you can click any upcoming session instance to see
          which gymnasts are booked in. From there you can also open the attendance register for that session.
          New templates are picked up by the session generator the following morning.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Register</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          The <strong>Register</strong> nav link becomes active in the 15 minutes before a session starts and
          remains active until 15 minutes after it ends. You can also reach the register directly from any
          session detail page.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Tap a gymnast's row to toggle their attendance between Present and Absent. The register is always
          editable after the session has finished, so you can correct attendance at any time.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Bookings</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Individual bookings can be viewed from a session's detail page or through a gymnast's membership
          history on their member profile.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Booking statuses are: <strong>CONFIRMED</strong> — the booking is active and the gymnast has a place.{' '}
          <strong>PENDING</strong> — the parent started checkout but has not yet completed payment (abandoned
          checkouts are cleared automatically after 2 hours). <strong>CANCELLED</strong> — the booking has been
          cancelled, either by the parent or by the system.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Charges &amp; credits</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Go to <strong>Credits &amp; Charges</strong> under the Tools Admin menu to assign a charge or a credit
          to a member. For a charge, enter the amount, a description, and the due date. For a credit, enter the
          amount and an optional note.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Charges appear in the parent's cart at checkout and offset their cart total. If a charge becomes
          overdue, the parent's ability to make new bookings is blocked until the charge is settled. Credits
          are applied automatically at checkout and reduce the amount the parent pays.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Shop</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Products are managed from the <strong>Shop Orders</strong> admin page. You can create a new product,
          edit an existing one, and toggle a product active or inactive (inactive products are hidden from the
          member-facing shop).
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Incoming orders are listed on the same page. Each order has a status that you advance manually:
          PENDING → PROCESSING → SHIPPED → DELIVERED. Click an order to update its status.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Noticeboard</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Go to <strong>Messages</strong> under the Tools Admin menu to post an announcement. Write the title
          and body, then choose who should receive it: all members, members only, or a specific recipient group.
          Recipient groups are managed separately under <strong>Recipient Groups</strong>.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          To schedule a post for a future date and time, enable the scheduling option and pick the date and time
          before saving. Scheduled messages are delivered automatically by the background job.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Automation</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '1rem' }}>
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
                  description: 'Generates session instances for upcoming weeks based on active templates. New templates are picked up the next morning.',
                },
                {
                  job: 'Membership activation',
                  schedule: 'Daily at 01:00',
                  description: 'Activates any SCHEDULED membership whose start date has arrived. Standing slots attached to that membership become active from the same date.',
                },
                {
                  job: 'Waitlist expiry',
                  schedule: 'Every 15 minutes',
                  description: 'Expires waitlist offers that have not been accepted within the offer window. The next person on the waitlist is automatically offered the spot.',
                },
                {
                  job: 'Stale booking cleanup',
                  schedule: 'Every hour',
                  description: 'Cancels PENDING bookings (abandoned checkouts) that are more than 2 hours old. Credits used on cancelled bookings are restored.',
                },
                {
                  job: 'Weekly session reminder',
                  schedule: 'Monday at 08:00',
                  description: 'Emails parents about sessions with available spots in the coming week. Only sent to parents who have at least one gymnast without an active membership (members are assumed to have standing slots).',
                },
                {
                  job: 'Membership payment reminder',
                  schedule: 'Daily at 09:00',
                  description: 'Emails guardians whose membership is in PENDING_PAYMENT status reminding them to add a payment method.',
                },
                {
                  job: 'Scheduled message delivery',
                  schedule: 'Every minute',
                  description: 'Sends noticeboard messages that were scheduled for a future date/time.',
                },
                {
                  job: 'Inactivity warning & deletion',
                  schedule: 'Daily at 02:30',
                  description: 'Warns accounts that have been inactive for ~5.75 months; deletes accounts inactive for 6 months.',
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
      </section>

      <section style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--booking-border)' }}>
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

import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import '../booking-shared.css';

// ── Shared style tokens ────────────────────────────────────────────────────────

const S = {
  p:    { color: 'var(--booking-text-muted)', marginBottom: '0.65rem', lineHeight: 1.6 },
  pLast:{ color: 'var(--booking-text-muted)', marginBottom: 0, lineHeight: 1.6 },
  h4:   { fontWeight: 700, marginBottom: '0.35rem', marginTop: '1.1rem', fontSize: '0.95rem', color: 'var(--booking-text)' },
  li:   { color: 'var(--booking-text-muted)', marginBottom: '0.35rem', lineHeight: 1.55 },
  dt:   { fontWeight: 600, color: 'var(--booking-text)', marginBottom: '0.1rem' },
  dd:   { color: 'var(--booking-text-muted)', marginBottom: '0.6rem', marginLeft: 0, lineHeight: 1.55 },
};

// ── Reusable components ────────────────────────────────────────────────────────

function Section({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{
      marginBottom: '0.4rem',
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
        <span style={{ fontSize: '0.75rem', color: 'var(--booking-text-muted)', marginLeft: '0.75rem', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0.5rem 1.1rem 1.35rem' }}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Amber callout for admin-only restrictions or important caveats. */
function Note({ children }) {
  return (
    <div style={{
      background: 'rgba(255, 193, 7, 0.1)',
      border: '1px solid rgba(255, 193, 7, 0.4)',
      borderRadius: 'var(--booking-radius)',
      padding: '0.6rem 0.85rem',
      marginBottom: '0.85rem',
      fontSize: '0.9rem',
      color: 'var(--booking-text-muted)',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

/** Green callout for tips and best-practice hints. */
function Tip({ children }) {
  return (
    <div style={{
      background: 'rgba(40, 167, 69, 0.08)',
      border: '1px solid rgba(40, 167, 69, 0.3)',
      borderRadius: 'var(--booking-radius)',
      padding: '0.6rem 0.85rem',
      marginBottom: '0.85rem',
      fontSize: '0.9rem',
      color: 'var(--booking-text-muted)',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

/** Visual divider between sub-topics within a section. */
function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--booking-border)', margin: '1.1rem 0 0' }} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminHelpPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';
  if (!isAdmin) return <Navigate to="/booking/help" replace />;

  return (
    <div className="bk-page bk-page--md">
      <h2 style={{ marginBottom: '0.4rem' }}>Coach &amp; Admin Help</h2>
      <p style={{ ...S.p, marginBottom: '1.5rem' }}>
        Click any section to expand it. Each section covers one area of the admin tools in detail.
      </p>

      {/* ── MEMBERS ─────────────────────────────────────────────────── */}
      <Section title="Members">
        <p style={S.p}>
          Go to <strong>Members</strong> in the Admin nav to find any member by name or email.
          All active members in your club are listed; use the search bar to filter.
        </p>

        <h4 style={S.h4}>Member profile overview</h4>
        <p style={S.p}>Clicking a member opens their full profile. From here you can see:</p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>All gymnasts linked to the account, with date of birth, health notes, and emergency contact</li>
          <li style={S.li}>Consent status — photo consent, health declaration, and code of conduct acceptance</li>
          <li style={S.li}>British Gymnastics membership numbers and their verification status</li>
          <li style={S.li}>Active memberships, standing slots, and booking history per gymnast</li>
          <li style={S.li}>Outstanding and paid charges on the account</li>
          <li style={S.li}>The member's current role (Adult, Coach, or Club Admin)</li>
        </ul>

        <Divider />
        <h4 style={S.h4}>Creating a new member account</h4>
        <p style={S.p}>
          Use the <strong>Add member</strong> button on the Members page. Fill in the member's first name, last
          name, email address, and phone number. The system creates the account and sends a welcome email with
          a link to set their password.
        </p>
        <p style={S.p}>
          Alternatively, members can self-register at the club's sign-up page — they will appear in your members
          list once they complete registration.
        </p>

        <Divider />
        <h4 style={S.h4}>Changing a member's role</h4>
        <p style={S.p}>
          From a member's profile, use the role selector to promote or demote them. Roles and what they unlock:
        </p>
        <dl style={{ marginBottom: '0.5rem' }}>
          <dt style={S.dt}>Adult</dt>
          <dd style={S.dd}>Default role. Can book sessions, manage their gymnasts, view their account, and read the noticeboard.</dd>
          <dt style={S.dt}>Coach</dt>
          <dd style={S.dd}>Full access to admin tools — sessions, members, register, credits, charges, messages, and shop. Cannot create or delete closures.</dd>
          <dt style={S.dt}>Club Admin</dt>
          <dd style={S.dd}>Everything a Coach can do, plus creating and deleting closures and full system configuration.</dd>
        </dl>
        <Note>
          <strong>Admin-only:</strong> Only Club Admins can change a member's role to Club Admin.
        </Note>

        <Divider />
        <h4 style={S.h4}>Memberships and standing slots</h4>
        <p style={S.p}>
          From a gymnast's membership card you can:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Create</strong> a new membership — set the monthly amount and start date. The gymnast is charged monthly via Stripe once a payment method is added.</li>
          <li style={S.li}><strong>Edit</strong> the monthly amount — the new amount applies from the next billing cycle.</li>
          <li style={S.li}><strong>Pause</strong> a membership — stops billing temporarily. Standing slots are suspended and the gymnast cannot book sessions.</li>
          <li style={S.li}><strong>Resume</strong> a paused membership — billing and standing slots resume from the date you specify.</li>
          <li style={S.li}><strong>Cancel</strong> a membership — stops future billing. The membership remains active until the end of the current paid period.</li>
        </ul>
        <p style={S.p}>
          Standing slots (the gymnast's regular weekly session place) are managed from the same view. Each slot
          is linked to a session template and has a start date — the gymnast begins appearing on the register
          from that date. Standing slots can be added, paused, resumed, or removed independently of the membership.
        </p>
        <Tip>
          <strong>Tip:</strong> If a gymnast's regular day changes, remove the old standing slot and add a new
          one with the appropriate start date rather than editing in place — this preserves the attendance history
          on the old slot.
        </Tip>

        <Divider />
        <h4 style={S.h4}>Archiving and removing members</h4>
        <p style={S.p}>
          <strong>Archiving</strong> a member hides them from the active members list and prevents new bookings
          but retains all their data for audit and reporting purposes. Archived members can be reinstated.
          Use this for members who have left the club but whose records you want to keep.
        </p>
        <p style={S.pLast}>
          <strong>Removing a gymnast</strong> from a member's profile permanently deletes that gymnast record,
          cancels any active membership and standing slots, and removes them from the booking system. This
          cannot be undone.
        </p>
      </Section>

      {/* ── SESSIONS ────────────────────────────────────────────────── */}
      <Section title="Sessions">
        <p style={S.p}>
          The <strong>Sessions</strong> admin view shows all upcoming session instances across all templates.
          Use the month navigation to move between months. Click any session to open its detail page.
        </p>

        <h4 style={S.h4}>What you can see on a session detail page</h4>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>The full list of confirmed bookings, including gymnast name, guardian, and payment status</li>
          <li style={S.li}>Current occupancy vs capacity</li>
          <li style={S.li}>Waitlist entries (names of members waiting for a place)</li>
          <li style={S.li}>A direct link to the attendance register for that session</li>
        </ul>

        <Divider />
        <h4 style={S.h4}>Manually adding a gymnast to a session</h4>
        <p style={S.p}>
          Use <strong>Add gymnast</strong> on the session detail page to place any gymnast directly into a
          session, bypassing payment. This is useful for:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>Make-up sessions for gymnasts who missed a standing slot</li>
          <li style={S.li}>Trial sessions for prospective members</li>
          <li style={S.li}>Correcting a booking that was made in error or under the wrong account</li>
        </ul>
        <Note>
          Manually adding a gymnast does not take payment or generate an invoice. If a charge is appropriate,
          raise it separately via Credits &amp; Charges.
        </Note>

        <Divider />
        <h4 style={S.h4}>Cancelling a booking as an admin</h4>
        <p style={S.p}>
          You can cancel any confirmed booking from the session detail page or from the gymnast's profile.
          When cancelling you are asked whether to issue a credit:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Issue credit</strong> — a credit equal to the booking amount is added to the member's account, valid for one month from the cancellation date.</li>
          <li style={S.li}><strong>No credit</strong> — the booking is cancelled with no compensation. Use this for no-shows or disciplinary situations.</li>
        </ul>
        <p style={S.p}>
          The default for admin cancellations is determined by whether the session is today or in the future —
          same-day cancellations default to no credit, future cancellations default to issuing one. You can
          override either way.
        </p>

        <Divider />
        <h4 style={S.h4}>Session types and DMT approval</h4>
        <p style={S.pLast}>
          Sessions are typed as <strong>Trampoline</strong> or <strong>DMT</strong> (Double Mini Trampoline).
          DMT sessions require each gymnast to have DMT approval on their profile before they can be booked.
          Approval is granted by a coach from the gymnast's profile page. Adults cannot override this — if
          an adult tries to book a DMT session without approval, they will see an access error.
        </p>
      </Section>

      {/* ── SESSION MANAGEMENT ──────────────────────────────────────── */}
      <Section title="Session management">
        <p style={S.p}>
          Go to <strong>Session Management</strong> under the Sessions Admin menu to manage session templates.
          Templates define the repeating schedule; the system generates individual session instances from them
          automatically every morning at 02:00.
        </p>

        <h4 style={S.h4}>Template fields explained</h4>
        <dl style={{ marginBottom: '0.5rem' }}>
          <dt style={S.dt}>Day of week</dt>
          <dd style={S.dd}>The day this session repeats. A template creates one session instance per week on that day.</dd>
          <dt style={S.dt}>Start and end time</dt>
          <dd style={S.dd}>Shown to adults on the booking calendar, in confirmation emails, and in the register header.</dd>
          <dt style={S.dt}>Capacity</dt>
          <dd style={S.dd}>Maximum gymnasts per session. Once reached, the session shows as full and adults are offered the waitlist instead.</dd>
          <dt style={S.dt}>Price</dt>
          <dd style={S.dd}>Per-gymnast price charged at checkout, in pounds. Stored internally in pence to avoid rounding errors.</dd>
          <dt style={S.dt}>Session type</dt>
          <dd style={S.dd}>Trampoline or DMT. DMT sessions require individual gymnast approval before booking is permitted.</dd>
          <dt style={S.dt}>Minimum age</dt>
          <dd style={S.dd}>Optional. If set, gymnasts below this age cannot be booked into this session. Calculated from the gymnast's date of birth at the time of booking.</dd>
        </dl>

        <Divider />
        <h4 style={S.h4}>How far ahead are sessions generated?</h4>
        <p style={S.p}>
          The session generator creates instances for a rolling window of upcoming weeks. A newly created
          template will have its first instances visible to adults the morning after you save it. If you need
          sessions to appear immediately (e.g. for same-week bookings), contact your system administrator to
          trigger a manual run.
        </p>

        <Divider />
        <h4 style={S.h4}>Deactivating a template (temporary pause)</h4>
        <p style={S.p}>
          Toggle a template inactive to stop new instances being generated. Existing future instances remain
          in the system — adults can still book them and standing-slot gymnasts still appear on the register
          for those dates. Use this when a session is pausing for a few weeks but will resume.
        </p>
        <Tip>
          <strong>Tip:</strong> If you want to pause a session for a specific date range only, use a
          Closure instead — it handles credits automatically.
        </Tip>

        <Divider />
        <h4 style={S.h4}>Deleting a template (permanent removal)</h4>
        <p style={S.p}>
          When you delete a template you are asked whether to also delete all future session instances:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Delete future instances</strong> — all future instances are removed, confirmed bookings are cancelled, and credits are issued to affected adults. Choose this when the session is stopping for good.</li>
          <li style={S.li}><strong>Keep future instances</strong> — existing instances remain bookable and the template is removed so no new instances are generated. Use this if you want to let the session naturally wind down.</li>
        </ul>
        <Note>
          Deleting a template is irreversible. Recreating it will not restore historical attendance data or
          past booking records.
        </Note>

        <Divider />
        <h4 style={S.h4}>Editing a template</h4>
        <p style={S.pLast}>
          Changes to capacity, price, time, or type apply to newly generated future instances only. Already-
          generated instances and any bookings on them are not retroactively updated. If you need to reflect
          a price change on an existing instance, cancel and re-book the affected gymnasts manually, or raise
          a charge for any difference.
        </p>
      </Section>

      {/* ── CLOSURES ────────────────────────────────────────────────── */}
      <Section title="Closures">
        <Note>
          <strong>Club Admin only.</strong> Coaches can view closures but cannot create or delete them. If you
          need a closure created, ask a Club Admin.
        </Note>
        <p style={S.p}>
          A closure blocks a date range across all sessions — useful for school holidays, competitions, facility
          maintenance, or any period when no sessions should run. Go to <strong>Closures</strong> under the
          Sessions Admin menu.
        </p>

        <h4 style={S.h4}>What happens when you create a closure</h4>
        <p style={S.p}>Creating a closure immediately:</p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>Marks every session instance within the date range as cancelled</li>
          <li style={S.li}>Cancels every confirmed booking on those sessions</li>
          <li style={S.li}>Issues a credit to every affected adult for each cancelled booking, valid for one month</li>
          <li style={S.li}>Hides those session dates from the member-facing booking calendar</li>
          <li style={S.li}>Sends no individual cancellation emails — adults will see the closure reason if they check their bookings</li>
        </ul>
        <Tip>
          <strong>Tip:</strong> If you want to notify members about the closure, send a Message or post to the
          Noticeboard after saving — the closure itself does not trigger any outbound emails.
        </Tip>

        <Divider />
        <h4 style={S.h4}>Single-day closure</h4>
        <p style={S.p}>
          Set the start date and end date to the same day to close sessions on one specific date only.
          This is the right approach for a one-off bank holiday, a single cancelled session day, or a
          last-minute facility problem.
        </p>

        <Divider />
        <h4 style={S.h4}>Multiple session types on the same day</h4>
        <p style={S.p}>
          A closure cancels all session types (Trampoline and DMT) within the date range. There is no way to
          close one session type and not another for the same date — if that level of control is needed, cancel
          the individual bookings on the affected sessions manually instead.
        </p>

        <Divider />
        <h4 style={S.h4}>Deleting a closure</h4>
        <p style={S.pLast}>
          Deleting a closure removes the closure record from the list but does <strong>not</strong> restore
          the cancelled sessions, reinstate the bookings, or revoke the credits that were issued. The only
          effect is that the date range is no longer shown as a closure in the admin list. If sessions were
          cancelled in error, they need to be recreated manually and adults re-booked — contact your
          system administrator.
        </p>
      </Section>

      {/* ── REGISTER ────────────────────────────────────────────────── */}
      <Section title="Register">
        <p style={S.p}>
          The attendance register lets you record who is present at each session. It is optimised for
          use on a phone — large tap targets, instant save.
        </p>

        <h4 style={S.h4}>Accessing the register</h4>
        <p style={S.p}>
          The <strong>Register</strong> link in the Sessions dropdown highlights automatically when a session
          is active (from 15 minutes before start until the session ends). If multiple sessions are running
          at the same time, each appears as a separate link. You can also open the register directly from any
          session detail page at any time.
        </p>

        <Divider />
        <h4 style={S.h4}>Taking the register</h4>
        <p style={S.p}>
          Tap a gymnast's row to cycle through their status:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Unmarked</strong> (grey) — default; no attendance decision recorded yet</li>
          <li style={S.li}><strong>Present</strong> (green) — gymnast attended</li>
          <li style={S.li}><strong>Absent</strong> (red) — gymnast did not attend</li>
        </ul>
        <p style={S.p}>
          Tap again to continue cycling: Present → Absent → Unmarked → Present… Changes save instantly with
          no submit button. The summary at the top of the page updates live.
        </p>

        <Divider />
        <h4 style={S.h4}>Who appears on the register?</h4>
        <p style={S.p}>
          The register list combines two sources:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Confirmed bookings</strong> — any gymnast with a CONFIRMED booking for that specific session instance</li>
          <li style={S.li}><strong>Active standing slots</strong> — any gymnast with an active standing slot on that session's template, where the slot's start date is on or before the session date</li>
        </ul>
        <p style={S.p}>
          If a gymnast has both a booking and a standing slot, they appear only once. The list is sorted
          alphabetically by first name.
        </p>
        <Note>
          If a gymnast turns up who is not on the register, they either do not have a confirmed booking or
          their standing slot has not started yet. You can add them manually from the session detail page —
          this will create a booking record for them.
        </Note>

        <Divider />
        <h4 style={S.h4}>Editing the register after the session</h4>
        <p style={S.pLast}>
          There is no cut-off for editing attendance. You can open any past session's register and correct
          marks at any time. Attendance records are stored permanently against the session instance and are
          visible in the audit log.
        </p>
      </Section>

      {/* ── BG NUMBERS ──────────────────────────────────────────────── */}
      <Section title="BG numbers">
        <p style={S.p}>
          British Gymnastics (BG) membership provides insurance cover for gymnasts during sessions. Each
          gymnast's BG number needs to be on file and verified before they are fully covered. The system
          enforces this with a grace period system that allows adults time to provide the number without
          immediately blocking bookings.
        </p>

        <h4 style={S.h4}>Status flow</h4>
        <dl style={{ marginBottom: '0.5rem' }}>
          <dt style={S.dt}>Not set</dt>
          <dd style={S.dd}>No number has been entered for this gymnast. They begin with a 14-day grace period from the date of their first session booking. During grace, bookings are allowed.</dd>
          <dt style={S.dt}>PENDING</dt>
          <dd style={S.dd}>The adult has entered a number and it is waiting for a coach or admin to verify it. The gymnast retains a grace period — 14 days from entry if this is their first submission, or 3 days if they are re-submitting after an INVALID.</dd>
          <dt style={S.dt}>VERIFIED</dt>
          <dd style={S.dd}>A coach or admin has confirmed the number is correct and current. No further action is needed unless the membership expires and is renewed with a new number.</dd>
          <dt style={S.dt}>INVALID</dt>
          <dd style={S.dd}>A coach or admin has rejected the number. The adult is notified by email and prompted to re-enter. A 3-day grace period begins from the moment the number is marked invalid.</dd>
        </dl>

        <Divider />
        <h4 style={S.h4}>Grace periods in detail</h4>
        <p style={S.p}>
          Grace periods exist so that a booking is never blocked mid-flow because of a missing number. The
          rules are:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>First submission</strong> — 14-day grace from the date the adult enters the number. Bookings are allowed while PENDING.</li>
          <li style={S.li}><strong>After INVALID</strong> — 3-day grace once the adult re-enters a number. Shorter window as it is a correction, not an initial submission.</li>
          <li style={S.li}><strong>Grace expired with no number</strong> — new bookings for that gymnast are blocked until a number is verified. Existing confirmed bookings are not affected.</li>
        </ul>
        <Tip>
          <strong>Tip:</strong> Encourage adults to enter their BG number at registration and tell them to
          renew it each membership year. Remind members at the start of the gymnastics season.
        </Tip>

        <Divider />
        <h4 style={S.h4}>Verifying or invalidating a number</h4>
        <p style={S.p}>
          Go to <strong>BG Numbers</strong> under the Members Admin menu. This view shows:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>All gymnasts with a <strong>PENDING</strong> number waiting for review</li>
          <li style={S.li}>Gymnasts who have attended <strong>2 or more sessions</strong> without any BG number on file at all — these are a priority as their insurance cover is unconfirmed</li>
        </ul>
        <p style={S.p}>
          Click a gymnast's row to see their number and take action:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Verify</strong> — sets status to VERIFIED. The gymnast's insurance is confirmed. No email is sent.</li>
          <li style={S.li}><strong>Invalidate</strong> — sets status to INVALID. An email is sent to the adult asking them to re-enter the correct number. A 3-day grace period begins.</li>
        </ul>

        <Divider />
        <h4 style={S.h4}>Staff-entered numbers</h4>
        <p style={S.p}>
          If a coach or admin enters a BG number directly from a gymnast's profile (rather than the adult
          entering it), the number is set to <strong>VERIFIED immediately</strong> — no pending review or grace
          period. Use this when an adult gives you the number verbally or when correcting an obvious typo on
          their behalf.
        </p>

        <Divider />
        <h4 style={S.h4}>Daily digest email</h4>
        <p style={S.pLast}>
          At 07:30 every morning, a summary email is sent to all coaches and admins listing gymnasts with
          PENDING numbers awaiting review. This keeps the queue visible without requiring manual checks.
          The digest is only sent if there are gymnasts in the queue.
        </p>
      </Section>

      {/* ── CREDITS & CHARGES ───────────────────────────────────────── */}
      <Section title="Credits &amp; charges">
        <p style={S.p}>
          Go to <strong>Credits &amp; Charges</strong> under the Tools Admin menu. Credits reduce what an adult
          pays at checkout; charges add to it.
        </p>

        <h4 style={S.h4}>How credits work at checkout</h4>
        <p style={S.p}>
          Credits are applied automatically when an adult checks out. The system uses the soonest-expiring
          credit first to reduce waste. If the total credit exceeds the basket amount, the remainder is
          preserved as a new credit with the same expiry date. Credits are visible to the member on their
          Account page.
        </p>

        <Divider />
        <h4 style={S.h4}>One-time credits</h4>
        <p style={S.p}>
          Search for a member on the Credits &amp; Charges page and click <strong>Assign credit</strong>.
          Enter:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Amount (£)</strong> — the credit value; converted to pence internally</li>
          <li style={S.li}><strong>Expires after (days)</strong> — how many days until the credit expires and is no longer usable at checkout</li>
        </ul>
        <p style={S.p}>
          Credits are also issued automatically by the system in three situations:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>An adult cancels a booking for a session that is not today (same-day cancellations receive no credit by default)</li>
          <li style={S.li}>A closure is created that cancels sessions with confirmed bookings</li>
          <li style={S.li}>A coach or admin cancels a booking and chooses to issue a credit</li>
        </ul>

        <Divider />
        <h4 style={S.h4}>Recurring credits</h4>
        <p style={S.p}>
          Recurring credits issue a fixed amount to a member automatically on the 1st of every month.
          Useful for ongoing allowances — for example, a member who helps with coaching and receives a
          monthly session discount.
        </p>
        <p style={S.p}>
          To set one up, scroll to the <strong>Recurring credits</strong> section and fill in:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Member</strong> — the account to receive the credit each month</li>
          <li style={S.li}><strong>Monthly amount (£)</strong> — fixed amount issued each time</li>
          <li style={S.li}><strong>End date (optional)</strong> — if set, the rule stops issuing after this date. Leave blank for indefinite.</li>
        </ul>
        <p style={S.p}>
          The first credit is issued immediately when you save. Subsequent credits are issued on the 1st of
          each month and expire at the end of that same month — so a February credit expires on the last day
          of February.
        </p>
        <p style={S.p}>
          Active rules are shown in the table. To stop a rule, click <strong>Cancel</strong> — already-issued
          credits remain valid and are not revoked. Multiple rules for the same member are allowed if needed
          (e.g. two separate discounts).
        </p>
        <Note>
          Recurring credits are skipped automatically if a member's account is archived or if the rule's end
          date has passed. They cannot be issued twice in the same month even if the cron runs more than once.
        </Note>

        <Divider />
        <h4 style={S.h4}>Charges</h4>
        <p style={S.p}>
          Charges are amounts the member owes the club outside of normal session booking — for example, a
          private coaching fee, equipment hire, or competition entry. To create a charge, find the member and
          use the charge button. Enter:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>Amount (£)</strong> — the amount owed</li>
          <li style={S.li}><strong>Description</strong> — shown to the adult in their cart, on their charges page, and on receipts. Be specific (e.g. "Private coaching session 14 March" rather than "Extra session").</li>
          <li style={S.li}><strong>Due date</strong> — the date by which payment is expected</li>
        </ul>
        <p style={S.p}>
          Charges appear in the member's cart alongside any session bookings and are paid together at checkout.
          Credits are applied to the combined total (sessions + charges) at once.
        </p>
        <p style={S.p}>
          <strong>Overdue charges block new bookings.</strong> If a charge is past its due date and unpaid, the
          member cannot make any new bookings until the charge is settled. They will see a warning banner on the
          booking pages.
        </p>
        <p style={S.pLast}>
          To remove a charge, click the delete icon on the charge row. Charges can only be deleted while
          unpaid — once settled the record is permanent and visible in the audit log. A confirmation prompt
          appears before deletion.
        </p>
      </Section>

      {/* ── BOOKINGS ────────────────────────────────────────────────── */}
      <Section title="Bookings">
        <p style={S.p}>
          Bookings can be viewed from a session's detail page or from a gymnast's profile in the member view.
        </p>

        <h4 style={S.h4}>Booking statuses</h4>
        <dl style={{ marginBottom: '0.5rem' }}>
          <dt style={S.dt}>CONFIRMED</dt>
          <dd style={S.dd}>The booking is active. The gymnast has a reserved place and will appear on the session register.</dd>
          <dt style={S.dt}>PENDING</dt>
          <dd style={S.dd}>The adult started checkout but has not yet completed payment. The place is held temporarily. Abandoned checkouts are cleared automatically after 2 hours and the place is released.</dd>
          <dt style={S.dt}>CANCELLED</dt>
          <dd style={S.dd}>The booking was cancelled — by the adult, by the system (during a closure), or by an admin. The gymnast is removed from the session and the place becomes available again.</dd>
        </dl>

        <Divider />
        <h4 style={S.h4}>How adults book</h4>
        <p style={S.p}>
          Adults book from the main booking calendar. They select a session, choose which gymnasts to bring
          (from their linked gymnasts), and proceed to checkout. The combined checkout lets an adult book
          multiple gymnasts across multiple sessions in one transaction, with credits and charges applied to
          the total.
        </p>
        <p style={S.p}>
          Available credits are automatically deducted at checkout. Any remaining balance is paid by card via
          Stripe. If a member has an overdue charge, they must settle it in the same checkout before other
          bookings can be confirmed.
        </p>

        <Divider />
        <h4 style={S.h4}>Waitlist</h4>
        <p style={S.pLast}>
          When a session reaches capacity, adults can join the waitlist. Positions are first-come first-served.
          When a booking is cancelled, the first waitlisted member receives an automated offer by email with a
          time-limited link to accept the place. If they do not accept within the offer window, the place is
          offered to the next person. The waitlist offer window expires automatically — no manual action needed.
        </p>
      </Section>

      {/* ── SHOP ────────────────────────────────────────────────────── */}
      <Section title="Shop">
        <p style={S.p}>
          The shop lets members purchase club merchandise, equipment, or other items alongside or separately
          from session bookings. Manage it from <strong>Shop Orders</strong> in the Admin nav.
        </p>

        <h4 style={S.h4}>Managing products</h4>
        <p style={S.p}>
          Each product has a name, description, image, and one or more variants. Variants let you sell
          different sizes, colours, or configurations of the same product, each with its own price and stock
          status. To add a product:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>Click <strong>Add product</strong> and fill in the name, description, and optional image</li>
          <li style={S.li}>Add at least one variant with a name (e.g. "Size S") and a price</li>
          <li style={S.li}>Set the product to <strong>Active</strong> to make it visible in the shop</li>
        </ul>
        <p style={S.p}>
          <strong>Inactive products</strong> are hidden from the member-facing shop but remain in the admin
          list. Toggle a product inactive rather than deleting it if you may want to re-list it later.
        </p>

        <Divider />
        <h4 style={S.h4}>Fulfilling orders</h4>
        <p style={S.p}>
          Incoming orders appear in the orders list. Advance the status as you fulfil each order:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}><strong>PENDING</strong> — order placed and paid, awaiting action</li>
          <li style={S.li}><strong>PROCESSING</strong> — order is being prepared</li>
          <li style={S.li}><strong>SHIPPED</strong> — order dispatched (if delivered by post)</li>
          <li style={S.li}><strong>DELIVERED</strong> — order received by the member</li>
        </ul>
        <p style={S.pLast}>
          Click an order to update its status. There is no automated notification to the member when the
          status changes — if you want to inform them, send a message manually.
        </p>
      </Section>

      {/* ── MESSAGES & NOTICEBOARD ──────────────────────────────────── */}
      <Section title="Messages &amp; noticeboard">
        <p style={S.p}>
          Two communication tools are available: the <strong>Noticeboard</strong> for persistent pinned
          announcements, and <strong>Messages</strong> for targeted emails sent to a defined audience.
        </p>

        <h4 style={S.h4}>Noticeboard</h4>
        <p style={S.p}>
          Noticeboard posts are visible to all members (or a targeted group) from the Noticeboard page in
          the main nav. An unread badge shows members how many posts they have not yet seen — it disappears
          once they open each post.
        </p>
        <p style={S.p}>
          To post: go to <strong>Noticeboard</strong>, click <strong>New post</strong>, write the title and
          body, choose the audience (all members or a specific recipient group), and publish. Posts stay on
          the noticeboard until you delete them — there is no automatic expiry.
        </p>
        <Tip>
          <strong>Tip:</strong> Use the noticeboard for information that members should be able to refer back
          to — upcoming competition dates, policy updates, coach announcements. Use Messages for time-sensitive
          emails that need to reach inboxes immediately.
        </Tip>

        <Divider />
        <h4 style={S.h4}>Email messages</h4>
        <p style={S.p}>
          Go to <strong>Messages</strong> under the Tools Admin menu. Messages are sent as emails to the
          selected audience. The workflow is:
        </p>
        <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem' }}>
          <li style={S.li}>Write the subject and body (plain text or basic formatting)</li>
          <li style={S.li}>Choose the audience: all members, adults only, or a specific recipient group</li>
          <li style={S.li}>Use <strong>Preview recipients</strong> to see exactly who will receive it before you send</li>
          <li style={S.li}>Send immediately or schedule for a specific date and time</li>
        </ul>
        <p style={S.p}>
          Scheduled messages can be edited or deleted at any time before they are sent. Once sent, a message
          cannot be recalled — use the preview carefully before sending to a large audience.
        </p>

        <Divider />
        <h4 style={S.h4}>Recipient groups</h4>
        <p style={S.pLast}>
          Recipient groups are reusable audience definitions, managed under <strong>Recipient Groups</strong>
          in the Tools Admin menu. A group is defined by filter criteria — for example: all members with an
          active membership, all members with a gymnast attending a specific session template, or members who
          joined after a certain date. Group membership is evaluated dynamically at the moment a message or
          noticeboard post is sent, so the list is always current.
        </p>
      </Section>

      {/* ── AUTOMATION ──────────────────────────────────────────────── */}
      <Section title="Automation">
        <p style={S.p}>
          The following background jobs run automatically. No action is needed from coaches or admins unless
          something appears to have failed — in that case, check the audit log or contact your system administrator.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)', whiteSpace: 'nowrap' }}>Job</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)', whiteSpace: 'nowrap' }}>Schedule</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--booking-border)' }}>What it does</th>
              </tr>
            </thead>
            <tbody>
              {[
                { job: 'Session generation', schedule: 'Daily 02:00', description: 'Generates session instances for the rolling upcoming window from all active templates. New or changed templates are picked up the morning after they are saved.' },
                { job: 'Membership activation', schedule: 'Daily 01:00', description: 'Activates SCHEDULED memberships whose start date has arrived. Standing slots linked to the membership also activate from the same date.' },
                { job: 'Recurring credits', schedule: '1st of month 09:00', description: 'Issues monthly credits for all active recurring credit rules. Skips archived members, rules past their end date, and rules already issued this month (idempotent).' },
                { job: 'Waitlist expiry', schedule: 'Every 15 min', description: 'Expires waitlist offers not accepted within the offer window and automatically offers the place to the next person in the queue.' },
                { job: 'Stale booking cleanup', schedule: 'Every hour', description: 'Cancels PENDING bookings (abandoned checkouts) older than 2 hours. Any credits that were held against the booking are restored to the member.' },
                { job: 'BG number digest', schedule: 'Daily 07:30', description: 'Emails all coaches and admins a list of gymnasts with PENDING BG numbers awaiting verification, and gymnasts who have attended 2+ sessions with no number at all. Only sent when there are gymnasts in the queue.' },
                { job: 'Weekly session reminder', schedule: 'Monday 08:00', description: 'Emails adults (without an active membership) about sessions with available spots in the coming week, to encourage ad-hoc bookings.' },
                { job: 'Membership payment reminder', schedule: 'Daily 09:00', description: 'Emails members whose membership is PENDING_PAYMENT, reminding them to add a payment method so their membership can activate.' },
                { job: 'Scheduled message delivery', schedule: 'Every minute', description: 'Sends noticeboard messages and emails that were written with a future scheduled send time.' },
                { job: 'Inactivity warning & deletion', schedule: 'Daily 02:30', description: 'Sends a warning email to accounts inactive for ~5.75 months. Permanently deletes accounts that reach 6 months of inactivity with no logins or bookings.' },
                { job: 'New member digest', schedule: 'Daily 08:00', description: 'Emails staff a summary of members who registered in the last 24 hours. Only sent when new registrations exist.' },
              ].map((row, i) => (
                <tr key={row.job} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--booking-bg-subtle, rgba(0,0,0,0.03))' }}>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 500 }}>{row.job}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{row.schedule}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--booking-border)', verticalAlign: 'top' }}>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── STILL HAVING TROUBLE ────────────────────────────────────── */}
      <section style={{ marginTop: '1.25rem', paddingTop: '1.5rem', borderTop: '1px solid var(--booking-border)' }}>
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

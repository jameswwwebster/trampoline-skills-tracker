import React from 'react';
import './booking-shared.css';

export default function HelpPage() {
  return (
    <div className="bk-page bk-page--md">
      <h2 style={{ marginBottom: '2rem' }}>Help</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Bookings</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          Use the <strong>Bookings</strong> menu to view the calendar and book sessions for your gymnasts. Select a date
          on the calendar to see available sessions, then choose the gymnasts you want to book and complete
          the checkout.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          To cancel a booking, go to <strong>My Bookings</strong> and use the cancel option next to the session. If a
          session is full, you can join the waitlist and you will be notified if a place becomes available.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Memberships</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          A membership gives a gymnast access to regular training sessions. Memberships are set up by the club
          and assigned to individual gymnasts. You can view your gymnasts' memberships from the{' '}
          <strong>Account</strong> page.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Membership statuses mean the following: <strong>ACTIVE</strong> — the membership is live and sessions
          can be booked. <strong>SCHEDULED</strong> — the membership is confirmed but has not yet started.{' '}
          <strong>PENDING PAYMENT</strong> — a payment method is required before the membership activates.{' '}
          <strong>PAUSED</strong> — the membership is temporarily on hold.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Standing slots</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          A standing slot is a recurring weekly booking that comes with a membership — your gymnast's regular
          place in a session each week. Standing slots are managed by the club and attached to the gymnast's
          membership.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          You can see your gymnast's standing slots on the <strong>Account</strong> page alongside their
          membership details.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Shop</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          The shop lets you purchase club merchandise and other items. Browse products from the{' '}
          <strong>Shop</strong> menu, select the items you want, and add them to your cart.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          When you're ready, go to your cart and complete the checkout using a saved payment method or a new
          card. You can view past orders under <strong>My Orders</strong>.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Account &amp; payments</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          The <strong>Account</strong> page shows your linked gymnasts, their memberships, and your saved payment
          methods. You can add or update a payment method there at any time.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          Any outstanding charges from the club appear under <strong>My Charges</strong> in the Bookings menu.
          Charges are settled through the cart — add them to your cart and check out to pay. If you have a
          credit balance with the club, it will be displayed on your Account page and applied automatically at
          checkout.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Noticeboard</h3>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          The <strong>Noticeboard</strong> shows announcements and updates posted by the club. Unread notices
          are highlighted with a badge in the navigation bar. Visit the Noticeboard page to read all current
          notices.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Cancellations &amp; credits</h3>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          <strong>Session bookings:</strong> You can cancel a booking at any time from <strong>My Bookings</strong>.
          If you cancel a booking for a future session, the amount paid is returned as a credit to your account,
          valid for one month. Cancellations for sessions on the same day are not eligible for a credit.
        </p>
        <p style={{ color: 'var(--booking-text-muted)', marginBottom: '0.5rem' }}>
          <strong>Memberships:</strong> Memberships can be cancelled at any time and will not renew after
          cancellation. If you cancel part-way through a month, your membership remains active until the end of
          the period already paid for.
        </p>
        <p style={{ color: 'var(--booking-text-muted)' }}>
          If you have a question about a booking or payment, please use the{' '}
          <strong>Having trouble?</strong> button at the top of the page to message us directly.
        </p>
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

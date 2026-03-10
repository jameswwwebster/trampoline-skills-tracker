import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bookingApi } from '../../utils/bookingApi';
import './BookingLayout.css';

function getCartSlotCount() {
  try {
    const saved = sessionStorage.getItem('booking-cart');
    return saved ? JSON.parse(saved).reduce((s, [, g]) => s + g.length, 0) : 0;
  } catch { return 0; }
}

export default function BookingLayout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';
  const [paymentBanner, setPaymentBanner] = useState(null); // null | 'pending' | 'needs_method'
  const [cartCount, setCartCount] = useState(getCartSlotCount);

  useEffect(() => {
    const handler = () => setCartCount(getCartSlotCount());
    window.addEventListener('booking-cart-update', handler);
    return () => window.removeEventListener('booking-cart-update', handler);
  }, []);

  useEffect(() => {
    if (!user || isAdmin) return;
    bookingApi.getMyMemberships()
      .then(r => {
        const memberships = r.data;
        if (memberships.some(m => m.status === 'PENDING_PAYMENT')) {
          setPaymentBanner('pending');
        } else if (memberships.some(m => m.needsPaymentMethod)) {
          setPaymentBanner('needs_method');
        }
      })
      .catch(() => {});
  }, [user, isAdmin]);

  return (
    <div className="booking-layout">
      <nav className="booking-layout__nav">
        {/* Top row: brand + user + logout */}
        <div className="booking-layout__topbar">
          <span className="booking-layout__brand">Trampoline Life</span>
          <div className="booking-layout__user">
            {user && (
              <span className="booking-layout__username">
                {user.firstName} {user.lastName}
              </span>
            )}
            <button className="booking-layout__logout" onClick={logout}>Log out</button>
          </div>
        </div>

        {/* Bottom row: scrollable links */}
        <div className="booking-layout__links">
          <NavLink to="/booking" end>Calendar</NavLink>
          {!isAdmin && cartCount > 0 && (
            <NavLink to="/booking" end className="booking-layout__cart-link">
              Cart ({cartCount})
            </NavLink>
          )}
          <NavLink to="/booking/my-bookings">My Bookings</NavLink>
          <NavLink to="/booking/my-account">My Account</NavLink>
          {isAdmin && (
            <>
              <span className="booking-layout__admin-divider" />
              <span className="booking-layout__admin-label">Admin</span>
              <NavLink to="/booking/admin" className="booking-layout__admin-link">Sessions</NavLink>
              <NavLink to="/booking/admin/members" className="booking-layout__admin-link">Members</NavLink>
              <NavLink to="/booking/admin/messages" className="booking-layout__admin-link">Messages</NavLink>
              <NavLink to="/booking/admin/bg-numbers" className="booking-layout__admin-link">BG Numbers</NavLink>
              <NavLink to="/booking/admin/closures" className="booking-layout__admin-link">Closures</NavLink>
              <NavLink to="/booking/admin/audit-log" className="booking-layout__admin-link">Audit Log</NavLink>
            </>
          )}
        </div>
      </nav>

      {paymentBanner && (
        <Link to="/booking/my-account" className="booking-layout__payment-banner">
          {paymentBanner === 'pending' ? (
            <>
              <span>⚠ Membership payment required — your membership is not yet active.</span>
              <span className="booking-layout__payment-banner-cta">Set up payment →</span>
            </>
          ) : (
            <>
              <span>⚠ Payment method required — your membership won't renew without a card on file.</span>
              <span className="booking-layout__payment-banner-cta">Add now →</span>
            </>
          )}
        </Link>
      )}

      <main className="booking-layout__main">
        <Outlet />
      </main>
    </div>
  );
}

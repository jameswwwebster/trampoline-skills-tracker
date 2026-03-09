import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bookingApi } from '../../utils/bookingApi';
import './BookingLayout.css';

export default function BookingLayout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';
  const [needsPaymentMethod, setNeedsPaymentMethod] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) return;
    bookingApi.getMyMemberships()
      .then(r => setNeedsPaymentMethod(r.data.some(m => m.needsPaymentMethod)))
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
          <NavLink to="/booking/my-bookings">My Bookings</NavLink>
          <NavLink to="/booking/my-account">My Account</NavLink>
          {isAdmin && (
            <>
              <span className="booking-layout__admin-divider" />
              <span className="booking-layout__admin-label">Admin</span>
              <NavLink to="/booking/admin" className="booking-layout__admin-link">Sessions</NavLink>
              <NavLink to="/booking/admin/members" className="booking-layout__admin-link">Members</NavLink>
              <NavLink to="/booking/admin/closures" className="booking-layout__admin-link">Closures</NavLink>
              <NavLink to="/booking/admin/audit-log" className="booking-layout__admin-link">Audit Log</NavLink>
            </>
          )}
        </div>
      </nav>

      {needsPaymentMethod && (
        <Link to="/booking/my-account" className="booking-layout__payment-banner">
          <span>⚠ Payment method required — your membership won't renew without a card on file.</span>
          <span className="booking-layout__payment-banner-cta">Add now →</span>
        </Link>
      )}

      <main className="booking-layout__main">
        <Outlet />
      </main>
    </div>
  );
}

import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './BookingLayout.css';

export default function BookingLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';

  return (
    <div className="booking-layout">
      <nav className="booking-layout__nav">
        <Link to="/" className="booking-layout__home-link">← Main app</Link>
        <div className="booking-layout__links">
          <NavLink to="/booking" end>Calendar</NavLink>
          <NavLink to="/booking/my-bookings">My Bookings</NavLink>
          <NavLink to="/booking/my-credits">Credits</NavLink>
          {isAdmin && <NavLink to="/booking/admin">Admin</NavLink>}
          {isAdmin && <NavLink to="/booking/admin/closures">Closures</NavLink>}
          {isAdmin && <NavLink to="/booking/admin/memberships">Members</NavLink>}
        </div>
      </nav>
      <main className="booking-layout__main">
        <Outlet />
      </main>
    </div>
  );
}

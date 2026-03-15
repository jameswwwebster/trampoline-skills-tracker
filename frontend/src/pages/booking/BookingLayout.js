import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bookingApi } from '../../utils/bookingApi';
import './BookingLayout.css';

function getTotalCartCount() {
  let count = 0;
  try {
    const saved = sessionStorage.getItem('booking-cart');
    if (saved) count += JSON.parse(saved).reduce((s, [, g]) => s + g.length, 0);
  } catch {}
  try {
    const shopItems = JSON.parse(localStorage.getItem('shopCart')) || [];
    count += shopItems.reduce((s, item) => s + item.quantity, 0);
  } catch {}
  return count;
}

export default function BookingLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isBookingsActive = location.pathname === '/booking' || location.pathname.startsWith('/booking/my-bookings');
  const isShopActive = location.pathname.startsWith('/booking/shop') || location.pathname.startsWith('/booking/my-orders');
  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';
  const [paymentBanner, setPaymentBanner] = useState(null); // null | 'pending' | 'needs_method'
  const [hasOverdueCharge, setHasOverdueCharge] = useState(false);
  const [cartCount, setCartCount] = useState(getTotalCartCount);
  const [unreadCount, setUnreadCount] = useState(0);
  const [noticeBanner, setNoticeBanner] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // null | 'sessions' | 'members' | 'tools'
  const [activeSessions, setActiveSessions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name) => setOpenDropdown(o => o === name ? null : name);

  useEffect(() => {
    const handler = () => setCartCount(getTotalCartCount());
    window.addEventListener('booking-cart-update', handler);
    window.addEventListener('shop-cart-update', handler);
    return () => {
      window.removeEventListener('booking-cart-update', handler);
      window.removeEventListener('shop-cart-update', handler);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    bookingApi.getNoticeboard()
      .then(r => {
        const unread = r.data.filter(p => !p.isRead).length;
        setUnreadCount(unread);
        setNoticeBanner(unread > 0);
      })
      .catch(() => {});
  }, [user]);

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

  useEffect(() => {
    if (!user || isAdmin) return;
    bookingApi.getMyCharges()
      .then(r => {
        const now = new Date();
        setHasOverdueCharge(r.data.some(c => new Date(c.dueDate) < now));
      })
      .catch(() => {});
  }, [user, isAdmin]);

  useEffect(() => {
    if (isAdmin && location.pathname === '/booking' && !location.state?.skipAdminRedirect) {
      navigate('/booking/admin', { replace: true });
    }
  }, [isAdmin, location.pathname, navigate, location.state]);

  useEffect(() => {
    if (!isAdmin) return;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    bookingApi.getSessions(y, m)
      .then(res => {
        const todayStr = now.toISOString().split('T')[0];
        const todays = res.data.filter(s => {
          const d = new Date(s.date);
          return d.toISOString().split('T')[0] === todayStr;
        });

        const nowMins = now.getHours() * 60 + now.getMinutes();
        const active = todays.filter(s => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          const startMins = sh * 60 + sm - 15;
          const endMins = eh * 60 + em;
          return nowMins >= startMins && nowMins <= endMins;
        });
        setActiveSessions(active);
      })
      .catch(() => {});
  }, [isAdmin]);

  return (
    <div className="booking-layout">
      <nav className="booking-layout__nav">
        {/* Top row: brand + user + logout */}
        <div className="booking-layout__topbar">
          <span className="booking-layout__brand">Trampoline Life</span>
          <div className="booking-layout__user">
            {isAdmin && (
              <Link to="/booking/help" className="booking-layout__help" style={{ marginLeft: '0.5rem' }}>Member help</Link>
            )}
            <Link to={isAdmin ? '/booking/admin/help' : '/booking/help'} className="booking-layout__help" style={{ marginLeft: '0.5rem' }}>Help</Link>
            <button className="booking-layout__logout" onClick={() => { logout(); navigate('/'); }}>Log out</button>
          </div>
        </div>

        {/* Bottom row: scrollable links */}
        <div className="booking-layout__links" ref={dropdownRef}>
          {(
            <>
              {/* Bookings dropdown */}
              <div className="booking-layout__dropdown">
                <button
                  className={`booking-layout__dropdown-btn${openDropdown === 'bookings' || isBookingsActive ? ' active' : ''}`}
                  onClick={() => toggleDropdown('bookings')}
                >
                  Bookings ▾
                </button>
                {openDropdown === 'bookings' && (
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking" end state={{ skipAdminRedirect: true }} className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Book
                    </NavLink>
                    <NavLink to="/booking/my-bookings" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      My Bookings
                    </NavLink>
                    {!isAdmin && (
                      <NavLink to="/booking/my-charges" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                        My Charges
                      </NavLink>
                    )}
                  </div>
                )}
              </div>

              {/* Shop dropdown */}
              <div className="booking-layout__dropdown">
                <button
                  className={`booking-layout__dropdown-btn${openDropdown === 'shop' || isShopActive ? ' active' : ''}`}
                  onClick={() => toggleDropdown('shop')}
                >
                  Shop ▾
                </button>
                {openDropdown === 'shop' && (
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/shop" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Shop
                    </NavLink>
                    <NavLink to="/booking/my-orders" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      My Orders
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Noticeboard */}
              <NavLink
                to="/booking/noticeboard"
                style={{ position: 'relative' }}
                onClick={() => { setNoticeBanner(false); setOpenDropdown(null); }}
              >
                Noticeboard
                {unreadCount > 0 && (
                  <span className="booking-layout__unread-badge">{unreadCount}</span>
                )}
              </NavLink>

              {/* Account */}
              <NavLink to="/booking/my-account" onClick={() => setOpenDropdown(null)}>
                Account
              </NavLink>

              {/* Cart — standalone, conditional, visually inverted */}
              {cartCount > 0 && (
                <NavLink to="/booking/cart" className="booking-layout__cart-link" onClick={() => setOpenDropdown(null)}>
                  Cart ({cartCount})
                </NavLink>
              )}
            </>
          )}
          {isAdmin && (
            <div className="booking-layout__admin-group">
              <span className="booking-layout__admin-divider" />
              <span className="booking-layout__admin-label">Admin</span>
              <div className="booking-layout__dropdown">
                <button
                  className={`booking-layout__admin-link booking-layout__dropdown-btn${openDropdown === 'sessions' ? ' active' : ''}${activeSessions.length > 0 ? ' booking-layout__admin-link--register-active' : ''}`}
                  style={{ fontWeight: activeSessions.length > 0 ? 700 : undefined, color: activeSessions.length > 0 ? 'var(--booking-accent)' : undefined }}
                  onClick={() => toggleDropdown('sessions')}
                >
                  Sessions ▾
                </button>
                {openDropdown === 'sessions' && (
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/admin" end className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Sessions</NavLink>
                    <NavLink to="/booking/admin/closures" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Closures</NavLink>
                    <NavLink to="/booking/admin/session-management" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Session Management</NavLink>
                    {activeSessions.length === 0 && (
                      <button
                        className="booking-layout__dropdown-item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'var(--booking-text-muted)' }}
                        onClick={() => setOpenDropdown(null)}
                      >
                        Register (no active session)
                      </button>
                    )}
                    {activeSessions.length === 1 && (
                      <button
                        className="booking-layout__dropdown-item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 700, color: 'var(--booking-accent)' }}
                        onClick={() => { setOpenDropdown(null); navigate(`/booking/admin/register/${activeSessions[0].id}`); }}
                      >
                        Register — {activeSessions[0].startTime}–{activeSessions[0].endTime}
                      </button>
                    )}
                    {activeSessions.length > 1 && activeSessions.map(s => (
                      <button
                        key={s.id}
                        className="booking-layout__dropdown-item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 700, color: 'var(--booking-accent)' }}
                        onClick={() => { setOpenDropdown(null); navigate(`/booking/admin/register/${s.id}`); }}
                      >
                        Register — {s.startTime}–{s.endTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="booking-layout__dropdown">
                <button
                  className={`booking-layout__admin-link booking-layout__dropdown-btn${openDropdown === 'members' ? ' active' : ''}`}
                  onClick={() => toggleDropdown('members')}
                >
                  Members ▾
                </button>
                {openDropdown === 'members' && (
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/admin/members" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Members</NavLink>
                    <NavLink to="/booking/admin/bg-numbers" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>BG Numbers</NavLink>
                  </div>
                )}
              </div>
              <NavLink to="/booking/admin/shop-orders" className="booking-layout__admin-link">Shop Orders</NavLink>
              <div className="booking-layout__dropdown">
                <button
                  className={`booking-layout__admin-link booking-layout__dropdown-btn${openDropdown === 'tools' ? ' active' : ''}`}
                  onClick={() => toggleDropdown('tools')}
                >
                  Tools ▾
                </button>
                {openDropdown === 'tools' && (
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/admin/messages" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Messages</NavLink>
                    <NavLink to="/booking/admin/recipient-groups" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Recipient Groups</NavLink>
                    <NavLink to="/booking/admin/audit-log" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Audit Log</NavLink>
                    <NavLink to="/booking/admin/charges" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Credits &amp; Charges</NavLink>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {noticeBanner && (
        <Link
          to="/booking/noticeboard"
          className="booking-layout__notice-banner"
          onClick={() => setNoticeBanner(false)}
        >
          <span>📌 {unreadCount} new notice{unreadCount !== 1 ? 's' : ''} on the noticeboard</span>
          <span className="booking-layout__payment-banner-cta">View →</span>
        </Link>
      )}

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

      {hasOverdueCharge && (
        <Link to="/booking/cart" className="booking-layout__payment-banner">
          <span>⚠ You have an overdue charge — pay it to make new bookings.</span>
          <span className="booking-layout__payment-banner-cta">Pay now →</span>
        </Link>
      )}

      <main className="booking-layout__main">
        <Outlet />
      </main>

    </div>
  );
}

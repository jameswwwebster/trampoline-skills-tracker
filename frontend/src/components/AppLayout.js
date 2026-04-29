import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { bookingApi } from '../utils/bookingApi';
import { shopApi } from '../utils/shopApi';
import './AppLayout.css';

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

export default function AppLayout() {
  const {
    user, logout, loading,
    isAdult, canManageGymnasts, isSuperAdmin,
  } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'CLUB_ADMIN' || user?.role === 'COACH' || user?.role === 'WELFARE';

  const navRef = useRef(null);

  // Keep --nav-height in sync with the actual rendered nav height
  useEffect(() => {
    const update = () => {
      if (navRef.current) {
        document.documentElement.style.setProperty('--nav-height', `${navRef.current.offsetHeight}px`);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [noticeBanner, setNoticeBanner] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState(null); // null | 'pending' | 'needs_method'
  const [hasOverdueCharge, setHasOverdueCharge] = useState(false);
  const [hasAnyCharge, setHasAnyCharge] = useState(false);
  const [cartCount, setCartCount] = useState(getTotalCartCount);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);

  const dropdownRef = useRef(null);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Close menus on navigation ───────────────────────────────────────────────
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  // ── Cart count ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setCartCount(getTotalCartCount());
    window.addEventListener('booking-cart-update', handler);
    window.addEventListener('shop-cart-update', handler);
    return () => {
      window.removeEventListener('booking-cart-update', handler);
      window.removeEventListener('shop-cart-update', handler);
    };
  }, []);

  // ── Noticeboard unread count ────────────────────────────────────────────────
  const refreshUnreadCount = useCallback(() => {
    bookingApi.getNoticeboard()
      .then(r => {
        const unread = r.data.filter(p => !p.isRead).length;
        setUnreadCount(unread);
        setNoticeBanner(unread > 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) refreshUnreadCount();
  }, [user, refreshUnreadCount]);

  // ── Payment / overdue banners (non-admin only) ──────────────────────────────
  useEffect(() => {
    if (!user || isAdmin) return;
    bookingApi.getMyMemberships()
      .then(r => {
        if (r.data.some(m => m.status === 'PENDING_PAYMENT')) setPaymentBanner('pending');
        else if (r.data.some(m => m.needsPaymentMethod)) setPaymentBanner('needs_method');
      })
      .catch(() => {});
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    bookingApi.getMyCharges()
      .then(r => {
        const now = new Date();
        setHasOverdueCharge(r.data.some(c => new Date(c.dueDate) < now));
        setHasAnyCharge(r.data.length > 0);
      })
      .catch(() => {});
  }, [user, isAdmin]);

  // ── Pending shop orders count (admin/coach only) ────────────────────────────
  useEffect(() => {
    if (!canManageGymnasts) return;
    shopApi.getPendingOrderCount()
      .then(res => setPendingOrderCount(res.data.count))
      .catch(() => {});
  }, [canManageGymnasts]);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const toggleDropdown = (name) => setOpenDropdown(o => o === name ? null : name);
  const closeMobile = () => setIsMobileMenuOpen(false);
  const handleLogout = () => { logout(); navigate('/'); };

  const helpPath = isAdmin ? '/booking/admin/help' : '/booking/help';

  return (
    <div className="app-layout">
      <nav className="app-layout__nav" ref={navRef}>

        {/* Top bar: brand + user */}
        <div className="app-layout__topbar">
          <NavLink to="/dashboard" className="app-layout__brand">
            {branding?.logoUrl
              ? <img src={branding.logoUrl} alt="Club Logo" style={{ height: '36px', maxWidth: '160px' }} />
              : (branding?.clubName || 'Trampoline Life')}
          </NavLink>
          <div className="app-layout__user">
            <span className="app-layout__username">{user?.firstName} {user?.lastName}</span>
            {canManageGymnasts && (
              <NavLink
                to="/admin-hub"
                className="app-layout__link--admin"
                style={{ position: 'relative' }}
              >
                Admin
                {pendingOrderCount > 0 && <span className="app-layout__badge">{pendingOrderCount}</span>}
              </NavLink>
            )}
            <button
              className="app-layout__hamburger"
              onClick={() => setIsMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Desktop nav links */}
        <div className="app-layout__links" ref={dropdownRef}>

          {/* Left group */}
          <div className="app-layout__links-left">
            <NavLink to="/dashboard" className="app-layout__link" end>Home</NavLink>

            {/* Bookings */}
            <div className="app-layout__dropdown">
              <button
                className={`app-layout__dropdown-btn${openDropdown === 'bookings' ? ' active' : ''}`}
                onClick={() => toggleDropdown('bookings')}
              >
                Bookings ▾
              </button>
              {openDropdown === 'bookings' && (
                <div className="app-layout__dropdown-menu">
                  <NavLink to="/booking" end className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)} state={{ skipAdminRedirect: true }}>Book a session</NavLink>
                  <NavLink to="/booking/my-bookings" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Bookings</NavLink>
                  {!isAdmin && <NavLink to="/booking/my-waitlist" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Waitlist</NavLink>}
                </div>
              )}
            </div>

            {/* Tracking */}
            {canManageGymnasts ? (
              <NavLink to="/gymnasts" className="app-layout__link" onClick={() => setOpenDropdown(null)}>Skill Tracking</NavLink>
            ) : (
              <div className="app-layout__dropdown">
                <button
                  className={`app-layout__dropdown-btn${openDropdown === 'tracking' ? ' active' : ''}`}
                  onClick={() => toggleDropdown('tracking')}
                >
                  Tracking ▾
                </button>
                {openDropdown === 'tracking' && (
                  <div className="app-layout__dropdown-menu">
                    <NavLink to="/my-progress" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Progress</NavLink>
                    {!isAdult && <NavLink to="/my-certificates" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Certificates</NavLink>}
                  </div>
                )}
              </div>
            )}

            {/* Shop */}
            <div className="app-layout__dropdown">
              <button
                className={`app-layout__dropdown-btn${openDropdown === 'shop' ? ' active' : ''}`}
                onClick={() => toggleDropdown('shop')}
              >
                Shop ▾
              </button>
              {openDropdown === 'shop' && (
                <div className="app-layout__dropdown-menu">
                  <NavLink to="/booking/shop" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Shop</NavLink>
                  <NavLink to="/booking/my-orders" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Orders</NavLink>
                </div>
              )}
            </div>

            {/* Noticeboard */}
            <NavLink
              to="/booking/noticeboard"
              className="app-layout__link"
              style={{ position: 'relative' }}
              onClick={() => setNoticeBanner(false)}
            >
              Noticeboard
              {unreadCount > 0 && <span className="app-layout__badge">{unreadCount}</span>}
            </NavLink>
          </div>

          {/* Right group */}
          <div className="app-layout__links-right">
            {/* Cart */}
            {(cartCount > 0 || hasAnyCharge) && (
              <NavLink to="/booking/cart" className="app-layout__cart-link" onClick={() => setOpenDropdown(null)}>
                Cart{cartCount > 0 ? ` (${cartCount})` : ''}
              </NavLink>
            )}

            {/* Account */}
            <div className="app-layout__dropdown">
              <button
                className={`app-layout__dropdown-btn${openDropdown === 'account' ? ' active' : ''}`}
                onClick={() => toggleDropdown('account')}
              >
                Account ▾
              </button>
              {openDropdown === 'account' && (
                <div className="app-layout__dropdown-menu app-layout__dropdown-menu--right">
                  <NavLink to="/booking/my-account" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Account</NavLink>
                  {!isAdmin && <NavLink to="/booking/my-charges" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Charges</NavLink>}
                  <NavLink to="/booking/competitions" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Competitions</NavLink>
                  {!canManageGymnasts && <NavLink to="/booking/incidents" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Incident Reports</NavLink>}
                  <NavLink to="/profile" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Profile</NavLink>
                  <NavLink to={helpPath} className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Help</NavLink>
                  {isSuperAdmin && <NavLink to="/super-admin" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Super Admin</NavLink>}
                </div>
              )}
            </div>

          </div>

        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="app-layout__mobile-overlay" onClick={closeMobile} />
      )}

      {/* Mobile slide-in menu */}
      <div className={`app-layout__mobile-menu${isMobileMenuOpen ? ' open' : ''}`}>
        <div className="app-layout__mobile-header">
          <span className="app-layout__mobile-title">Menu</span>
          <button className="app-layout__mobile-close" onClick={closeMobile} aria-label="Close menu">×</button>
        </div>
        <div className="app-layout__mobile-links">

          <NavLink to="/dashboard" className="app-layout__mobile-link" onClick={closeMobile} end>Home</NavLink>

          <div className="app-layout__mobile-section-label">Bookings</div>
          <NavLink to="/booking" end className="app-layout__mobile-link" onClick={closeMobile} state={{ skipAdminRedirect: true }}>Book a session</NavLink>
          <NavLink to="/booking/my-bookings" className="app-layout__mobile-link" onClick={closeMobile}>My Bookings</NavLink>
          {!isAdmin && <NavLink to="/booking/my-waitlist" className="app-layout__mobile-link" onClick={closeMobile}>My Waitlist</NavLink>}

          <div className="app-layout__mobile-section-label">Tracking</div>
          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="app-layout__mobile-link" onClick={closeMobile}>Skill Tracking</NavLink>
          )}
          {!canManageGymnasts && <>
            <NavLink to="/my-progress" className="app-layout__mobile-link" onClick={closeMobile}>My Progress</NavLink>
            {!isAdult && <NavLink to="/my-certificates" className="app-layout__mobile-link" onClick={closeMobile}>My Certificates</NavLink>}
          </>}

          <div className="app-layout__mobile-section-label">Shop</div>
          <NavLink to="/booking/shop" className="app-layout__mobile-link" onClick={closeMobile}>Shop</NavLink>
          <NavLink to="/booking/my-orders" className="app-layout__mobile-link" onClick={closeMobile}>My Orders</NavLink>

          <NavLink
            to="/booking/noticeboard"
            className="app-layout__mobile-link"
            onClick={() => { closeMobile(); setNoticeBanner(false); }}
          >
            Noticeboard{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </NavLink>

          <div className="app-layout__mobile-divider" />

          <div className="app-layout__mobile-section-label">Account</div>
          <NavLink to="/booking/my-account" className="app-layout__mobile-link" onClick={closeMobile}>My Account</NavLink>
          {!isAdmin && <NavLink to="/booking/my-charges" className="app-layout__mobile-link" onClick={closeMobile}>My Charges</NavLink>}
          <NavLink to="/booking/competitions" className="app-layout__mobile-link" onClick={closeMobile}>Competitions</NavLink>
          {!canManageGymnasts && <NavLink to="/booking/incidents" className="app-layout__mobile-link" onClick={closeMobile}>Incident Reports</NavLink>}
          <NavLink to="/profile" className="app-layout__mobile-link" onClick={closeMobile}>Profile</NavLink>
          <NavLink to={helpPath} className="app-layout__mobile-link" onClick={closeMobile}>Help</NavLink>
          {isSuperAdmin && <NavLink to="/super-admin" className="app-layout__mobile-link" onClick={closeMobile}>Super Admin</NavLink>}

        </div>
        <div className="app-layout__mobile-footer">
          <button className="app-layout__mobile-link app-layout__mobile-logout" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <div className="app-layout__content">
        {/* Banners */}
        {noticeBanner && (
          <Link to="/booking/noticeboard" className="app-layout__notice-banner" onClick={() => setNoticeBanner(false)}>
            <span>📌 {unreadCount} new notice{unreadCount !== 1 ? 's' : ''} on the noticeboard</span>
            <span className="app-layout__banner-cta">View →</span>
          </Link>
        )}

        {paymentBanner && (
          <Link to="/booking/my-account" className="app-layout__payment-banner">
            {paymentBanner === 'pending' ? (
              <><span>⚠ Membership payment required — your membership is not yet active.</span><span className="app-layout__banner-cta">Set up payment →</span></>
            ) : (
              <><span>⚠ Payment method required — your membership won't renew without a card on file.</span><span className="app-layout__banner-cta">Add now →</span></>
            )}
          </Link>
        )}

        {hasOverdueCharge && (
          <Link to="/booking/cart" className="app-layout__payment-banner">
            <span>⚠ You have an overdue charge — pay it to make new bookings.</span>
            <span className="app-layout__banner-cta">Pay now →</span>
          </Link>
        )}

        <main className="app-layout__main">
          <Outlet context={{ refreshUnreadCount }} />
        </main>
      </div>
    </div>
  );
}

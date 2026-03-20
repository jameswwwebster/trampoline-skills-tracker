import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import './TrackingLayout.css';

export default function Layout() {
  const {
    user, logout,
    canManageGymnasts, isClubAdmin, canReadCompetitions, canEditLevels, isSuperAdmin,
  } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  const toggleDropdown = (name) => setOpenDropdown(o => o === name ? null : name);
  const closeMobile = () => setIsMobileMenuOpen(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  const isCoachOrAdmin = canManageGymnasts || isClubAdmin;

  return (
    <div className="tracker-layout">
      <nav className="tracker-layout__nav">

        {/* Row 1: brand + username + logout + hamburger */}
        <div className="tracker-layout__topbar">
          <NavLink to="/dashboard" className="tracker-layout__brand">
            {branding?.logoUrl
              ? <img src={branding.logoUrl} alt="Club Logo" style={{ height: '36px', maxWidth: '160px' }} />
              : 'Trampoline Life'}
          </NavLink>
          <div className="tracker-layout__user">
            <span className="tracker-layout__username">{user?.firstName} {user?.lastName}</span>
            <button className="tracker-layout__logout" onClick={handleLogout}>Log out</button>
            <button
              className="tracker-layout__hamburger"
              onClick={() => setIsMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Row 2: nav links */}
        <div className="tracker-layout__links" ref={dropdownRef}>

          <NavLink to="/dashboard" className="tracker-layout__link">Dashboard</NavLink>

          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="tracker-layout__link">Skill Tracking</NavLink>
          )}

          {canManageGymnasts && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'certificates' ? ' active' : ''}`}
                onClick={() => toggleDropdown('certificates')}
              >
                Certificates ▾
              </button>
              {openDropdown === 'certificates' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/certificates" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                    Certificate Management
                  </NavLink>
                  {isClubAdmin && (
                    <NavLink to="/certificate-designer" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Certificate Setup
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {canEditLevels && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'configuration' ? ' active' : ''}`}
                onClick={() => toggleDropdown('configuration')}
              >
                Configuration ▾
              </button>
              {openDropdown === 'configuration' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/levels" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                    Levels & Skills
                  </NavLink>
                  {canReadCompetitions && (
                    <NavLink to="/competitions" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Competition Categories
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {isClubAdmin && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'administration' ? ' active' : ''}`}
                onClick={() => toggleDropdown('administration')}
              >
                Administration ▾
              </button>
              {openDropdown === 'administration' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/club-settings" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Settings</NavLink>
                  <NavLink to="/branding" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Branding</NavLink>
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <NavLink to="/super-admin" className="tracker-layout__link">Super Admin</NavLink>
          )}

          {isCoachOrAdmin && (
            <>
              <span className="tracker-layout__divider" />
              <NavLink to="/booking" className={`tracker-layout__link tracker-layout__cross-link`}>Booking</NavLink>
            </>
          )}

        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="tracker-layout__mobile-overlay" onClick={closeMobile} />
      )}

      {/* Mobile slide-in menu */}
      <div className={`tracker-layout__mobile-menu${isMobileMenuOpen ? ' open' : ''}`}>
        <div className="tracker-layout__mobile-header">
          <span className="tracker-layout__mobile-title">Menu</span>
          <button className="tracker-layout__mobile-close" onClick={closeMobile} aria-label="Close menu">×</button>
        </div>

        <div className="tracker-layout__mobile-links">

          <NavLink to="/dashboard" className="tracker-layout__mobile-link" onClick={closeMobile}>Dashboard</NavLink>

          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="tracker-layout__mobile-link" onClick={closeMobile}>Skill Tracking</NavLink>
          )}

          {canManageGymnasts && (
            <>
              <div className="tracker-layout__mobile-section-label">Certificates</div>
              <NavLink to="/certificates" className="tracker-layout__mobile-link" onClick={closeMobile}>Certificate Management</NavLink>
              {isClubAdmin && (
                <NavLink to="/certificate-designer" className="tracker-layout__mobile-link" onClick={closeMobile}>Certificate Setup</NavLink>
              )}
            </>
          )}

          {canEditLevels && (
            <>
              <div className="tracker-layout__mobile-section-label">Configuration</div>
              <NavLink to="/levels" className="tracker-layout__mobile-link" onClick={closeMobile}>Levels & Skills</NavLink>
              {canReadCompetitions && (
                <NavLink to="/competitions" className="tracker-layout__mobile-link" onClick={closeMobile}>Competition Categories</NavLink>
              )}
            </>
          )}

          {isClubAdmin && (
            <>
              <div className="tracker-layout__mobile-section-label">Administration</div>
              <NavLink to="/club-settings" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Settings</NavLink>
              <NavLink to="/branding" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Branding</NavLink>
            </>
          )}

          {isSuperAdmin && (
            <NavLink to="/super-admin" className="tracker-layout__mobile-link" onClick={closeMobile}>Super Admin</NavLink>
          )}

        </div>

        <div className="tracker-layout__mobile-footer">
          <NavLink to="/profile" className="tracker-layout__mobile-link" onClick={closeMobile}>Profile</NavLink>
          {isCoachOrAdmin && (
            <NavLink to="/booking" className="tracker-layout__mobile-link" onClick={closeMobile}>Booking</NavLink>
          )}
          <button className={`tracker-layout__mobile-link tracker-layout__mobile-logout`} onClick={handleLogout}>
            Log out
          </button>
        </div>

      </div>

      <main className="tracker-layout__main">
        <Outlet />
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

const Layout = () => {
  const { user, logout, canManageGymnasts, isClubAdmin, canReadCompetitions, needsProgressNavigation, isChild, isParent, canEditLevels } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dynamic navigation text based on user type
  const getProgressNavText = () => {
    if (isChild) return "My Progress";
    if (isParent) return "Children's Progress";
    return "Progress";
  };

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  const handleLogout = () => {
    logout();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-nav-menu') && !event.target.closest('.mobile-menu-toggle')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isMobileMenuOpen]);

  return (
    <div className="App">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          {branding?.logoUrl ? (
            <img 
              src={branding.logoUrl} 
              alt="Club Logo" 
              style={{ height: '40px', maxWidth: '200px' }} 
            />
          ) : (
            'Trampoline Tracker'
          )}
        </Link>
        
        <div className="navbar-nav">
          <Link to="/" className={isActive('/')}>
            Dashboard
          </Link>
          
          {needsProgressNavigation && (
            <Link to="/my-progress" className={isActive('/my-progress')}>
              {getProgressNavText()}
            </Link>
          )}
          
          {/* My Certificates for Parents and Gymnasts */}
          {(user?.role === 'PARENT' || user?.role === 'GYMNAST') && (
            <Link to="/my-certificates" className={isActive('/my-certificates')}>
              🏆 My Certificates
            </Link>
          )}
          
          {canManageGymnasts && (
            <Link to="/gymnasts" className={isActive('/gymnasts')}>
              Skill Tracking
            </Link>
          )}
          
          {canManageGymnasts && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-toggle">
                Certificates
                <span className="nav-dropdown-arrow">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/certificates" className={isActive('/certificates')}>
                  Certificate Management
                </Link>
                {isClubAdmin && (
                  <Link to="/certificate-designer" className={isActive('/certificate-designer')}>
                    Certificate Designer
                  </Link>
                )}
              </div>
            </div>
          )}
          
          {canEditLevels && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-toggle">
                Configuration
                <span className="nav-dropdown-arrow">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/levels" className={isActive('/levels')}>
                  Levels & Skills
                </Link>
                {canReadCompetitions && (
                  <Link to="/competitions" className={isActive('/competitions')}>
                    Competition Categories
                  </Link>
                )}
              </div>
            </div>
          )}

          {isClubAdmin && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-toggle">
                Administration
                <span className="nav-dropdown-arrow">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/club-settings" className={isActive('/club-settings')}>
                  Club Settings
                </Link>
                <Link to="/branding" className={isActive('/branding')}>
                  Club Branding
                </Link>
                <Link to="/custom-fields" className={isActive('/custom-fields')}>
                  Custom Fields
                </Link>
                <Link to="/users" className={isActive('/users')}>
                  Manage Users
                </Link>
                <Link to="/invites" className={isActive('/invites')}>
                  Invitations
                </Link>
                <Link to="/parent-requests" className={isActive('/parent-requests')}>
                  Parent Requests
                </Link>
                <Link to="/import" className={isActive('/import')}>
                  Import Gymnasts
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="navbar-nav">
          <div className="nav-dropdown">
            <button className="nav-dropdown-toggle">
              {user?.firstName} {user?.lastName}
              <span className="nav-dropdown-arrow">▼</span>
            </button>
            <div className="nav-dropdown-menu">
              <Link to="/profile" className={isActive('/profile')}>
                Profile
              </Link>
              <button onClick={handleLogout} className="nav-dropdown-logout">
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          ☰
        </button>
      </nav>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-overlay active" onClick={closeMobileMenu}></div>
      )}

      {/* Mobile Navigation Menu */}
      <nav className={`mobile-nav-menu ${isMobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-header">
          <h3 className="mobile-nav-title">Menu</h3>
          <button 
            className="mobile-nav-close"
            onClick={closeMobileMenu}
            aria-label="Close mobile menu"
          >
            ×
          </button>
        </div>

        <div className="mobile-nav-links">
          <Link to="/" className={isActive('/')}>
            Dashboard
          </Link>
          
          {needsProgressNavigation && (
            <Link to="/my-progress" className={isActive('/my-progress')}>
              {getProgressNavText()}
            </Link>
          )}
          
          {/* My Certificates for Parents and Gymnasts */}
          {(user?.role === 'PARENT' || user?.role === 'GYMNAST') && (
            <Link to="/my-certificates" className={isActive('/my-certificates')}>
              🏆 My Certificates
            </Link>
          )}
          
          {canManageGymnasts && (
            <Link to="/gymnasts" className={isActive('/gymnasts')}>
              Skill Tracking
            </Link>
          )}
          
          {canManageGymnasts && (
            <div className="mobile-nav-section">
              <div className="mobile-nav-section-title">Certificates</div>
              <Link to="/certificates" className={isActive('/certificates')}>
                Certificate Management
              </Link>
              {isClubAdmin && (
                <Link to="/certificate-designer" className={isActive('/certificate-designer')}>
                  Certificate Designer
                </Link>
              )}
            </div>
          )}
          
          {canEditLevels && (
            <div className="mobile-nav-section">
              <div className="mobile-nav-section-title">Configuration</div>
              <Link to="/levels" className={isActive('/levels')}>
                Levels & Skills
              </Link>
              {canReadCompetitions && (
                <Link to="/competitions" className={isActive('/competitions')}>
                  Competition Categories
                </Link>
              )}
            </div>
          )}

          {isClubAdmin && (
              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">Administration</div>
                <Link to="/club-settings" className={isActive('/club-settings')}>
                  Club Settings
                </Link>
                <Link to="/branding" className={isActive('/branding')}>
                  Club Branding
                </Link>
                <Link to="/custom-fields" className={isActive('/custom-fields')}>
                  Custom Fields
                </Link>
                <Link to="/users" className={isActive('/users')}>
                  Manage Users
                </Link>
                <Link to="/invites" className={isActive('/invites')}>
                  Invitations
                </Link>
                <Link to="/parent-requests" className={isActive('/parent-requests')}>
                  Parent Requests
                </Link>
                <Link to="/import" className={isActive('/import')}>
                  Import Gymnasts
                </Link>
              </div>
          )}
        </div>

        <div className="mobile-nav-user">
          <div className="mobile-nav-section">
            <div className="mobile-nav-section-title">{user?.firstName} {user?.lastName}</div>
            <Link to="/profile" className={isActive('/profile')}>
              Profile
            </Link>
            <button onClick={handleLogout} className="btn btn-outline">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 
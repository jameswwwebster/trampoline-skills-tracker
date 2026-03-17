import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

// Mobile nested menu component
const MobileNestedMenu = ({ title, children, isOpen, onToggle }) => {
  return (
    <div className="mobile-nav-nested">
      <button 
        className="mobile-nav-nested-toggle"
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className={`mobile-nav-nested-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="mobile-nav-nested-content">
          {children}
        </div>
      )}
    </div>
  );
};

const Layout = () => {
  const { user, logout, canManageGymnasts, isClubAdmin, canReadCompetitions, needsProgressNavigation, isChild, isAdult, canEditLevels, isSuperAdmin } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openNestedMenus, setOpenNestedMenus] = useState({
    certificates: false,
    configuration: false,
    administration: false
  });
  const [openDropdown, setOpenDropdown] = useState(null);

  // Dynamic navigation text based on user type
  const getProgressNavText = () => {
    if (isChild) return "My Progress";
    if (isAdult) return "Children's Progress";
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

  const toggleNestedMenu = (menuName) => {
    setOpenNestedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  // Close mobile menu and dropdowns when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-nav-menu') && !event.target.closest('.mobile-menu-toggle')) {
        setIsMobileMenuOpen(false);
      }
      if (openDropdown && !event.target.closest('.nav-dropdown')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isMobileMenuOpen, openDropdown]);

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
          
          {/* My Certificates for Adults and Gymnasts */}
          {(user?.role === 'ADULT' || user?.role === 'GYMNAST') && (
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
              <button className="nav-dropdown-toggle" onClick={() => toggleDropdown('certificates')}>
                Certificates
                <span className={`nav-dropdown-arrow${openDropdown === 'certificates' ? ' open' : ''}`}>▼</span>
              </button>
              <div className={`nav-dropdown-menu${openDropdown === 'certificates' ? ' open' : ''}`}>
                <Link to="/certificates" className={isActive('/certificates')}>
                  Certificate Management
                </Link>
                {isClubAdmin && (
                  <Link to="/certificate-designer" className={isActive('/certificate-designer')}>
                    Certificate Setup
                  </Link>
                )}
              </div>
            </div>
          )}

          {canEditLevels && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-toggle" onClick={() => toggleDropdown('configuration')}>
                Configuration
                <span className={`nav-dropdown-arrow${openDropdown === 'configuration' ? ' open' : ''}`}>▼</span>
              </button>
              <div className={`nav-dropdown-menu${openDropdown === 'configuration' ? ' open' : ''}`}>
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
              <button className="nav-dropdown-toggle" onClick={() => toggleDropdown('administration')}>
                Administration
                <span className={`nav-dropdown-arrow${openDropdown === 'administration' ? ' open' : ''}`}>▼</span>
              </button>
              <div className={`nav-dropdown-menu${openDropdown === 'administration' ? ' open' : ''}`}>
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
                <Link to="/adults" className={isActive('/adults')}>
                  Adults
                </Link>
                <Link to="/adult-requests" className={isActive('/adult-requests')}>
                  Adult Requests
                </Link>
                <Link to="/import" className={isActive('/import')}>
                  Import Gymnasts
                </Link>
              </div>
            </div>
          )}

          {/* Super Admin Portal */}
          {isSuperAdmin && (
            <Link to="/super-admin" className={isActive('/super-admin')}>
              🔧 Super Admin
            </Link>
          )}
        </div>

        <div className="navbar-nav">
          <div className="nav-dropdown">
            <button className="nav-dropdown-toggle" onClick={() => toggleDropdown('user')}>
              {user?.firstName} {user?.lastName}
              <span className={`nav-dropdown-arrow${openDropdown === 'user' ? ' open' : ''}`}>▼</span>
            </button>
            <div className={`nav-dropdown-menu${openDropdown === 'user' ? ' open' : ''}`}>
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
          
          {/* My Certificates for Adults and Gymnasts */}
          {(user?.role === 'ADULT' || user?.role === 'GYMNAST') && (
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
            <MobileNestedMenu 
              title="Certificates" 
              isOpen={openNestedMenus.certificates}
              onToggle={() => toggleNestedMenu('certificates')}
            >
              <Link to="/certificates" className={isActive('/certificates')}>
                Certificate Management
              </Link>
              {isClubAdmin && (
                <Link to="/certificate-designer" className={isActive('/certificate-designer')}>
                  Certificate Setup
                </Link>
              )}
            </MobileNestedMenu>
          )}
          
          {canEditLevels && (
            <MobileNestedMenu 
              title="Configuration" 
              isOpen={openNestedMenus.configuration}
              onToggle={() => toggleNestedMenu('configuration')}
            >
              <Link to="/levels" className={isActive('/levels')}>
                Levels & Skills
              </Link>
              {canReadCompetitions && (
                <Link to="/competitions" className={isActive('/competitions')}>
                  Competition Categories
                </Link>
              )}
            </MobileNestedMenu>
          )}

          {isClubAdmin && (
            <MobileNestedMenu 
              title="Administration" 
              isOpen={openNestedMenus.administration}
              onToggle={() => toggleNestedMenu('administration')}
            >
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
              <Link to="/adults" className={isActive('/adults')}>
                Adults
              </Link>
              <Link to="/adult-requests" className={isActive('/adult-requests')}>
                Adult Requests
              </Link>
              <Link to="/import" className={isActive('/import')}>
                Import Gymnasts
              </Link>
            </MobileNestedMenu>
          )}

          {/* Super Admin Portal - Mobile */}
          {isSuperAdmin && (
            <Link to="/super-admin" className={isActive('/super-admin')}>
              🔧 Super Admin
            </Link>
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
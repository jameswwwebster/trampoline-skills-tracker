import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout, canManageGymnasts, isClubAdmin, canReadCompetitions, needsProgressNavigation } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          Trampoline Tracker
        </Link>
        
        <div className="navbar-nav">
          <Link to="/" className={isActive('/')}>
            Dashboard
          </Link>
          
          {needsProgressNavigation && (
            <Link to="/my-progress" className={isActive('/my-progress')}>
              Children's Progress
            </Link>
          )}
          
          {canManageGymnasts && (
            <Link to="/gymnasts" className={isActive('/gymnasts')}>
              Gymnasts
            </Link>
          )}
          
          <Link to="/levels" className={isActive('/levels')}>
            Levels
          </Link>

          {canReadCompetitions && (
            <Link to="/competitions" className={isActive('/competitions')}>
              Competitions
            </Link>
          )}

          {isClubAdmin && (
            <Link to="/invites" className={isActive('/invites')}>
              Invitations
            </Link>
          )}
        </div>

        <div className="navbar-nav">
          <span className="nav-link">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="nav-link">
            ({user?.role?.replace('_', ' ')})
          </span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            Logout
          </button>
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
          <h3>Menu</h3>
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
              Children's Progress
            </Link>
          )}
          
          {canManageGymnasts && (
            <Link to="/gymnasts" className={isActive('/gymnasts')}>
              Gymnasts
            </Link>
          )}
          
          <Link to="/levels" className={isActive('/levels')}>
            Levels
          </Link>

          {canReadCompetitions && (
            <Link to="/competitions" className={isActive('/competitions')}>
              Competitions
            </Link>
          )}

          {isClubAdmin && (
            <Link to="/invites" className={isActive('/invites')}>
              Invitations
            </Link>
          )}
        </div>

        <div className="mobile-nav-user">
          <div className="nav-link">
            {user?.firstName} {user?.lastName}
          </div>
          <div className="nav-link">
            ({user?.role?.replace('_', ' ')})
          </div>
          <button onClick={handleLogout} className="btn btn-outline">
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 
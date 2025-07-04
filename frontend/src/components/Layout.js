import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout, canManageGymnasts } = useAuth();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  const handleLogout = () => {
    logout();
  };

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
          
          {canManageGymnasts && (
            <Link to="/gymnasts" className={isActive('/gymnasts')}>
              Gymnasts
            </Link>
          )}
          
          <Link to="/levels" className={isActive('/levels')}>
            Levels
          </Link>
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
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 
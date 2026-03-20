import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BLOCKED_ROLES = ['ADULT', 'CHILD', 'GYMNAST'];

export default function TrackingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (BLOCKED_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

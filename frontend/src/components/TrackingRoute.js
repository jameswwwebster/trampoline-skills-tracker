import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

const BLOCKED_ROLES = ['ADULT', 'CHILD', 'GYMNAST'];

export default function TrackingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (BLOCKED_ROLES.includes(user.role)) return <Navigate to="/booking" replace />;

  return <Layout />;
}

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Gate that requires a signed-in user and (optionally) a specific role.
 * - Not signed in → /signin (with a `from` hint to return here after auth)
 * - Signed in but wrong role → role-appropriate home
 */
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    const home = user.role === 'student' ? '/me/dashboard'
      : user.role === 'college' ? '/college/dashboard' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
}

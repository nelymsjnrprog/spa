
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { UserRole } from '../core/types';

/**
 * AuthGuard: Pure Login Protector
 * Ensures a user is authenticated before allowing access.
 * If not authenticated, redirects to /login.
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/**
 * RoleGuard: Authority Protector
 * Ensures the authenticated user has the correct Firestore-verified role.
 * Prevents: student -> admin and admin -> student quiz cross-access.
 */
export const RoleGuard: React.FC<{ children: React.ReactNode; allowedRole: UserRole }> = ({ children, allowedRole }) => {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If role doesn't match, redirect to their own legitimate dashboard
  if (role !== allowedRole) {
    const fallback = role === 'admin' ? '/admin' : '/student';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

// Default export as AuthGuard for backward compatibility with routing setup
export default AuthGuard;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

interface MembershipGuardProps {
  children: React.ReactNode;
}

/**
 * MembershipGuard - Blocks access to student features if their level requires payment 
 * and they haven't paid yet.
 */
const MembershipGuard: React.FC<MembershipGuardProps> = ({ children }) => {
  const { isLocked, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  // Only lock out students. Admins or non-locked users pass.
  if (role === 'student' && isLocked) {
    // If we are already on the payment-required or profile page, don't redirect to avoid loops
    if (location.pathname === '/payment-required' || location.pathname === '/student/profile' || location.pathname === '/student/payment-required') {
      return <>{children}</>;
    }
    
    return <Navigate to="/student/payment-required" replace />;
  }

  return <>{children}</>;
};

export default MembershipGuard;

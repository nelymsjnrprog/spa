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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Verifying Access...</p>
        </div>
      </div>
    );
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

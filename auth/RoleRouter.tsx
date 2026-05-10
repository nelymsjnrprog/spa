
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * RoleRouter: Authority Director
 * Dispatches authenticated users to their specific zones based on Firestore role.
 * 
 * Reverted to invisible state. Delay is now handled within the Auth button.
 */
const RoleRouter: React.FC = () => {
  const { role, loading, user } = useAuth();
  const navigate = useNavigate();
  const navigationAttempted = useRef(false);

  useEffect(() => {
    if (loading || !user || navigationAttempted.current) return;

    navigationAttempted.current = true;

    if (role === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/student', { replace: true });
    }
  }, [loading, user, role, navigate]);

  return null;
};

export default RoleRouter;

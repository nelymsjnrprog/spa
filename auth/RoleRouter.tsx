
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * RoleRouter: Authority Director
 * Dispatches authenticated users to their specific zones based on Firestore role.
 */
const RoleRouter: React.FC = () => {
  const { role, loading, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isKickingOut, setIsKickingOut] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'student') {
        navigate('/student');
      }
    }
  }, [role, loading, user, navigate]);

  const handleManualKickout = async () => {
    setIsKickingOut(true);
    await logout();
    navigate('/login');
  };

  // If loading, show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-900 font-bold tracking-tight uppercase text-xs">Verifying Credentials...</div>
        </div>
      </div>
    );
  }

  // If loading finished, user exists, but no role found
  if (user && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-xl text-center border border-slate-100">
           <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-3xl"></i>
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-2">Profile Not Resolved</h2>
           <p className="text-slate-500 text-sm mb-8 leading-relaxed">
             We found your account, but your academic role hasn't been synchronized. This can happen if the database is still processing your registration.
           </p>
           <div className="space-y-3">
             <button 
                onClick={() => window.location.reload()}
                className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-100 hover:bg-primary-700 transition"
             >
                Try Again
             </button>
             <button 
                onClick={handleManualKickout}
                disabled={isKickingOut}
                className="w-full bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-100 transition"
             >
                {isKickingOut ? 'Signing out...' : 'Sign out'}
             </button>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default RoleRouter;

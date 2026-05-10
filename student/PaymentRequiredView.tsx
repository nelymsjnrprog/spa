import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { membershipService } from '../services/membershipService';

// Paystack configuration
const PAYSTACK_PUBLIC_KEY = 'pk_live_20856a01dfd3a8f81f74e388d57b75546313eadd';

const PaymentRequiredView: React.FC = () => {
  const { profile, membershipSettings, isLocked, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to dashboard if access is granted
  React.useEffect(() => {
    if (!isLocked && profile) {
      navigate('/student', { replace: true });
    }
  }, [isLocked, profile, navigate]);

  const levelSettings = React.useMemo(() => {
    if (!profile || !membershipSettings) return null;
    return membershipService.getFormLevelSettings(membershipSettings, profile.level || '100');
  }, [profile, membershipSettings]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handlePayment = () => {
    const PaystackPop = (window as any).PaystackPop;
    if (!profile || !levelSettings || !PaystackPop) {
      setError('Payment system is not available. Please refresh the page and try again.');
      return;
    }

    setLoading(true);
    setError('');

    const amountInPesewas = Math.round(levelSettings.price * 100);
    const reference = 'SP_RENEW_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    try {
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: profile.email,
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: "Student Name", variable_name: "student_name", value: profile.displayName },
            { display_name: "Level", variable_name: "level", value: profile.level },
            { display_name: "Institution", variable_name: "institution", value: profile.institution },
            { display_name: "Service", variable_name: "service", value: "SmartPrep Renewal" }
          ]
        },
        onSuccess: async (transaction: any) => {
          try {
            await membershipService.activateMembership(
              profile.uid,
              profile.email,
              profile.level || '100',
              levelSettings.price,
              transaction.reference || reference
            );
          } catch (err: any) {
            setError(err.message || "Failed to activate membership after payment.");
            setLoading(false);
          }
        },
        onCancel: () => {
          setLoading(false);
          setError('Payment was cancelled.');
        }
      });
    } catch (err: any) {
      setLoading(false);
      setError('Payment system failed to initialize. Please try again.');
      console.error('Paystack initialization error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f1] font-['Sora'] flex items-center justify-center p-6 sm:p-8 overflow-x-hidden">
      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rise-anim { animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      <div className="w-full max-w-sm bg-white rounded-[24px] overflow-hidden shadow-[0_20px_60px_rgba(15,110,86,0.12),0_4px_16px_rgba(0,0,0,0.06)] rise-anim">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-[#0a5c45] via-[#1D9E75] to-[#27c48f] p-8 pb-12 overflow-hidden text-white">
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5 blur-xl"></div>
          <div className="absolute -bottom-10 -left-6 w-52 h-52 rounded-full bg-white/5 blur-xl"></div>

          {/* Level Chip */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Level {profile?.level || '100'} Membership</span>
          </div>

          <h1 className="font-['DM_Serif_Display'] text-4xl sm:text-5xl leading-tight mb-2 relative z-10">
            Unlock
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-[260px] relative z-10">
            One-time payment gives you term access to everything at your level.
          </p>

          {/* Floating Lock Icon */}
          <div className="absolute -bottom-6 right-8 w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center z-20">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-7 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg animate-in fade-in slide-in-from-top-2">
              <p className="text-red-700 text-[10px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="flex items-end gap-1 mb-1.5">
            <span className="font-['DM_Serif_Display'] text-5xl text-[#0a2e22]">{levelSettings?.price || '0'}</span>
            <span className="text-lg font-bold text-[#1D9E75] mb-2 ml-1">GHS</span>
          </div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-4 h-[1px] bg-[#9aada4]"></div>
            <p className="text-xs text-[#9aada4] font-medium">One-time payment · Term access</p>
          </div>

          {levelSettings?.price && levelSettings.price > 0 ? (
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full relative group bg-gradient-to-br from-[#0F6E56] to-[#1D9E75] text-white py-4 rounded-xl font-bold text-sm tracking-wider shadow-[0_8px_20px_rgba(29,158,117,0.3)] hover:shadow-[0_12px_28px_rgba(29,158,117,0.4)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {loading ? (
                <i className="fas fa-circle-notch animate-spin text-lg"></i>
              ) : (
                'ACTIVATE NOW'
              )}
            </button>
          ) : (
            <div className="w-full py-4 px-6 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1">Awaiting Activation</p>
              <p className="text-xs text-black font-medium leading-relaxed">
                Your account is pending review. Please contact administration to complete your enrollment.
              </p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="mt-6 w-full text-center text-[10px] font-black text-black hover:text-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-sign-out-alt"></i>
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequiredView;

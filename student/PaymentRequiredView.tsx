import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Navbar, Container, Card } from '../ui/Layout';
import { membershipService } from '../services/membershipService';

// Paystack configuration (matching Login.tsx)
const PAYSTACK_PUBLIC_KEY = 'pk_live_20856a01dfd3a8f81f74e388d57b75546313eadd';

const PaymentRequiredView: React.FC = () => {
  const { profile, membershipSettings, isLocked, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to dashboard if access is granted (e.g. after payment)
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
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="max-w-2xl mx-auto py-12 px-4 shadow-sm">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-amber-100">
              <i className="fas fa-lock text-3xl text-amber-500"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Level Access Restricted</h1>
            <p className="text-slate-500 font-medium">Your level now requires a one-time membership payment to continue using premium features.</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 mb-8 flex items-center animate-in fade-in zoom-in-95">
              <i className="fas fa-exclamation-circle mr-3"></i> 
              <span className="uppercase tracking-wider leading-relaxed">{error}</span>
            </div>
          )}

          <Card className="p-0 overflow-hidden border-none shadow-2xl shadow-slate-200/50 mb-8 transform hover:scale-[1.01] transition-transform">
            <div className="bg-gradient-to-br from-primary-600 to-emerald-700 p-8 text-white text-center relative overflow-hidden">
               {/* Decorative Circles */}
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
               <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl"></div>

              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">Level {profile?.level || '100'} Membership</p>
              <h2 className="text-5xl font-black mb-2">{levelSettings?.price || '0.00'} <span className="text-lg opacity-70">GHS</span></h2>
              <p className="text-sm font-medium opacity-90 italic">One-time payment for lifetime access</p>
            </div>
            <div className="p-8 space-y-6 bg-white">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="fas fa-check text-emerald-600 text-xs"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Unlimited Access</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">Access all quizzes, study materials, and mock exams for your level.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="fas fa-check text-emerald-600 text-xs"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Real-time Performance</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">Detailed reports and progress tracking for every submission.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full block text-center py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <i className="fas fa-circle-notch animate-spin text-lg"></i>
                  ) : (
                    'Pay Now to Unlock'
                  )}
                </button>
              </div>
            </div>
          </Card>

          <div className="text-center">
             <button 
                onClick={handleLogout}
                className="text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center justify-center mx-auto"
             >
                <i className="fas fa-sign-out-alt mr-2"></i>Switch Account
             </button>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default PaymentRequiredView;

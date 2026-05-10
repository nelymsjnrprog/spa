import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../auth/authService';
import { useAuth } from '../auth/AuthProvider';
import { APP_CONFIG, ALLOWED_EMAIL_DOMAINS } from '../core/config';
import { institutionService, Institution } from '../services/institutionService';
import { membershipService } from '../services/membershipService';
import { MembershipSettings, UserRole } from '../core/types';

interface AuthSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup';
  quizCode?: string; // legacy prop, kept for backward compat
  initialLevel?: string;
}

const PAYSTACK_PUBLIC_KEY = 'pk_live_20856a01dfd3a8f81f74e388d57b75546313eadd';

const AuthSlidePanel: React.FC<AuthSlidePanelProps> = ({ isOpen, onClose, initialMode, quizCode: _quizCode, initialLevel }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [institution, setInstitution] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [level, setLevel] = useState('');
  const [program, setProgram] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    setMode(initialMode);
    setError('');
    if (initialLevel) {
      setLevel(initialLevel);
    }
  }, [initialMode, isOpen, initialLevel]);

  useEffect(() => {
    if (isOpen) {
        const unsubscribeInstitutions = institutionService.subscribeToInstitutions(setInstitutions);
        const unsubscribeMembership = membershipService.subscribeMembershipSettings(setMembershipSettings);
        return () => {
          unsubscribeInstitutions();
          unsubscribeMembership();
        };
    }
  }, [isOpen]);

  const currentLevelSettings = membershipSettings
    ? membershipService.getFormLevelSettings(membershipSettings, level)
    : null;

  const isPaymentRequired = currentLevelSettings?.paymentRequired === true;
  const isEnrollmentClosed = level && currentLevelSettings ? !currentLevelSettings.paymentRequired : false;

  const isFormComplete = 
    displayName.trim().split(/\s+/).length >= 2 &&
    phoneNumber.length >= 9 &&
    institution !== '' &&
    level !== '' &&
    program !== '' &&
    email.includes('@') &&
    password.length >= 6;

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.startsWith('0')) value = value.substring(1);
    if (value.length > 9) value = value.substring(0, 9);
    setPhoneNumber(value);
  };

  const initiatePaystackPayment = () => {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      setError('Payment system is not available. Please refresh the page and try again.');
      console.error('PaystackPop not found on window. Paystack script may not have loaded.');
      return;
    }
    setPaymentProcessing(true);
    setError('');
    const formattedPhone = '+233' + phoneNumber;
    const amountInPesewas = Math.round((currentLevelSettings?.price || 0) * 100);
    
    if (amountInPesewas <= 0) {
      setPaymentProcessing(false);
      setError('Invalid price configuration. Please contact the administrator.');
      return;
    }

    const reference = 'SP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    try {
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: {
          custom_fields: [
            {
              display_name: "Student Name",
              variable_name: "student_name",
              value: displayName
            },
            {
              display_name: "Level",
              variable_name: "level",
              value: level
            },
            {
              display_name: "Institution",
              variable_name: "institution",
              value: institution
            }
          ]
        },
        onSuccess: async (transaction: any) => {
          try {
            setLoading(true);
            await authService.signup(
              email,
              password,
              displayName,
              institution,
              formattedPhone,
              level,
              program,
              'student',
              transaction.reference,
              currentLevelSettings?.price
            );
            
            onClose();

            // Check for smart redirect to quiz
            const pendingQuizId = sessionStorage.getItem('pendingQuizId');
            if (pendingQuizId) {
              sessionStorage.removeItem('pendingQuizId');
              navigate(`/student/quiz/${pendingQuizId}`);
              return;
            }

            navigate('/student');
          } catch (err: any) {
            setError(err.message);
          } finally {
            setLoading(false);
            setPaymentProcessing(false);
          }
        },
        onCancel: () => {
          setPaymentProcessing(false);
          setError('Payment was cancelled.');
        }
      });
    } catch (err: any) {
      setPaymentProcessing(false);
      setError('Payment system failed to initialize. Please refresh and try again.');
      console.error('Paystack initialization error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
        // Validation for all fields
        if (displayName.trim().split(/\s+/).length < 2) {
            setError("Please provide your full name (First and Last name).");
            return;
        }
        if (phoneNumber.length < 9) {
            setError("Please enter a valid 9-digit phone number.");
            return;
        }
        if (!institution || !level || !program) {
            setError("Please select your institution, level, and program.");
            return;
        }
        if (isEnrollmentClosed) {
            setError("Enrollment is currently closed for this level.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
            setError("Please use a standard email provider.");
            return;
        }

        if (isPaymentRequired) {
            initiatePaystackPayment();
            return;
        }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const formattedPhone = '+233' + phoneNumber;
        await authService.signup(email, password, displayName, institution, formattedPhone, level, program, 'student');
      } else if (mode === 'login') {
        await authService.login(email, password);
      } else if (mode === 'forgot') {
        await authService.sendPasswordReset(email);
        setResetSent(true);
        setLoading(false);
        return;
      }

      // Lazy loading for 4 seconds after account detected
      // This keeps the button spinning while background sync happens
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Check for smart redirect to quiz
      const pendingQuizId = sessionStorage.getItem('pendingQuizId');
      if (pendingQuizId) {
        sessionStorage.removeItem('pendingQuizId');
        onClose(); // Close only if jumping to quiz
        navigate(`/student/quiz/${pendingQuizId}`);
        return;
      }

      navigate('/student');
    } catch (err: any) {
      setError(err.message);
      setLoading(false); // Important: reset loading on error
    } finally {
      // Don't setLoading(false) here because it will flicker before navigation
      // Instead, we only reset it on error or if we don't navigate
    }
  };

  return (
    <>
      
    <div className={`fixed inset-0 h-full w-full bg-white z-[101] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto safe-pt`}>
      <div className="min-h-screen w-full flex flex-col items-center py-10 px-6 sm:py-16">
        <div className="w-full max-w-md">



          <div className="mb-10">
              <div className="mb-8">
                <span className="text-sm font-black uppercase tracking-[0.2em] text-black">{APP_CONFIG.name}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-[2px] bg-[#1a732a]"></div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a732a]">
                  {mode === 'login' ? 'Student Access' : mode === 'signup' ? 'New Account' : 'Reset Password'}
                </p>
              </div>
            <p className="text-black font-medium text-sm">
                {mode === 'login' ? 'Sign in to continue to your dashboard' : mode === 'signup' ? 'Fill in to create your academic portal' : 'We will send a recovery link to your email'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-3 mb-6 rounded-xl animate-in fade-in slide-in-from-top-2">
              <p className="text-red-700 text-[10px] font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                {/* Section 1: Personal Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-black">Full Name</label>
                      <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Doe" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium outline-none" required />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-black">Phone Number</label>
                      <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-bold text-sm">+233</span>
                          <input type="tel" value={phoneNumber} onChange={handlePhoneNumberChange} placeholder="24 000 0000" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-14 pr-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium outline-none" required />
                      </div>
                  </div>
                </div>

                {/* Section 2: Academic Information */}
                <div className="space-y-4">
                  <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-black">Institution</label>
                      <select value={institution} onChange={e => setInstitution(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium appearance-none outline-none" required>
                          <option value="">Select School</option>
                          {institutions.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}
                      </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-black">Level</label>
                        <select value={level} onChange={e => { setLevel(e.target.value); setError(''); }} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium appearance-none outline-none" required>
                            <option value="">Select Level</option>
                            <option value="100">Level 100</option>
                            <option value="200">Level 200</option>
                            <option value="300">Level 300</option>
                            <option value="Candidate">Candidate</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-black">Program</label>
                        <select value={program} onChange={e => setProgram(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium appearance-none outline-none" required>
                            <option value="">Select Program</option>
                            <option value="RCN">RCN</option>
                            <option value="RGN">RGN</option>
                            <option value="RMN">RMN</option>
                            <option value="RPHN">RPHN</option>
                        </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Account Security */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-black">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium outline-none" required />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-black">Password</label>
                      <div className="relative">
                          <input 
                              type={showPassword ? "text" : "password"} 
                              value={password} 
                              onChange={e => setPassword(e.target.value)} 
                              placeholder="••••••••" 
                              className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm outline-none" 
                              required 
                          />
                          <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-black transition"
                          >
                              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                      </div>
                  </div>
                </div>

                {isPaymentRequired && isFormComplete && (
                    <div className="bg-[#1a732a]/5 border border-[#1a732a]/10 rounded-xl p-6 text-center animate-in zoom-in-95">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1a732a] mb-1">Registration Fee</p>
                        <p className="text-3xl font-black text-[#1a732a]">{currentLevelSettings?.price}<span className="text-xs ml-1 font-bold">GHS</span></p>
                    </div>
                )}
              </div>
            )}

            {mode === 'login' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-black">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium outline-none" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-black">Password</label>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="Enter your password" 
                            className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm outline-none" 
                            required 
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-black transition"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                    </div>
                    <div className="flex justify-end pt-0.5">
                        <button type="button" onClick={() => setMode('forgot')} className="text-xs font-bold text-[#1a732a] hover:underline">Forgot password?</button>
                    </div>
                </div>
              </div>
            )}

            {mode === 'forgot' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    {resetSent ? (
                        <div className="bg-green-50 border border-green-100 p-8 rounded-xl text-center">
                            <div className="w-12 h-12 bg-[#1a732a] rounded-full flex items-center justify-center text-white mx-auto mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <h3 className="text-lg font-black text-black">Email Sent!</h3>
                            <p className="text-black text-xs font-medium mt-1">Check your inbox for the reset link.</p>
                            <button type="button" onClick={() => setMode('login')} className="mt-6 text-[10px] font-black uppercase tracking-widest text-[#1a732a] underline">Back to Login</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-black">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 focus:border-[#1a732a] focus:ring-0 transition-all text-sm font-medium outline-none" required />
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-4 pt-4">
                <button 
                    type="submit" 
                    disabled={loading || paymentProcessing || (mode === 'signup' && isEnrollmentClosed)}
                    className="flex-1 bg-[#1a732a] text-white py-3.5 rounded-lg font-bold text-sm hover:bg-[#145920] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading || paymentProcessing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <span>{mode === 'login' ? 'Sign In' : mode === 'signup' ? (isEnrollmentClosed ? 'Enrollment Closed' : (isPaymentRequired ? 'Pay & Join Now' : 'Join Us')) : 'Reset Password'}</span>
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </>
                    )}
                </button>
            </div>
          </form>

          <div className="mt-8 pt-4 text-center">
            <p className="text-xs font-medium text-black tracking-tight">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button 
                    onClick={() => {
                        if (mode === 'login' || mode === 'forgot') setMode('signup');
                        else setMode('login');
                        setError('');
                    }} 
                    className="ml-1.5 text-[#1a732a] font-bold hover:underline"
                >
                    {mode === 'login' || mode === 'forgot' ? 'Create one →' : 'Sign in →'}
                </button>
            </p>
          </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthSlidePanel;

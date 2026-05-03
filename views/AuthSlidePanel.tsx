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
  const [step, setStep] = useState(1);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    setMode(initialMode);
    setStep(1);
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

  const isPaymentRequired = currentLevelSettings?.paymentRequired === true && (currentLevelSettings?.price || 0) > 0;

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

            navigate('/dispatch');
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

    if (mode === 'signup' && step < 3) {
        if (step === 1) {
            if (displayName.trim().split(/\s+/).length < 2) {
                setError("Please provide your full name (First and Last name).");
                return;
            }
            if (phoneNumber.length < 9) {
                setError("Please enter a valid 9-digit phone number.");
                return;
            }
        }
        if (step === 2) {
            if (!institution || !level || !program) {
                setError("Please select your institution, level, and program.");
                return;
            }
        }
        setStep(step + 1);
        return;
    }

    if (mode === 'signup' && step === 3) {
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
      onClose();

      // Check for smart redirect to quiz
      const pendingQuizId = sessionStorage.getItem('pendingQuizId');
      if (pendingQuizId) {
        sessionStorage.removeItem('pendingQuizId');
        navigate(`/student/quiz/${pendingQuizId}`);
        return;
      }

      navigate('/dispatch');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      
    <div className={`fixed inset-0 h-full w-full bg-white z-[101] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto`}>
      <div className="min-h-screen w-full flex flex-col items-center py-12 px-6 sm:py-20">
        <div className="w-full max-w-xl">
          <div className="flex justify-between items-center mb-16">
            <button onClick={onClose} className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-black uppercase text-[10px] tracking-widest">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Back to Home</span>
            </button>
          </div>

          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
               {mode === 'signup' && (
                 <div className="flex gap-1.5">
                   {[1, 2, 3].map(i => (
                     <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? (step === i ? 'w-8 bg-primary-600' : 'w-4 bg-primary-200') : 'w-4 bg-slate-100'}`}></div>
                   ))}
                 </div>
               )}
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-slate-900">
                {mode === 'login' ? 'Welcome' : mode === 'signup' ? (step === 1 ? 'Start Journey' : step === 2 ? 'Academic Details' : 'Final Step') : 'Reset Password'}
            </h2>
            <p className="text-slate-500 font-medium text-lg">
                {mode === 'login' ? 'Sign in to access your dashboard' : mode === 'signup' ? 'Join the premium student registry' : 'We will send a recovery link to your email'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg animate-in fade-in slide-in-from-top-2">
              <p className="text-red-700 text-xs font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <>
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
                        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+233</span>
                            <input type="tel" value={phoneNumber} onChange={handlePhoneNumberChange} placeholder="24 000 0000" className="w-full bg-slate-50 border-0 rounded-xl py-4 pl-16 pr-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium" required />
                        </div>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Institution</label>
                        <select value={institution} onChange={e => setInstitution(e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium appearance-none" required>
                            <option value="">Select School</option>
                            {institutions.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Academic Level</label>
                        <select value={level} onChange={e => setLevel(e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium appearance-none" required>
                            <option value="">Select Level</option>
                            <option value="100">Level 100</option>
                            <option value="200">Level 200</option>
                            <option value="300">Level 300</option>
                            <option value="Candidate">Candidate</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Academic Program</label>
                        <select value={program} onChange={e => setProgram(e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium appearance-none" required>
                            <option value="">Select Program</option>
                            <option value="RCN">RCN</option>
                            <option value="RGN">RGN</option>
                            <option value="RMN">RMN</option>
                            <option value="RPHN">RPHN</option>
                        </select>
                    </div>
                  </div>
                )}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                    className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all tracking-widest" 
                                    required 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                >
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>
                        {isPaymentRequired && (
                            <div className="bg-[#1a732a]/5 border border-[#1a732a]/10 rounded-2xl p-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#1a732a] mb-1">Payment Required</p>
                                <p className="text-3xl font-black text-[#1a732a]">{currentLevelSettings?.price}<span className="text-xs ml-1">GHS</span></p>
                            </div>
                        )}
                    </div>
                )}
              </>
            )}

            {mode === 'login' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium" required />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</label>
                        <button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-black uppercase tracking-widest text-[#1a732a]">Forgot?</button>
                    </div>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="••••••••" 
                            className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all tracking-widest" 
                            required 
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                </div>
              </div>
            )}

            {mode === 'forgot' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    {resetSent ? (
                        <div className="bg-green-50 border border-green-100 p-6 rounded-2xl text-center">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <p className="text-green-800 font-bold">Email Sent!</p>
                            <p className="text-green-700 text-sm mt-1">Check your inbox for the reset link.</p>
                            <button type="button" onClick={() => setMode('login')} className="mt-6 text-sm font-black uppercase tracking-widest text-green-800 underline">Back to Login</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-[#1a732a] transition-all font-medium" required />
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-4 pt-6">
                {mode === 'signup' && step > 1 && (
                    <button type="button" onClick={() => setStep(step - 1)} className="flex-1 py-4 rounded-xl font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all">Back</button>
                )}
                <button 
                    type="submit" 
                    disabled={loading || paymentProcessing}
                    className="flex-[2] bg-[#1a1a1a] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading || paymentProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <span>{mode === 'login' ? 'Sign In' : mode === 'signup' ? (step === 3 ? (isPaymentRequired ? 'Pay & Join' : 'Complete') : 'Continue') : 'Reset'}</span>
                            {mode !== 'forgot' && <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
                        </>
                    )}
                </button>
            </div>
          </form>

          <div className="mt-12 pt-12 border-t border-slate-100 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                {mode === 'login' ? "Don't have an account?" : "Already member?"}
                <button 
                    onClick={() => {
                        if (mode === 'login' || mode === 'forgot') setMode('signup');
                        else setMode('login');
                        setError('');
                    }} 
                    className="ml-3 text-[#1a732a] underline"
                >
                    {mode === 'login' || mode === 'forgot' ? 'Create Account' : 'Login Here'}
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

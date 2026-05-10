import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AuthSlidePanel from './AuthSlidePanel';
import { membershipService } from '../services/membershipService';
import { MembershipSettings } from '../core/types';
import ContactSlidePanel from '../components/ContactSlidePanel';
import { quizService } from '../services/quizService';
import { supportService } from '../services/supportService';

const ProductDemoScenes: React.FC<{ activeScene: number }> = ({ activeScene }) => {
  return (
    <div className="absolute inset-0">
      {/* Scene 1: Teacher Creates Quiz */}
      <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center transition-all duration-700 ${activeScene === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-100 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
            <div className="w-8 h-8 bg-primary-100 rounded text-primary-600 flex items-center justify-center font-bold">+</div>
            <span className="font-bold text-slate-800">Create Quiz</span>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-3/4 bg-slate-50 rounded animate-typing"></div>
            <div className="h-4 w-1/2 bg-slate-50 rounded animate-typing-delayed"></div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 border border-slate-100 rounded-lg"></div>)}
            </div>
          </div>
          <button className={`w-full py-3 rounded-lg font-bold text-white transition-all ${activeScene === 0 ? 'bg-[#1a732a] scale-100' : 'bg-slate-200 scale-95'}`}>
            Generate Code
          </button>
          <div className={`mt-2 py-2 bg-primary-50 rounded-lg text-center font-mono font-bold text-primary-700 transition-all duration-500 ${activeScene === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
            #ACA247
          </div>
        </div>
      </div>

      {/* Scene 2: Student Enters Code */}
      <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center transition-all duration-700 ${activeScene === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="w-full max-w-sm space-y-6 text-center">
          <h3 className="text-xl font-extrabold text-slate-800">Join a Quiz</h3>
          <div className="flex items-center bg-white p-2 rounded-xl shadow-xl border border-slate-200">
            <div className="flex-1 px-4 py-3 text-lg font-mono font-bold text-[#1a732a] animate-type-code">
              #ACA247
            </div>
            <button className="bg-[#1a732a] text-white w-12 h-12 rounded-lg flex items-center justify-center animate-pulse">
              →
            </button>
          </div>
        </div>
      </div>

      {/* Scene 3: Student Attempts Quiz */}
      <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center transition-all duration-700 ${activeScene === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-100 p-6 space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-900 rounded"></div>
            <div className="h-4 w-2/3 bg-slate-900 rounded"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-12 border-2 rounded-xl flex items-center px-4 font-bold transition-all duration-500 ${i === 2 && activeScene === 2 ? 'border-[#1a732a] bg-[#ecfdf5] translate-x-2' : 'border-slate-50 text-slate-300'}`}>
                Option {i}
              </div>
            ))}
          </div>
          <div className={`mt-4 py-4 bg-[#1a732a] rounded-xl text-center text-white font-black text-2xl transition-all duration-1000 delay-500 ${activeScene === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            8 / 10 ✓
          </div>
        </div>
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizCode, setQuizCode] = useState('');
  const [bannerQuizCode, setBannerQuizCode] = useState('');
  const [activeScene, setActiveScene] = useState(0);
  
  // Auth Panel State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingQuizCode, setPendingQuizCode] = useState<string | undefined>(undefined);
  const [pendingLevel, setPendingLevel] = useState<string | undefined>(undefined);

  // Additional Panels State
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings | null>(null);

  // Body Scroll Lock
  useEffect(() => {
    if (isAuthOpen || isPricingOpen || isTermsOpen || isPrivacyOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }

    // Ensure scrolling is restored when leaving the page or component unmounts
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isAuthOpen, isPricingOpen, isTermsOpen, isPrivacyOpen]);

  // Subscribe to membership settings
  useEffect(() => {
    const unsubscribe = membershipService.subscribeMembershipSettings(setMembershipSettings);
    return () => unsubscribe();
  }, []);

  // Support Form State
  const [supportData, setSupportData] = useState({ name: '', email: '', subject: '', message: '' });
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSupport(true);
    try {
      await supportService.submitInquiry(supportData);
      setSupportSubmitted(true);
      setSupportData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSupportSubmitted(false), 5000);
    } catch (error) {
      console.error("Error submitting support inquiry:", error);
      alert("Failed to send message. Please try again later.");
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const openAuth = (mode: 'login' | 'signup', code?: string, level?: string) => {
    setAuthMode(mode);
    setPendingQuizCode(code);
    setPendingLevel(level);
    setIsAuthOpen(true);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleBannerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = bannerQuizCode.trim();
    if (!code) return;

    if (!/^\d{6}$/.test(code)) {
      alert('Please enter a valid 6-digit numeric quiz code.');
      return;
    }

    try {
      const quiz = await quizService.getQuizByCode(code);
      
      if (!quiz) {
        alert('Invalid or inactive quiz code. Please check with your teacher.');
        return;
      }

      // Check expiry
      if (quiz.availableUntil && quiz.availableUntil < Date.now()) {
        alert('This quiz session has already ended.');
        return;
      }

      // Smart Student Detection
      if (user) {
        // Already logged in, jump straight to quiz
        navigate(`/student/quiz/${quiz.id}`);
      } else {
        // Not logged in, save destination and show login
        sessionStorage.setItem('pendingQuizId', quiz.id);
        openAuth('login');
      }
    } catch (error) {
      console.error("Error checking quiz code:", error);
      alert('An error occurred while verifying the quiz code.');
    }
  };

  const handleStart = () => {
    if (user) {
      navigate('/dispatch');
    } else {
      openAuth('login');
    }
  };





  return (
    <div className="min-h-screen bg-white font-['Inter'] text-[#1a1a1a]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-100 px-5 py-3.5 md:px-6 flex items-center justify-between safe-pt">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-lg font-bold tracking-tight text-slate-900 leading-tight">SMARTPREPACA</span>
        </div>

        {/* Center: Empty (for balance) */}
        <div className="hidden md:flex flex-1"></div>

        {/* Right: Navigation Items */}
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => openAuth('login')}
            className="text-[14px] md:text-[15px] font-medium text-slate-600 hover:text-slate-900 transition-colors px-2"
          >
            Log In
          </button>
          <button 
            onClick={() => openAuth('signup')}
            className="bg-[#1a732a] text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg text-[14px] md:text-[15px] font-semibold hover:bg-[#145920] transition-all shadow-sm active:scale-95"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Join Quiz Banner Section */}
      <div className="pt-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto bg-[#2D4A6B] rounded-2xl p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all hover:shadow-primary-900/10">
          <div className="text-left">
            <h2 className="text-2xl font-bold text-white mb-1">Join a Quiz</h2>
            <p className="text-slate-300 text-sm font-medium">Access your session instantly</p>
          </div>
          <form onSubmit={handleBannerJoin} className="w-full max-w-sm flex items-center bg-white p-1 rounded-lg border-4 border-[#ffffff20]">
            <span className="pl-4 text-slate-400 font-mono text-xl">#</span>
            <input 
              type="text" 
              placeholder="Enter 6-digit code"
              value={bannerQuizCode}
              onChange={(e) => setBannerQuizCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
              maxLength={6}
              className="flex-1 min-w-0 px-2 py-3 outline-none text-lg font-mono font-bold text-[#2D4A6B] placeholder:font-sans placeholder:font-normal placeholder:text-slate-300"
            />
            {bannerQuizCode.length > 0 && (
              <button 
                type="submit"
                className="bg-[#1a732a] text-white w-12 h-12 shrink-0 rounded-r-lg flex items-center justify-center hover:bg-[#145920] transition-all shadow-lg active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-24 pb-20 px-6 bg-[#f4f1ea]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="space-y-10">
            <h1 className="text-[42px] lg:text-[72px] font-[850] leading-[1.1] tracking-tight text-[#1a1a1a]">
              Make your preparation <br className="hidden lg:block" /> truly <span className="text-[#1a732a]">interactive</span>.
            </h1>
            <p className="text-lg lg:text-xl text-[#545454] max-w-2xl mx-auto leading-relaxed font-medium">
              The easiest way to prepare for exams, engage with content, and track your progress through smart, adaptive technology.
            </p>
          </div>
        </div>
      </section>





      {/* Product Demo Section */}
      <section className="py-24 px-6 bg-[#F8F9FA]">
        <div className="max-w-4xl mx-auto text-center mb-16 space-y-4">
          <h2 className="text-3xl lg:text-5xl font-extrabold text-[#1a1a1a]">See How It Works</h2>
          <p className="text-lg text-[#545454] font-medium">From quiz creation to student results — in seconds</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="relative aspect-video bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Browser Header Mockup */}
            <div className="h-10 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="ml-4 h-5 w-48 bg-white rounded border border-slate-100"></div>
            </div>

            {/* Scenes Container */}
            <div className="flex-1 relative overflow-hidden">
              <ProductDemoScenes activeScene={activeScene} />
            </div>
          </div>

          {/* Indicators */}
          <div className="flex justify-center gap-2 mt-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${activeScene === i ? 'bg-[#1a732a]' : 'bg-slate-200'}`}></div>
            ))}
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">

            {/* Left: Heading + descriptor */}
            <div className="lg:w-5/12 space-y-5 lg:pt-2">

              <h2 className="text-3xl lg:text-4xl font-black text-[#1a1a1a] tracking-tight leading-snug">
                Need help with something?
              </h2>
              <p className="text-[15px] text-slate-500 font-medium leading-relaxed">
                Send us a message and we'll get back to you within 24 hours.
              </p>
            </div>

            {/* Right: Form */}
            <div className="lg:w-7/12 w-full">
              {supportSubmitted ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-[#ecfdf5] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#1a732a]" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-lg font-black text-[#1a1a1a]">Message sent.</h3>
                  <p className="text-slate-500 font-medium text-sm">We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Your Name"
                      required
                      value={supportData.name}
                      onChange={e => setSupportData({...supportData, name: e.target.value})}
                      className="w-full bg-transparent border border-slate-200 rounded-lg py-3 px-4 text-[14px] text-[#1a1a1a] placeholder:text-slate-400 focus:border-[#1a732a] focus:outline-none transition-colors font-medium"
                    />
                    <input
                      type="email"
                      placeholder="Your Email"
                      required
                      value={supportData.email}
                      onChange={e => setSupportData({...supportData, email: e.target.value})}
                      className="w-full bg-transparent border border-slate-200 rounded-lg py-3 px-4 text-[14px] text-[#1a1a1a] placeholder:text-slate-400 focus:border-[#1a732a] focus:outline-none transition-colors font-medium"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Subject"
                    required
                    value={supportData.subject}
                    onChange={e => setSupportData({...supportData, subject: e.target.value})}
                    className="w-full bg-transparent border border-slate-200 rounded-lg py-3 px-4 text-[14px] text-[#1a1a1a] placeholder:text-slate-400 focus:border-[#1a732a] focus:outline-none transition-colors font-medium"
                  />
                  <textarea
                    placeholder="How can we help you?"
                    required
                    rows={5}
                    value={supportData.message}
                    onChange={e => setSupportData({...supportData, message: e.target.value})}
                    className="w-full bg-transparent border border-slate-200 rounded-lg py-3 px-4 text-[14px] text-[#1a1a1a] placeholder:text-slate-400 focus:border-[#1a732a] focus:outline-none transition-colors font-medium resize-none"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={isSubmittingSupport}
                    className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmittingSupport ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      <footer className="bg-primary-600 text-white py-12 md:py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 mb-12">
            {/* Column 1: Brand */}
            <div className="space-y-4">
              <h3 className="font-bold text-xl tracking-tight uppercase">SMARTPREPACA</h3>
              <p className="text-white/70 text-sm font-medium leading-relaxed">The smart way to prepare and assess</p>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Product</h4>
              <ul className="space-y-3">
                <li><button onClick={() => setIsPricingOpen(true)} className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Pricing</button></li>
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Company</h4>
              <ul className="space-y-3">
                <li><button onClick={() => setIsPrivacyOpen(true)} className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Privacy</button></li>
                <li><button onClick={() => setIsTermsOpen(true)} className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Terms</button></li>

              </ul>
            </div>

            {/* Column 4: Community */}
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Community</h4>
              <a href="#" className="inline-flex items-center gap-2.5 text-[14px] font-bold text-white bg-white/10 px-5 py-3 rounded-2xl hover:bg-white/20 transition-all border border-white/5">
                <i className="fab fa-whatsapp text-lg"></i>
                Join our WhatsApp
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[11px] font-bold text-white/50 tracking-wide">© 2026 SmartPrepAca. All rights reserved.</p>
          </div>
        </div>
      </footer>
      <style>{`
        @keyframes typing {
          from { width: 0; opacity: 0; }
          to { width: 75%; opacity: 1; }
        }
        @keyframes typing-delayed {
          from { width: 0; opacity: 0; }
          20% { width: 0; opacity: 0; }
          to { width: 50%; opacity: 1; }
        }
        .animate-typing {
          animation: typing 1.5s ease-out forwards;
        }
        .animate-typing-delayed {
          animation: typing-delayed 2s ease-out forwards;
        }
        @keyframes typeCode {
          0% { content: ""; }
          20% { content: "#"; }
          40% { content: "#A"; }
          60% { content: "#AC"; }
          80% { content: "#ACA"; }
          100% { content: "#ACA247"; }
        }
        .animate-type-code::after {
          content: "";
          animation: typeCode 1.5s steps(7) forwards;
        }
      `}</style>

      {/* Auth Slide Panel */}
      <AuthSlidePanel 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        initialMode={authMode} 
        quizCode={pendingQuizCode}
        initialLevel={pendingLevel}
      />

      {/* Pricing Slide Panel */}
      <PricingSlidePanel 
        isOpen={isPricingOpen} 
        onClose={() => setIsPricingOpen(false)} 
        settings={membershipSettings}
        onSelectPlan={(level) => {
          setIsPricingOpen(false);
          openAuth('signup', undefined, level);
        }}
      />



      {/* Terms Slide Panel */}
      <TermsSlidePanel 
        isOpen={isTermsOpen} 
        onClose={() => setIsTermsOpen(false)} 
      />

      {/* Privacy Slide Panel */}
      <PrivacySlidePanel 
        isOpen={isPrivacyOpen} 
        onClose={() => setIsPrivacyOpen(false)} 
      />
    </div>
  );
};

const TermsSlidePanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  return (
    <div className={`fixed inset-0 h-full w-full bg-white z-[110] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto safe-pt`}>
      <div className="min-h-screen w-full flex flex-col items-center py-12 px-6 sm:py-20">
        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-16">
            <button onClick={onClose} className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-black uppercase text-[10px] tracking-widest">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Close</span>
            </button>
          </div>

          <div className="mb-16">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-slate-900">Terms of Service</h2>
            <p className="text-slate-500 font-medium text-xl">Last Updated: April 27, 2026</p>
          </div>

          <div className="prose prose-slate max-w-none space-y-10">
            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Acceptance of Terms</h3>
              <p className="text-slate-600 leading-relaxed font-medium">By accessing or using SmartPrepAca, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, you should not use our services.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Description of Service</h3>
              <p className="text-slate-600 leading-relaxed font-medium">SmartPrepAca provides an online examination and academic preparation platform. We reserve the right to modify or discontinue any part of the service at any time without prior notice.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">User Conduct</h3>
              <p className="text-slate-600 leading-relaxed font-medium">You agree to use the platform for lawful purposes only. Prohibited conduct includes but is not limited to:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                <li>Attempting to cheat or bypass examination security measures.</li>
                <li>Sharing account credentials with third parties.</li>
                <li>Using the service to transmit malicious software or spam.</li>
                <li>Harvesting student or instructor data without authorization.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Intellectual Property</h3>
              <p className="text-slate-600 leading-relaxed font-medium">All content on SmartPrepAca, including text, graphics, logos, and software, is the property of SmartPrepAca or its content suppliers and is protected by intellectual property laws.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Limitation of Liability</h3>
              <p className="text-slate-600 leading-relaxed font-medium">SmartPrepAca shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use the service.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Governing Law</h3>
              <p className="text-slate-600 leading-relaxed font-medium">These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which SmartPrepAca operates, without regard to its conflict of law principles.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrivacySlidePanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  return (
    <div className={`fixed inset-0 h-full w-full bg-white z-[110] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto safe-pt`}>
      <div className="min-h-screen w-full flex flex-col items-center py-12 px-6 sm:py-20">
        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-16">
            <button onClick={onClose} className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-black uppercase text-[10px] tracking-widest">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Close</span>
            </button>
          </div>

          <div className="mb-16">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-slate-900">Privacy Policy</h2>
            <p className="text-slate-500 font-medium text-xl">Last Updated: April 27, 2026</p>
          </div>

          <div className="prose prose-slate max-w-none space-y-10">
            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Information We Collect</h3>
              <p className="text-slate-600 leading-relaxed font-medium">We collect information you provide directly to us, such as when you create an account, participate in an exam, or contact support. This may include:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                <li>Name, email address, and phone number.</li>
                <li>Institution and academic program details.</li>
                <li>Quiz responses and performance data.</li>
                <li>Payment information (processed securely through Paystack).</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">How We Use Your Information</h3>
              <p className="text-slate-600 leading-relaxed font-medium">We use the information we collect to provide, maintain, and improve our services, including:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                <li>Processing your registration and verifying your identity.</li>
                <li>Generating and storing your exam results.</li>
                <li>Enabling real-time monitoring for authorized instructors.</li>
                <li>Communicating with you about your account and platform updates.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Data Security</h3>
              <p className="text-slate-600 leading-relaxed font-medium">We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Sharing of Information</h3>
              <p className="text-slate-600 leading-relaxed font-medium">We do not sell or rent your personal information to third parties. We may share information with your institution or authorized instructors for academic purposes.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Your Rights</h3>
              <p className="text-slate-600 leading-relaxed font-medium">You have the right to access, correct, or delete your personal information. You can manage most of your data through your profile dashboard.</p>
            </section>

            <section className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Cookies</h3>
              <p className="text-slate-600 leading-relaxed font-medium">We use cookies to improve your browsing experience and analyze site traffic. You can choose to disable cookies through your browser settings, though this may affect platform functionality.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const PricingSlidePanel: React.FC<{ isOpen: boolean; onClose: () => void; settings: MembershipSettings | null; onSelectPlan: (level: string) => void }> = ({ isOpen, onClose, settings, onSelectPlan }) => {
  const levels = [
    { id: '100', name: 'Level 100', key: 'form1', features: ['Standard Quiz Access', 'Results Tracking', 'Academic Support'] },
    { id: '200', name: 'Level 200', key: 'form2', features: ['Advanced Quiz Access', 'Results Tracking', 'Mock Examinations'] },
    { id: '300', name: 'Level 300', key: 'form3', features: ['Full Curriculum Access', 'Performance Analytics', 'Live Monitoring'] },
    { id: 'Candidate', name: 'Candidate', key: 'candidate', features: ['Full Professional Prep', 'Private Simulation', 'Direct Feedback'] }
  ];

  return (
    <div className={`fixed inset-0 h-full w-full bg-white z-[110] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto safe-pt`}>
      <div className="min-h-screen w-full flex flex-col items-center py-12 px-6 sm:py-20">
        <div className="w-full max-w-7xl">
          <div className="flex justify-between items-center mb-16">
            <button onClick={onClose} className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-black uppercase text-[10px] tracking-widest">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Close</span>
            </button>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 text-slate-900">Pricing Plans</h2>
            <p className="text-slate-500 font-medium text-xl max-w-2xl mx-auto">
              Real-time subscription plans based on your academic level.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {levels.map((lvl) => {
              const lvlSettings = settings ? (settings as any)[lvl.key] : { price: 0, paymentRequired: false };
              const isFree = !lvlSettings.paymentRequired;

              return (
                <div key={lvl.id} className={`bg-white border-2 rounded-[2.5rem] p-8 flex flex-col h-full transition-all duration-500 shadow-sm hover:shadow-xl ${lvl.id === 'Candidate' ? 'border-primary-600' : 'border-slate-50'}`}>
                  <div className="mb-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary-600 mb-2">{lvl.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">GHS {lvlSettings.price}</span>
                      <span className="text-slate-400 font-bold">/term</span>
                    </div>
                    {isFree && <span className="inline-block mt-2 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-full">Enrollment Closed</span>}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {lvl.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-600 text-sm font-medium">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => !isFree && onSelectPlan(lvl.id)}
                    className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isFree ? 'bg-red-50 text-red-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/10 active:scale-95'}`}
                  >
                    {isFree ? 'Enrollment Closed' : 'Choose Plan'}
                  </button>
                </div>
              );
            })}
          </div>



          <div className="max-w-3xl mx-auto space-y-12">
            <h3 className="text-3xl font-black text-slate-900 text-center">Frequently Asked Questions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {[
                { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time from your account settings. You will maintain access until the end of your billing cycle." },
                { q: "Is there a free trial?", a: "Absolutely! New users can explore our Pro features for 7 days before deciding to subscribe." },
                { q: "What payment methods are accepted?", a: "We accept all major credit cards, Mobile Money (MTN, Vodafone, AirtelTigo), and Paystack-supported methods." },
                { q: "Can I upgrade or downgrade?", a: "Yes, you can change your plan at any time. Changes are applied immediately with pro-rated billing." }
              ].map((faq, i) => (
                <div key={i} className="space-y-3">
                  <h4 className="font-black text-slate-900">{faq.q}</h4>
                  <p className="text-slate-500 font-medium leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};





export default LandingPage;

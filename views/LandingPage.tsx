import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { APP_CONFIG } from '../core/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../core/firebase';
import AuthSlidePanel from './AuthSlidePanel';

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

  // Support Form State
  const [supportData, setSupportData] = useState({ name: '', email: '', message: '' });
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send this to a backend or Firestore
    console.log('Support request:', supportData);
    setSupportSubmitted(true);
    setTimeout(() => {
      setSupportSubmitted(false);
      setSupportData({ name: '', email: '', message: '' });
    }, 5000);
  };

  const openAuth = (mode: 'login' | 'signup', code?: string) => {
    setAuthMode(mode);
    setPendingQuizCode(code);
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
    const code = bannerQuizCode.trim().toUpperCase();
    if (!code) return;

    try {
      const q = query(
        collection(db, 'quizzes'),
        where('code', '==', code),
        where('isActive', '==', true),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert('Invalid or inactive quiz code. Please check with your teacher.');
        return;
      }

      const quizDoc = querySnapshot.docs[0];
      const quizData = quizDoc.data();
      
      // Check expiry
      if (quizData.expiresAt) {
        const expiresAt = quizData.expiresAt.toDate();
        if (expiresAt < new Date()) {
          alert('This quiz code has expired.');
          return;
        }
      }

      // Device detection
      const deviceId = localStorage.getItem('smartprep_device_id');
      if (deviceId && user) {
        // Known device and logged in, take to quiz
        navigate(`/student/quiz/${quizDoc.id}`);
      } else {
        // Not detected or not logged in, open auth panel with quiz code
        openAuth('login', code);
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

  const handleJoinQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (quizCode.trim()) {
      // Mock navigation to a quiz
      alert(`Joining quiz with code: ${quizCode}`);
    }
  };



  return (
    <div className="min-h-screen bg-white font-['Inter'] text-[#1a1a1a]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-100 px-5 py-3.5 md:px-6 flex items-center justify-between">
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
            Register
          </button>
        </div>
      </nav>

      {/* Join Quiz Banner Section */}
      <div className="pt-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto bg-[#2D4A6B] rounded-2xl p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:shadow-primary-900/10">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-white mb-1">Join a Quiz</h2>
            <p className="text-slate-300 text-sm font-medium">Access your session instantly</p>
          </div>
          <form onSubmit={handleBannerJoin} className="w-full max-w-sm flex items-center bg-white p-1 rounded-full border-4 border-[#ffffff20]">
            <span className="pl-4 text-slate-400 font-mono text-xl">#</span>
            <input 
              type="text" 
              placeholder="Enter quiz code here"
              value={bannerQuizCode}
              onChange={(e) => setBannerQuizCode(e.target.value)}
              className="flex-1 min-w-0 px-2 py-3 outline-none text-lg font-mono font-bold text-[#2D4A6B] placeholder:font-sans placeholder:font-normal placeholder:text-slate-300"
            />
            <button 
              type="submit"
              className="bg-[#1a732a] text-white w-12 h-12 shrink-0 rounded-full flex items-center justify-center hover:bg-[#145920] transition-all shadow-lg active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
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
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-50 rounded-[3rem] p-8 lg:p-16 shadow-xl border border-slate-100 flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2 space-y-6">
              <h2 className="text-3xl lg:text-5xl font-black text-[#1a1a1a] tracking-tight">Need help with something?</h2>
            </div>

            <div className="lg:w-1/2 w-full">
              {supportSubmitted ? (
                <div className="bg-[#1a732a] text-white p-12 rounded-[2rem] text-center space-y-4 animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-2xl font-black">Message Sent!</h3>
                  <p className="opacity-80 font-medium">We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      required
                      value={supportData.name}
                      onChange={e => setSupportData({...supportData, name: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#1a732a] focus:border-transparent transition-all outline-none font-medium" 
                    />
                    <input 
                      type="email" 
                      placeholder="Your Email" 
                      required
                      value={supportData.email}
                      onChange={e => setSupportData({...supportData, email: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#1a732a] focus:border-transparent transition-all outline-none font-medium" 
                    />
                  </div>
                  <textarea 
                    placeholder="How can we help you?" 
                    required
                    rows={4}
                    value={supportData.message}
                    onChange={e => setSupportData({...supportData, message: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#1a732a] focus:border-transparent transition-all outline-none font-medium resize-none"
                  ></textarea>
                  <button 
                    type="submit"
                    className="w-full bg-[#1a1a1a] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-[0.98]"
                  >
                    Send Message
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
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="text-[14px] font-bold text-white/75 hover:text-white transition-colors">Contact Us</a></li>
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
      />
    </div>
  );
};



export default LandingPage;

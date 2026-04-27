
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../core/config';

const VerifyEmail: React.FC = () => {
    const location = useLocation();
    const email = (location.state as any)?.email || 'your email';

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
            {/* Logo */}
            <div className="mb-10 flex justify-center">
                {APP_CONFIG.name === 'VSEFA' ? (
                    <svg viewBox="0 0 300 100" className="w-[140px] md:w-[200px] h-auto drop-shadow-lg">
                        <defs>
                            <linearGradient id="logoGradientVerify" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#001736" />
                                <stop offset="100%" stopColor="#22C1EB" />
                            </linearGradient>
                        </defs>
                        <path d="M20,20 L50,80 L80,20" fill="none" stroke="url(#logoGradientVerify)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M130,25 C130,25 100,20 100,40 C100,60 130,60 130,80 C130,100 100,95 100,95" fill="none" stroke="url(#logoGradientVerify)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M150,20 L190,20 M150,50 L180,50 M150,80 L190,80 M150,20 L150,80" fill="none" stroke="url(#logoGradientVerify)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M210,20 L250,20 M210,50 L240,50 M210,20 L210,80" fill="none" stroke="url(#logoGradientVerify)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M260,80 L280,20 L300,80 M265,60 L295,60" fill="none" stroke="url(#logoGradientVerify)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 80 100" className="w-[45px] md:w-[60px] h-auto drop-shadow-lg">
                        <defs>
                            <linearGradient id="sGradientVerify" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#001736" />
                                <stop offset="100%" stopColor="#22C1EB" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M58,18 C58,18 50,8 35,8 C20,8 10,18 10,28 C10,42 28,46 40,50 C52,54 68,58 68,74 C68,86 56,94 40,94 C24,94 14,86 14,86"
                            fill="none"
                            stroke="url(#sGradientVerify)"
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </div>

            {/* Verification Message */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-envelope text-2xl sm:text-3xl text-primary-600"></i>
                </div>

                <h1 className="text-2xl sm:text-[28px] font-black text-[#001736] mb-3">Verify Your Email</h1>

                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-2">
                    We have sent a verification email to
                </p>
                <p className="text-[#001736] font-black text-sm mb-4 break-all">
                    {email}
                </p>

                <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 text-left animate-pulse">
                    <p className="text-red-700 font-bold text-xs flex items-center mb-1">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        IMPORTANT: CHECK YOUR SPAM FOLDER
                    </p>
                    <p className="text-red-600/80 text-[11px] font-medium leading-relaxed">
                        Verification emails often land in the <strong>Spam</strong> or <strong>Junk</strong> folder rather than the Inbox. Please check there first before trying to resend.
                    </p>
                </div>

                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-10 text-center">
                    Please check your email and click the verification link. Once verified, you can sign in to your mission control.
                </p>

                <Link
                    to="/login"
                    className="inline-flex items-center justify-center w-full bg-[#001736] text-white py-4 rounded-xl font-bold text-[13px] tracking-[0.2em] uppercase hover:bg-slate-900 transition-all shadow-xl shadow-slate-200"
                >
                    <i className="fas fa-sign-in-alt mr-3"></i>
                    Sign In Now
                </Link>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <p className="text-slate-400 text-[11px] font-medium mb-3">
                        Didn't receive the email?
                    </p>
                    <Link
                        to="/login"
                        className="text-primary-600 font-black text-xs uppercase tracking-widest hover:underline flex items-center justify-center"
                    >
                        <i className="fas fa-sync-alt mr-2 text-[10px]"></i>
                        Resend Verification Link
                    </Link>
                    <p className="mt-2 text-[9px] text-slate-400 font-medium italic">
                        (Simply attempt to log in to trigger a new link)
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;

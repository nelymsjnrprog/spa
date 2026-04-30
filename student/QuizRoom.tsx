import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Card } from '../ui/Layout';
import { quizService } from '../services/quizService';
import { questionService } from '../services/questionService';
import { submissionService } from '../services/submissionService';
import { Quiz, Question, Submission } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { APP_CONFIG } from '../core/config';


// Deterministic shuffling for consistent experience per student
const seededShuffle = (array: any[], seed: string) => {
  let m = array.length, t, i;
  let seedNum = 0;
  for (let j = 0; j < seed.length; j++) {
    seedNum += seed.charCodeAt(j);
  }
  
  // Use a simple seed-based random generator
  const random = () => {
    seedNum = (seedNum * 9301 + 49297) % 233280;
    return seedNum / 233280;
  };

  const newArray = [...array];
  while (m) {
    i = Math.floor(random() * m--);
    t = newArray[m];
    newArray[m] = newArray[i];
    newArray[i] = t;
  }
  return newArray;
};

const QuizRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockInput, setLockInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lockError, setLockError] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isContentBlurred, setIsContentBlurred] = useState(false);
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(false);

  type SecurityStatus = 'none' | 'fullscreen_missing' | 'violation_detected' | 'tab_switch_alert';
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>('none');
  const isTransitioningRef = useRef(false);
  const transitionTimeoutRef = useRef<any>(null);

  // New layout states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [gridPage, setGridPage] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const ITEMS_PER_PAGE = 50;

  const timerRef = useRef<any>(null);

  const [watermarkPos, setWatermarkPos] = useState({ top: '10%', left: '10%' });
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const unsubSubRef = useRef<(() => void) | null>(null);

  // Live monitor states
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [timeExtension, setTimeExtension] = useState(0);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const clearTransition = () => {
    isTransitioningRef.current = false;
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
  };

  const startTransitionGrace = () => {
    isTransitioningRef.current = true;
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
    }, 2000); // 2s grace for OS/Browser transitions
  };

  // SECURITY ENFORCEMENT
  useEffect(() => {
    if (!examStarted || !quiz) return;

    // 1. Block Context Menu (Right Click) - Desktop Only
    const handleContextMenu = (e: MouseEvent) => {
      if (quiz.disableRightClick && !isMobile) {
        e.preventDefault();
      }
    };

    // 2. Block Copy, Paste, Cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      if (quiz.restrictCopyPaste) {
        e.preventDefault();
        alert("Security Alert: Copy, Paste, and Cut operations are restricted during this examination.");
      }
    };

    // 3. Tab Switch Detection & Blur
    const handleVisibilityChange = () => {
      if (isTransitioningRef.current) return;
      
      if (document.hidden) {
        if (quiz.restrictTabSwitch) {
          const newViolationsCount = violations + 1;
          setViolations(newViolationsCount);
          setSecurityStatus('tab_switch_alert');
          if (submissionId) {
            submissionService.logViolation(submissionId, newViolationsCount).catch(console.error);
          }
        }
        if (quiz.blurOnTabLeave || quiz.restrictScreenshot) {
          setIsContentBlurred(true);
        }
      }
    };

    const handleBlur = () => {
      if (isTransitioningRef.current || document.hidden) return;

      if (quiz.restrictTabSwitch) {
        const newViolationsCount = violations + 1;
        setViolations(newViolationsCount);
        setSecurityStatus('tab_switch_alert');
        if (submissionId) {
          submissionService.logViolation(submissionId, newViolationsCount).catch(console.error);
        }
      }
      if (quiz.blurOnTabLeave || quiz.restrictScreenshot) {
        setIsContentBlurred(true);
      }
    };

    const handleFocus = () => {
      setIsContentBlurred(false);
    };

    // 4. Fullscreen Enforcement
    const handleFullscreenChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      
      // If we are in fullscreen, we should always clear the fullscreen_missing state
      // regardless of the transition status, so the user isn't stuck behind the overlay.
      if (isFull) {
        setSecurityStatus(prev => (prev === 'fullscreen_missing' ? 'none' : prev));
        return;
      }

      // Only ignore fullscreen EXIT during transition
      if (isTransitioningRef.current) return;

      if (quiz.enforceFullscreen && !isFull && !document.hidden) {
        setSecurityStatus('fullscreen_missing');
      }
    };

    // 4.5 Screenshot Blocker (Desktop Only)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMobile && quiz.restrictScreenshot) {
        if (
          e.key === 'PrintScreen' ||
          (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) ||
          (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5'))
        ) {
          setIsContentBlurred(true);
          setShowScreenshotOverlay(true);
          setTimeout(() => {
            setIsContentBlurred(false);
            setShowScreenshotOverlay(false);
          }, 3000);
          if (e.key !== 'PrintScreen') e.preventDefault();
        }
      }
    };

    // Add Listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    // Initial check on mount/start
    if (quiz.enforceFullscreen && !document.fullscreenElement && !isTransitioningRef.current) {
      setSecurityStatus('fullscreen_missing');
    }

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [examStarted, quiz, isMobile, submissionId, violations]);

  // Presence Ping
  useEffect(() => {
    if (examStarted && submissionId && quiz?.status === 'active') {
      // Immediate ping on setup
      submissionService.updatePresence(submissionId, currentIndex).catch(console.error);

      const interval = setInterval(() => {
        submissionService.updatePresence(submissionId, currentIndex).catch(console.error);
      }, 20000); // every 20s
      return () => clearInterval(interval);
    }
  }, [examStarted, submissionId, currentIndex, quiz?.status]);

  const requestFullscreen = async () => {
    const elem = document.getElementById('secure-exam-container') as any;
    if (!elem) {
      // If the element doesn't exist yet (e.g. just started), 
      // we shouldn't start the grace period yet.
      return;
    }
    
    startTransitionGrace();
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE11 */
        await elem.msRequestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
      // If it fails, we should clear the transition so the UI can react
      clearTransition();
    }
  };

  useEffect(() => {
    if (id && profile) {
      initialCheck(id, profile.uid);
    }
  }, [id, profile]);

  useEffect(() => {
    if (examStarted && quiz && sessionStartTime > 0 && !isTimeUp && quiz.status === 'active') {
      timerRef.current = setInterval(() => {
        // Recalculate based on absolute time to prevent drift and easily handle time extensions
        const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
        const totalSec = (quiz.timeLimit + timeExtension) * 60;
        const newTimeLeft = Math.max(0, totalSec - elapsedSec);

        setTimeLeft(newTimeLeft);

        if (newTimeLeft <= 0) {
          clearInterval(timerRef.current!);
          setIsTimeUp(true);
          setTimeout(() => {
            handleFinalSubmit(true);
          }, 3000);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examStarted, sessionStartTime, isTimeUp, quiz?.timeLimit, timeExtension, quiz?.status]);

  const initialCheck = async (quizId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Real-time subscription for quiz updates
      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = quizService.subscribeToQuiz(quizId, (qz) => {
        if (!qz || !qz.published) {
          if (examStartedRef.current && !submittingRef.current) {
            // Exam was in progress — force-submit and flag as stopped by admin
            handleFinalSubmit(true, true);
          } else {
            setError("This examination module is not currently available for students.");
            setExamStarted(false);
          }
          return;
        }
        setQuiz(qz);

        // Auto-submit if admin ends the quiz
        if (qz.status === 'completed' && examStartedRef.current && !submittingRef.current) {
          handleFinalSubmit(true);
        }

        // Show announcement if present
        if (qz.announcement && qz.announcement !== lastAnnouncementRef.current) {
          lastAnnouncementRef.current = qz.announcement;
          if (qz.announcement.trim()) {
            alert(`📢 ADMIN ANNOUNCEMENT:\n\n${qz.announcement}`); // Simple alert for high visibility
          }
        }
      });

      // One-time fetch for questions and submission logic
      let qz = await quizService.getQuiz(quizId);
      if (!qz || !qz.published) {
        setError("This examination module is not currently available for students.");
        return;
      }

      let qs = await questionService.getQuestionsByQuiz(quizId);
      let existingSub = await submissionService.getSubmission(quizId, userId);

      if (existingSub?.status === 'completed') {
        navigate(`/student/results/${existingSub.id}`);
        return;
      }

      if (qz.shuffleQuestions) {
        setQuestions(seededShuffle(qs, userId + quizId));
      } else {
        setQuestions(qs);
      }

      if (existingSub?.status === 'active') {
        setSubmissionId(existingSub.id);
        setAnswers(existingSub.answers || {});
        const startedAt = existingSub.createdAt || existingSub.startedAt || Date.now();
        setSessionStartTime(startedAt);
        setTimeExtension(existingSub.timeExtension || 0);

        const totalSec = (qz.timeLimit + (existingSub.timeExtension || 0)) * 60;
        const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, totalSec - elapsedSec);

        setTimeLeft(remaining);
        setExamStarted(true);
        setIsUnlocked(true);
        setCurrentIndex(existingSub.currentQuestionIndex || 0);

        // Subscribe to submission for real-time time extensions
        if (unsubSubRef.current) unsubSubRef.current();
        unsubSubRef.current = submissionService.subscribeToSubmission(existingSub.id, (sub) => {
          if (sub) {
            setTimeExtension(sub.timeExtension || 0);
          }
        });
      } else {
        setTimeLeft(qz.timeLimit * 60);
        if (!qz.lockCode) setIsUnlocked(true);
      }
    } catch (err: any) {
      console.error("Initial Check Error:", err);
      setError(err.message || "Security Validation Failed: Unable to verify your examination authorization.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (unsubSubRef.current) unsubSubRef.current();
    };
  }, []);

  // Refs for callbacks
  const examStartedRef = useRef(examStarted);
  const submittingRef = useRef(submitting);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);
  const lastAnnouncementRef = useRef('');
  const quizRef = useRef<Quiz | null>(quiz);
  const submissionIdRef = useRef<string | null>(submissionId);
  const profileRef = useRef(profile);

  useEffect(() => {
    examStartedRef.current = examStarted;
    submittingRef.current = submitting;
    answersRef.current = answers;
    questionsRef.current = questions;
    quizRef.current = quiz;
    submissionIdRef.current = submissionId;
    profileRef.current = profile;
  }, [examStarted, submitting, answers, questions, quiz, submissionId, profile]);

  const startExam = async () => {
    if (!quiz || !profile) return;
    const inputCode = lockInput.trim().toUpperCase();
    const targetCode = (quiz.lockCode || '').trim().toUpperCase();

    if (quiz.lockCode && inputCode !== targetCode) {
      setLockError(true);
      return;
    }

    setStarting(true);
    const now = Date.now();
    
    let totalPossibleMarks = 0;
    questions.forEach(q => {
      totalPossibleMarks += (quiz.defaultMarkPerQuestion || 1);
    });

    try {
      const id = await submissionService.createSubmission({
        quizId: quiz.id,
        studentId: profile.uid,
        studentName: profile.displayName,
        studentLevel: profile.level || '',
        studentInstitution: profile.institution || '',
        score: 0,
        totalPossible: totalPossibleMarks,
        startedAt: now,
        completedAt: 0,
        answers: {},
        status: 'active'
      } as any);
      setSubmissionId(id);
      setSessionStartTime(now);

      // Subscribe to submission for real-time time extensions
      if (unsubSubRef.current) unsubSubRef.current();
      unsubSubRef.current = submissionService.subscribeToSubmission(id, (sub) => {
        if (sub) {
          setTimeExtension(sub.timeExtension || 0);
        }
      });

      setExamStarted(true);
      if (quiz.enforceFullscreen) {
        requestFullscreen();
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize examination session.");
    } finally {
      setStarting(false);
    }
  };

  const handleSelect = async (questionId: string, optionIdx: number) => {
    if (!examStarted || submitting || isTimeUp) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
    if (submissionId) {
      submissionService.autosaveAnswer(submissionId, questionId, optionIdx).catch(console.error);
    }
  };

  const handleClearChoice = async (questionId: string) => {
    if (!examStarted || submitting || isTimeUp) return;
    setAnswers(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    if (submissionId) {
      submissionService.clearAnswer(submissionId, questionId).catch(console.error);
    }
  };

  const navigateToNextFlag = () => {
    if (flags.size === 0) return;
    const flaggedIndices = questions
      .map((q, i) => flags.has(q.id) ? i : -1)
      .filter(i => i !== -1);

    if (flaggedIndices.length === 0) return;

    const nextIndex = flaggedIndices.find(i => i > currentIndex);
    if (nextIndex !== undefined) {
      setCurrentIndex(nextIndex);
    } else {
      // Wrap around
      setCurrentIndex(flaggedIndices[0]);
    }
  };

  const toggleFlag = (questionId: string) => {
    setFlags(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleFinalSubmit = async (isAuto = false, stoppedByAdmin = false) => {
    const currentQuiz = quizRef.current;
    const currentProfile = profileRef.current;
    const currentSubmissionId = submissionIdRef.current || submissionId;
    
    if (!currentQuiz || !currentProfile || !currentSubmissionId || submittingRef.current) {
      if (!isAuto && !submittingRef.current && !currentSubmissionId) {
        console.error("Submission failed: Missing Submission ID");
        alert("Session error: Please refresh the page to finalize your submission.");
      }
      return;
    }

    submittingRef.current = true; // Immediate guard
    
    const currentQuestions = questionsRef.current;
    const currentAnswers = answersRef.current;
    const currentNumAnswered = Object.keys(currentAnswers).length;

    const requiredPercent = currentQuiz.minSubmissionPercentage || 0;
    const percentAnswered = currentQuestions.length > 0 ? (currentNumAnswered / currentQuestions.length) * 100 : 100;
    let isIncompleteAttempt = false;

    if (!isAuto) {
      if (percentAnswered < requiredPercent) {
        alert(`ACCESS DENIED: You must answer at least ${requiredPercent}% of the questions before submitting.\nYou have only answered ${Math.round(percentAnswered)}%.`);
        submittingRef.current = false;
        return;
      }

      const unansweredCount = currentQuestions.length - currentNumAnswered;
      const warningMessage = unansweredCount > 0
        ? `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Are you sure you want to finalize your submission? This action is permanent.`
        : "Are you sure you want to finalize your submission? This action is permanent.";

      const confirmed = window.confirm(warningMessage);
      if (!confirmed) {
        submittingRef.current = false;
        return;
      }
    } else {
      if (percentAnswered < requiredPercent) {
        isIncompleteAttempt = true;
      }
    }

    setSubmitting(true);
    let score = 0;
    let correctCount = 0;
    currentQuestions.forEach(q => {
      if (currentAnswers[q.id] === q.correctOptionIndex) {
        correctCount++;
        score += (currentQuiz.defaultMarkPerQuestion || 1);
      }
    });

    try {
      await submissionService.finalSubmit(currentSubmissionId, score, isIncompleteAttempt, correctCount, currentQuestions.length, stoppedByAdmin);
      navigate(`/student/results/${currentSubmissionId}`);
    } catch (err: any) {
      console.error("Submission Error:", err);
      alert("Final submission failed. Please check your internet connection.");
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronizing Module Vault...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-10 text-center shadow-2xl border-none">
        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-shield-virus text-3xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">{error}</p>
        <Link to="/student" className="block w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-primary-600 transition">Return to Dashboard</Link>
      </Card>
    </div>
  );

  const currentQuestion = questions[currentIndex];
  const numAnswered = Object.keys(answers).length;
  const timerColor = timeLeft < 120 ? 'text-red-600 bg-red-50' : timeLeft < 300 ? 'text-amber-600 bg-amber-50' : 'text-slate-900 bg-slate-100';

  // Pagination Logic
  const qPerPage = quiz?.questionsPerPage || 1;
  const effectiveQPerPage = qPerPage === 0 ? questions.length : qPerPage;
  const totalPages = Math.ceil(questions.length / effectiveQPerPage);
  const currentPage = Math.floor(currentIndex / effectiveQPerPage);
  const startIdx = currentPage * effectiveQPerPage;
  const endIdx = Math.min(startIdx + effectiveQPerPage, questions.length);
  const pageQuestions = questions.slice(startIdx, endIdx);

  const scrollMainToTop = () => {
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextPage = () => {
    const nextIdx = Math.min((currentPage + 1) * effectiveQPerPage, questions.length - 1);
    setCurrentIndex(nextIdx);
    scrollMainToTop();
    if (submissionId) {
      submissionService.updatePresence(submissionId, nextIdx).catch(console.error);
    }
  };

  const handlePrevPage = () => {
    const prevIdx = Math.max((currentPage - 1) * effectiveQPerPage, 0);
    setCurrentIndex(prevIdx);
    scrollMainToTop();
    if (submissionId) {
      submissionService.updatePresence(submissionId, prevIdx).catch(console.error);
    }
  };

  // Grid pagination
  const startIndex = gridPage * ITEMS_PER_PAGE;
  const gridQuestions = questions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const navigateToQuestion = (actualIdx: number) => {
    setCurrentIndex(actualIdx);
    setIsMobileMenuOpen(false);
    
    // Slight delay to allow React's DOM renderer to mount the new page of items if there is pagination
    setTimeout(() => {
      const el = document.getElementById(`question-${actualIdx}`);
      const mainEl = document.querySelector('main');
      
      if (el) {
        // Option 1: Try smooth manual offset scrolling for main container
        if (mainEl && typeof mainEl.scrollTo === 'function') {
           // Find total offset top relative to main
           let offsetTop = 0;
           let currentEl: HTMLElement | null = el;
           while (currentEl && currentEl !== mainEl) {
               offsetTop += currentEl.offsetTop;
               currentEl = currentEl.offsetParent as HTMLElement;
           }
           
           try {
             mainEl.scrollTo({ top: offsetTop - 40, behavior: 'smooth' });
             return; // Stop if it worked
           } catch(e) { /* fallback */ }
        }
        
        // Option 2: Pure immediate fallback for older WebViews that completely reject modern scroll objects
        el.scrollIntoView();
      }
    }, 150);
  };



  return (
    <div id="secure-exam-container" className="min-h-screen bg-slate-900 overflow-hidden relative">
      {!examStarted ? (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <Card className="max-w-xl w-full p-6 sm:p-12 text-center bg-white shadow-2xl relative overflow-hidden border-none text-slate-900 font-sans">
            <div className="absolute top-0 left-0 w-full h-2 bg-primary-600"></div>
            {quiz?.lockCode && !isUnlocked ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-amber-100">
                  <i className="fas fa-lock text-3xl"></i>
                </div>
                <h1 className="text-3xl font-bold mb-2">Examination Locked</h1>
                <p className="text-slate-500 mb-8">This module is protected. Please enter the authorization code.</p>
                <div className="mb-8">
                  <input
                    type="text"
                    value={lockInput}
                    onChange={(e) => { setLockInput(e.target.value); setLockError(false); }}
                    placeholder="Enter Access Code"
                    className={`w-full p-5 text-center text-2xl font-black tracking-[0.5em] uppercase border-2 rounded-2xl outline-none transition-all ${lockError ? 'border-red-500 bg-red-50 text-red-900 animate-shake' : 'border-slate-100 bg-slate-50 focus:border-primary-500'}`}
                  />
                  {lockError && <p className="text-red-500 text-xs font-bold mt-3 uppercase tracking-widest">Invalid Code</p>}
                </div>
                <button
                  onClick={() => {
                    const inputCode = lockInput.trim().toUpperCase();
                    const targetCode = (quiz?.lockCode || '').trim().toUpperCase();
                    if (inputCode === targetCode) {
                      setIsUnlocked(true);
                    } else {
                      setLockError(true);
                    }
                  }}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-primary-600 transition-all shadow-xl"
                >
                  Verify Access
                </button>
                <Link to="/student" className="block mt-6 text-slate-400 font-bold text-sm">Cancel</Link>
              </div>
            ) : (
              <>
                {quiz?.subjectTitle && (
                  <p className="text-xs font-black text-primary-600 uppercase tracking-[0.2em] mb-3">{quiz.subjectTitle}</p>
                )}
                <h1 className="text-3xl font-bold mb-4">{quiz?.title}</h1>
                <p className="text-slate-600 mb-8 leading-relaxed text-sm lg:text-base">{quiz?.description}</p>
                <div className="bg-slate-50 p-6 rounded-2xl mb-8 grid grid-cols-2 gap-4">
                  <div className="text-center border-r border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time Limit</p>
                    <p className="text-2xl font-black">{quiz?.timeLimit} Min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Questions</p>
                    <p className="text-2xl font-black">{questions.length}</p>
                  </div>
                </div>
                <button onClick={startExam} disabled={starting} className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-primary-700 transition shadow-xl disabled:opacity-50">
                  {starting ? 'Initializing...' : 'Begin Examination'}
                </button>
              </>
            )}
          </Card>
        </div>
      ) : (
        <div className={`h-screen h-[100dvh] bg-slate-50 flex flex-col lg:flex-row overflow-hidden relative selection:bg-primary-100 ${quiz?.disableTextSelection ? 'disable-selection' : ''}`}>

      {/* Unified Security Overlays */}
      {/* EXAM PAUSED OVERLAY */}
      {examStarted && quiz?.status === 'paused' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
          <div className="text-center p-8 max-w-lg">
            <div className="w-24 h-24 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-pause text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-white mb-4">Exam Paused</h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              The administrator has temporarily paused the examination. Your timer is suspended. Please wait for further instructions.
            </p>
          </div>
        </div>
      )}

      {/* MOBILE HEADER */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-2 pt-[calc(0.5rem+env(safe-area-inset-top))] flex flex-col space-y-1.5 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-primary-600 font-black text-base tracking-tighter uppercase">{quiz?.subjectTitle || 'Examination'}</span>
            <div className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono ${timerColor}`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-right hidden sm:block">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Progress</p>
              <p className="text-[10px] font-bold text-primary-600">{numAnswered}/{questions.length}</p>
            </div>
          </div>
        </div>

        {/* MOBILE PROGRESS BAR */}
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-500"
            style={{ width: `${(numAnswered / questions.length) * 100}%` }}
          />
        </div>
      </header>



      {/* LEFT PANEL (Desktop) */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-white border-r border-slate-200 flex-col z-20">
        <div className="p-6 border-b border-slate-100">
          <span className="text-primary-600 font-black text-2xl tracking-tighter uppercase">{quiz?.subjectTitle || 'Examination'}</span>
          <div className="mt-4">
            <h2 className="font-bold text-slate-900 leading-tight truncate">{quiz?.title}</h2>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Active Session</p>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col overflow-y-auto">
          {/* Timer Section */}
          <div className={`p-6 rounded-2xl text-center mb-8 border-2 transition-colors ${timerColor} border-transparent`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Time Remaining</p>
            <p className="text-4xl font-black font-mono">{formatTime(timeLeft)}</p>
          </div>

          {/* Progress Section */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</p>
              <p className="text-xs font-bold text-primary-600">{numAnswered}/{questions.length}</p>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-primary-600 transition-all duration-500"
                style={{ width: `${(numAnswered / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-50">
          </div>
        </div>
      </aside>

      {/* CENTER ZONE */}
      <main className="flex-1 flex flex-col relative overflow-y-auto w-full">
        <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-12 flex-1 flex flex-col pb-32 lg:pb-12">
          {pageQuestions.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex-1 flex flex-col">
              {pageQuestions.map((q, pIdx) => (
                <Card key={q.id} id={`question-${startIdx + pIdx}`} className="p-4 lg:p-5 border-none shadow-xl shadow-slate-200 relative overflow-hidden mb-6 lg:mb-8">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-primary-500/20"></div>

                  <button
                    onClick={() => toggleFlag(q.id)}
                    className={`absolute top-4 right-4 lg:top-8 lg:right-8 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${flags.has(q.id) ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-50 text-slate-300 hover:text-red-400'}`}
                    title="Flag for review"
                  >
                    <i className={`fas fa-flag ${flags.has(q.id) ? 'animate-pulse text-sm lg:text-base' : 'text-sm lg:text-base'}`}></i>
                  </button>

                  <div className="mb-6 lg:mb-10 mt-2 lg:mt-0">
                    <span className="text-primary-600 font-black text-[11px] uppercase tracking-widest mb-1 lg:mb-2 block">Question {startIdx + pIdx + 1}</span>
                    <h3 className="text-base lg:text-xl font-bold text-slate-900 leading-snug break-words">
                      {q.text}
                    </h3>

                  </div>

                  <div className="space-y-2 lg:space-y-2.5">
                    {q.options && (() => {
                      const optionIndices = q.options.map((_, idx) => idx);
                      const displayIndices = (quiz?.shuffleOptions && profile) 
                        ? seededShuffle(optionIndices, profile.uid + q.id) 
                        : optionIndices;

                      return displayIndices.map((originalIdx, i) => {
                        const opt = q.options[originalIdx];
                        const isSelected = answers[q.id] === originalIdx;
                        const label = String.fromCharCode(65 + i);

                        return (
                          <button
                            key={i}
                            onClick={() => handleSelect(q.id, originalIdx)}
                            className={`w-full p-3 lg:p-3.5 text-left rounded-xl lg:rounded-2xl border-2 transition-all flex items-center gap-3 group relative overflow-hidden ${
                              isSelected 
                                ? 'bg-primary-600 border-primary-600 text-white shadow-2xl shadow-primary-200 -translate-y-0.5' 
                                : 'bg-white border-slate-100 hover:border-primary-200 text-slate-700 hover:shadow-lg'
                            }`}
                            title={`Select option ${label}: ${opt}`}
                          >
                            <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] border-2 transition-colors ${
                              isSelected ? 'bg-white/20 border-white text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:text-primary-600 group-hover:bg-primary-50'
                            }`}>
                              {label}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-sm lg:text-[15px] font-medium leading-snug">{opt || `Option ${label}`}</p>

                            </div>

                            <div className={`w-4 h-4 lg:w-5 lg:h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'border-white bg-white' : 'border-slate-200 group-hover:border-primary-300'
                            }`}>
                              {isSelected && <i className="fas fa-check text-[8px] text-primary-600"></i>}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {answers[q.id] !== undefined && (
                    <div className="flex justify-start">
                      <button 
                        onClick={() => handleClearChoice(q.id)}
                        className="mt-4 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center group"
                      >
                        <i className="fas fa-eraser mr-2 opacity-50 group-hover:opacity-100"></i>
                        Clear my choice
                      </button>
                    </div>
                  )}
                </Card>
              ))}

              {/* STICKY BOTTOM NAVIGATION */}
              <div className="fixed bottom-0 left-0 lg:left-64 lg:right-72 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 lg:p-6 z-40 flex flex-row justify-between items-center gap-3">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  className="flex-1 lg:flex-none lg:w-48 px-4 lg:px-8 py-4 lg:py-5 rounded-xl lg:rounded-2xl bg-white border-2 border-slate-100 text-slate-900 font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-20 transition-all flex items-center justify-center space-x-3 shadow-sm active:scale-95"
                  title="Previous Page"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                  <span className="text-xs lg:text-sm">Previous</span>
                </button>

                <div className="hidden lg:flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Page</span>
                  <span className="text-sm font-black text-slate-900">{currentPage + 1} / {totalPages}</span>
                </div>

                <div className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {currentPage + 1} / {totalPages}
                </div>

                {currentPage === totalPages - 1 ? (
                  <button
                    onClick={() => handleFinalSubmit(false)}
                    disabled={submitting}
                    className="flex-1 lg:flex-none lg:w-48 px-4 lg:px-8 py-4 lg:py-5 rounded-xl lg:rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-20 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center space-x-3 active:scale-95"
                  >
                    <span className="text-xs lg:text-sm">Finish</span>
                    <i className="fas fa-check-circle text-xs"></i>
                  </button>
                ) : (
                  <button
                    onClick={handleNextPage}
                    className="flex-1 lg:flex-none lg:w-48 px-4 lg:px-8 py-4 lg:py-5 rounded-xl lg:rounded-2xl bg-primary-600 text-white font-black uppercase tracking-widest hover:bg-primary-700 disabled:opacity-20 transition-all shadow-xl shadow-primary-200 flex items-center justify-center space-x-3 active:scale-95"
                  >
                    <span className="text-xs lg:text-sm">Next</span>
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic">No questions available in this chunk.</div>
          )}
        </div>
      </main>

      {/* RIGHT PANEL (Desktop) */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 bg-white border-l border-slate-200 flex-col z-20">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Exam Grid</h3>
          <span className="text-[10px] text-slate-400 font-bold">Page {gridPage + 1} of {Math.ceil(questions.length / ITEMS_PER_PAGE)}</span>
        </div>

        <div className="flex-1 p-4 grid grid-cols-5 gap-2 content-start overflow-y-auto">
          {gridQuestions.map((q, idx) => {
            const actualIdx = startIndex + idx;
            const isCurrent = actualIdx === currentIndex;
            const isAnswered = answers[q.id] !== undefined;
            const isFlagged = flags.has(q.id);

            return (
              <button
                key={q.id}
                onClick={() => navigateToQuestion(actualIdx)}
                className={`
                     relative h-10 rounded-lg text-xs font-black transition-all flex items-center justify-center border-2
                     ${isCurrent ? 'border-primary-600 scale-110 z-10 shadow-md ring-4 ring-primary-50' : 'border-transparent'}
                     ${!isAnswered && !isCurrent ? 'bg-slate-50 text-slate-400 border-slate-100' : ''}
                     ${isAnswered ? 'bg-green-600 text-white shadow-inner border-green-700' : ''}
                   `}
              >
                {actualIdx + 1}
                {isFlagged && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setGridPage(p => Math.max(0, p - 1))}
            disabled={gridPage === 0}
            className="p-2 text-slate-400 hover:text-primary-600 disabled:opacity-20"
            title="Previous page"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary-600"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
          </div>
          <button
            onClick={() => setGridPage(p => Math.min(Math.ceil(questions.length / ITEMS_PER_PAGE) - 1, p + 1))}
            disabled={gridPage >= Math.ceil(questions.length / ITEMS_PER_PAGE) - 1}
            className="p-2 text-slate-400 hover:text-primary-600 disabled:opacity-20"
            title="Next page"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </aside>

      {/* MOBILE GRID TOGGLE BUTTON */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed left-0 top-[30%] -translate-y-1/2 z-[40] w-10 h-16 bg-white/90 backdrop-blur-md border border-l-0 border-slate-200 rounded-r-2xl flex items-center justify-center text-primary-600 shadow-xl active:scale-90 transition-all shadow-primary-500/10 group"
        title="Open Question Grid"
      >
        <i className="fas fa-bars text-sm group-hover:translate-x-0.5 transition-transform"></i>
      </button>

      {/* MOBILE FLAG NAVIGATION ARROW */}
      {flags.size > 0 && (
        <button
          onClick={navigateToNextFlag}
          className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[40] w-12 h-20 bg-white/90 backdrop-blur-md border border-l-0 border-slate-200 rounded-r-3xl flex items-center justify-center text-primary-600 shadow-xl active:scale-90 transition-all group"
          title="Jump to next flagged question"
        >
          <div className="flex flex-col items-center">
            <i className="fas fa-chevron-right text-xl group-hover:translate-x-1 transition-transform"></i>
            <span className="text-[8px] font-black uppercase mt-1 opacity-60">Flags</span>
          </div>
        </button>
      )}

      {/* BACKDROP FOR MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[55] bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* MOBILE MENU / GRID OVERLAY (Side Drawer) */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-[60] w-[85%] max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Question Grid</h3>
          <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900" title="Close navigator">
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-5 gap-2 content-start">
            {gridQuestions.map((q, idx) => {
              const actualIdx = startIndex + idx;
              const isCurrent = actualIdx === currentIndex;
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = flags.has(q.id);

              return (
                <button
                  key={q.id}
                  onClick={() => navigateToQuestion(actualIdx)}
                  className={`
                       relative h-12 rounded-xl text-xs font-black transition-all flex items-center justify-center border-2
                       ${isCurrent ? 'border-primary-600 scale-105 z-10 shadow-md ring-4 ring-primary-50' : 'border-transparent'}
                       ${!isAnswered && !isCurrent ? 'bg-slate-50 text-slate-400 border-slate-100' : ''}
                       ${isAnswered ? 'bg-green-600 text-white shadow-inner border-green-700' : ''}
                     `}
                >
                  {actualIdx + 1}
                  {isFlagged && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setGridPage(p => Math.max(0, p - 1))}
            disabled={gridPage === 0}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-30 disabled:hover:border-slate-200 transition-all font-bold flex items-center justify-center shadow-sm"
            title="Previous Page"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex flex-col items-center">
            <span>Page</span>
            <span className="text-slate-700">{gridPage + 1} / {Math.ceil(questions.length / ITEMS_PER_PAGE)}</span>
          </span>
          <button
            onClick={() => setGridPage(p => Math.min(Math.ceil(questions.length / ITEMS_PER_PAGE) - 1, p + 1))}
            disabled={gridPage >= Math.ceil(questions.length / ITEMS_PER_PAGE) - 1}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-30 disabled:hover:border-slate-200 transition-all font-bold flex items-center justify-center shadow-sm"
            title="Next Page"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Unified Security Overlays */}
      {examStarted && !isTimeUp && (
        <>
          {/* 1. Fullscreen Required Overlay */}
          {securityStatus === 'fullscreen_missing' && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900 backdrop-blur-3xl transition-all duration-500">
              <div className="max-w-md w-full p-8 lg:p-12 text-center text-white animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary-600 text-white rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-center mx-auto mb-8 lg:mb-10 shadow-3xl shadow-primary-500/20 rotate-12">
                  <i className="fas fa-expand-wide text-3xl lg:text-4xl"></i>
                </div>
                <h2 className="text-3xl lg:text-4xl font-black mb-4 lg:mb-6 tracking-tight">Security Focus Required</h2>
                <p className="text-slate-400 text-base lg:text-lg mb-8 lg:mb-10 leading-relaxed font-medium">
                  Examination protocols require a secure, fullscreen environment to protect integrity.
                  {isMobile && <span className="block mt-4 text-primary-400 font-bold">Tapping below will hide the browser address bar.</span>}
                </p>
                <button
                  onClick={requestFullscreen}
                  className="w-full bg-white text-slate-900 py-4 lg:py-5 rounded-xl lg:rounded-2xl font-black text-base lg:text-lg hover:bg-slate-100 transition-all shadow-xl active:scale-95 flex items-center justify-center space-x-3"
                >
                  <i className="fas fa-desktop"></i>
                  <span>Enter Secure Mode</span>
                </button>
                <p className="mt-6 text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-relaxed">
                  Exit detected on {new Date().toLocaleTimeString()}<br/>
                  Device restricted mode active
                </p>
              </div>
            </div>
          )}

          {/* 2. Tab Switch Violation Alert */}
          {securityStatus === 'tab_switch_alert' && (
            <div className="fixed inset-0 z-[550] flex items-center justify-center bg-red-600/90 backdrop-blur-md animate-in fade-in duration-300">
              <div className="max-w-lg w-full p-8 lg:p-12 text-center text-white">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl animate-pulse">
                  <i className="fas fa-exclamation-triangle text-3xl lg:text-4xl"></i>
                </div>
                <h2 className="text-3xl lg:text-4xl font-black mb-4 uppercase tracking-tighter">Security Alert</h2>
                <p className="text-red-100 text-base lg:text-lg mb-8 font-medium">Navigation away from the examination window has been detected. This violation has been logged.</p>
                <div className="bg-white/10 p-5 rounded-2xl mb-10 border border-white/20 shadow-inner">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-100 mb-1">Violation Count</p>
                  <p className="text-4xl font-black">{violations}</p>
                </div>
                <button
                  onClick={() => setSecurityStatus('none')}
                  className="w-full bg-white text-red-600 py-4 lg:py-5 rounded-xl lg:rounded-2xl font-black text-base lg:text-lg hover:bg-slate-100 transition-all shadow-xl active:scale-95"
                >
                  Acknowledge & Resume
                </button>
              </div>
            </div>
          )}

          {/* 3. Screenshot/Privacy Overlay */}
          {(isContentBlurred || showScreenshotOverlay) && securityStatus === 'none' && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 backdrop-blur-3xl animate-in fade-in duration-200">
              <div className="max-w-xs w-full p-8 text-center text-white">
                <div className="w-16 h-16 bg-slate-800 text-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-slate-700">
                  <i className="fas fa-shield-halved text-2xl"></i>
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {showScreenshotOverlay ? "Capture Blocked" : "Security Guard Active"}
                </h2>
                <p className="text-slate-500 text-[10px] leading-relaxed uppercase tracking-widest font-black">
                  {showScreenshotOverlay ? "Screen capturing is prohibited" : "Confidential Exam Content"}
                </p>
                <p className="mt-4 text-[10px] text-slate-600 font-bold italic">
                  Focus on the examination window. Session activity is being monitored.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Watermark */}
      {examStarted && (quiz?.watermarkEnabled || quiz?.restrictScreenshot) && (
        <div className="fixed inset-0 z-[40] pointer-events-none overflow-hidden select-none opacity-[0.03]">
          {quiz?.movingWatermark ? (
            <div
              className="absolute flex flex-col items-center text-center text-3xl font-black text-slate-900 tracking-tighter uppercase italic transition-all duration-1000"
              style={{ transform: `translate(${watermarkPos.left}, ${watermarkPos.top})` }}
            >
              <div className="leading-none mb-1">{profile?.displayName}</div>
              <div className="text-xl leading-none opacity-80">{profile?.email}</div>
            </div>
          ) : (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-5 gap-y-32 gap-x-20 transform -rotate-45 scale-150">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex flex-col items-start text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                  <div className="leading-none text-center w-full">{profile?.displayName}</div>
                  <div className="text-sm leading-none opacity-70 mt-1 text-center w-full">{profile?.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Time's Up */}
      {isTimeUp && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
          <div className="max-w-md w-full p-12 text-center text-white animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce">
              <i className="fas fa-hourglass-end text-4xl"></i>
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tight">Time Participant</h2>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed">Your examination session has concluded. We are securely synchronizing your final responses...</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};

export default QuizRoom;

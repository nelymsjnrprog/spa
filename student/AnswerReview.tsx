import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { submissionService } from '../services/submissionService';
import { quizService } from '../services/quizService';
import { questionService } from '../services/questionService';
import { Submission, Quiz, Question } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const AnswerReview: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Security States
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });
  const [isContentBlurred, setIsContentBlurred] = useState(false);
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(false);

  useEffect(() => {
    if (!submissionId) return;

    const load = async () => {
      try {
        const sub = await submissionService.getSubmissionById(submissionId);
        if (!sub) { navigate('/student'); return; }

        const [qz, qs] = await Promise.all([
          quizService.getQuiz(sub.quizId),
          questionService.getQuestionsByQuiz(sub.quizId)
        ]);

        // If results are hidden, redirect back
        if (qz?.showResults === false) { navigate(`/student/results/${submissionId}`); return; }

        setSubmission(sub);
        setQuiz(qz);
        setQuestions(qs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [submissionId]);

  // Proctoring logic
  useEffect(() => {
    if (!submission) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopyPaste = (e: ClipboardEvent) => e.preventDefault();
    const handleVisibilityChange = () => {
      if (document.hidden) setIsContentBlurred(true);
    };
    const handleBlur = () => setIsContentBlurred(true);
    const handleFocus = () => setIsContentBlurred(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        setIsContentBlurred(true);
        setShowScreenshotOverlay(true);
        setTimeout(() => {
          setIsContentBlurred(false);
          setShowScreenshotOverlay(false);
        }, 3000);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [submission]);

  // Security: Block Print
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body { display: none !important; }
      }
      .review-blur { filter: blur(40px) grayscale(1); transition: filter 0.3s ease; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Moving Watermark Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 80 + 10)}%`,
        left: `${Math.floor(Math.random() * 70 + 5)}%`,
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-[3px] border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-black text-xs font-black uppercase tracking-widest">Loading Review...</p>
        </div>
      </div>
    );
  }

  if (!submission || !quiz) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-black text-xl"></i>
          </div>
          <p className="text-black font-bold">Results not found.</p>
          <button onClick={() => navigate('/student')} className="mt-4 text-primary-600 font-bold text-sm hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const answers = submission.answers || {};
  const totalQ = questions.length;
  const correctCount = questions.filter(q => answers[q.id] === q.correctOptionIndex).length;
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div className={`min-h-screen bg-slate-100 ${isContentBlurred ? 'review-blur' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm safe-pt">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/student/results/${submissionId}`)}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>

              <p className="text-[10px] font-bold text-black uppercase tracking-widest">{quiz.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{correctCount} correct</span>
            <span className="text-xs font-black text-red-500 bg-red-50 px-2.5 py-1 rounded-full">{totalQ - correctCount} wrong</span>
          </div>
        </div>
      </div>

      {/* Question Cards */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {questions.map((q, idx) => {
          const studentAnswerIdx = answers[q.id];
          const isAnswered = studentAnswerIdx !== undefined && studentAnswerIdx !== null;
          const isCorrect = isAnswered && studentAnswerIdx === q.correctOptionIndex;
          const options = q.options || [];

          return (
            <div
              key={q.id || idx}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              {/* Question Header */}
              <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                  isCorrect
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1">
                    Question {idx + 1} of {totalQ}
                  </p>
                  <p className="text-sm font-bold text-black leading-relaxed">
                    {q.text || 'Question text missing'}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="px-5 pb-5 space-y-2">
                {options.map((option, optIdx) => {
                  const isStudentChoice = isAnswered && studentAnswerIdx === optIdx;
                  const isCorrectOption = q.correctOptionIndex === optIdx;

                  let bgClass = 'bg-slate-50 border-slate-100 text-black';
                  let labelBg = 'bg-slate-200 text-black';
                  let suffix = null;

                  if (isCorrectOption) {
                    bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-900';
                    labelBg = 'bg-emerald-500 text-white';
                    suffix = (
                      <span className="ml-auto shrink-0 text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <i className="fas fa-check-circle"></i> Correct
                      </span>
                    );
                  }

                  if (isStudentChoice && !isCorrect) {
                    bgClass = 'bg-red-50 border-red-200 text-red-900';
                    labelBg = 'bg-red-500 text-white';
                    suffix = (
                      <span className="ml-auto shrink-0 text-[9px] font-black text-red-500 uppercase tracking-wider flex items-center gap-1">
                        <i className="fas fa-times-circle"></i> Your answer
                      </span>
                    );
                  }

                  if (isStudentChoice && isCorrect) {
                    suffix = (
                      <span className="ml-auto shrink-0 text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <i className="fas fa-check-circle"></i> Your answer
                      </span>
                    );
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${bgClass}`}
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${labelBg}`}>
                        {optionLabels[optIdx] || optIdx + 1}
                      </span>
                      <span className="text-sm font-medium flex-1 min-w-0">{option}</span>
                      {suffix}
                    </div>
                  );
                })}

                {!isAnswered && (
                  <div className="flex items-center gap-2 px-4 py-2 text-amber-600 bg-amber-50 rounded-xl border border-amber-100">
                    <i className="fas fa-exclamation-circle text-xs"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest">Not answered</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 pt-4">
        <button
          onClick={() => navigate('/student')}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
        >
          <i className="fas fa-home mr-2"></i>
          Back to Dashboard
        </button>
      </div>

      {/* Security Watermarks */}
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden select-none opacity-[0.05]">
        {/* Moving Watermark */}
        <div
          className="absolute text-2xl font-black whitespace-nowrap text-black tracking-tighter uppercase italic transition-all duration-1000"
          style={{ transform: `translate(${watermarkPos.left}, ${watermarkPos.top})` }}
        >
          {profile?.displayName} • {profile?.email} • {new Date().toLocaleDateString()}
        </div>
        
        {/* Static Grid Watermark */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-20 transform -rotate-45 scale-150">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="text-2xl font-black whitespace-nowrap text-black tracking-tighter uppercase italic opacity-20">
              {profile?.displayName} • {profile?.email} • REVIEW MODE
            </div>
          ))}
        </div>
      </div>

      {/* Security Privacy Guard Overlay */}
      {(isContentBlurred || showScreenshotOverlay) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-3xl animate-in fade-in duration-200">
          <div className="max-w-xs w-full p-8 text-center text-white">
            <div className="w-16 h-16 bg-slate-800 text-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-slate-700">
              <i className="fas fa-shield-halved text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold mb-2">
              {showScreenshotOverlay ? "Capture Blocked" : "Results Protected"}
            </h2>
            <p className="text-black text-[10px] leading-relaxed uppercase tracking-widest font-black">
              {showScreenshotOverlay ? "Screen capturing is prohibited" : "Confidential Result Data"}
            </p>
            <p className="mt-4 text-[10px] text-black font-bold italic">
              Please focus on the review window. Navigation or screen capturing is restricted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerReview;

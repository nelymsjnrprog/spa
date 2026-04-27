import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { submissionService } from '../services/submissionService';
import { quizService } from '../services/quizService';
import { questionService } from '../services/questionService';
import { Submission, Quiz, Question } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const Results: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Security States
  const [isContentBlurred, setIsContentBlurred] = useState(false);
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });

  const loadData = async (sid: string) => {
    try {
      const sub = await submissionService.getSubmissionById(sid);

      if (!sub) {
        navigate('/student');
        return;
      }

      const [qz, qs] = await Promise.all([
        quizService.getQuiz(sub.quizId),
        questionService.getQuestionsByQuiz(sub.quizId)
      ]);

      setSubmission(sub);
      setQuiz(qz);
      setQuestions(qs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      loadData(submissionId);
    }
  }, [submissionId]);

  // proctoring logic
  useEffect(() => {
    if (!submission) return;

    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Block Copy, Paste, Cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 3. Tab Switch Detection & Blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsContentBlurred(true);
      }
    };

    const handleBlur = () => {
      setIsContentBlurred(true);
    };

    const handleFocus = () => {
      setIsContentBlurred(false);
    };

    // 4. Keyboard Protection (PrintScreen, F12, Ctrl+P)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) || // Mac Screenshot
        e.key === 'F12'
      ) {
        if (e.key !== 'F12') e.preventDefault();
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

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Authenticating Results...</p>
      </div>
    </div>
  );

  if (!submission) return <div className="p-12 text-center text-slate-500 italic">Official results not found.</div>;

  const displayCorrectCount = submission.correctCount !== undefined ? submission.correctCount : questions.filter(q => submission.answers[q.id] === q.correctOptionIndex).length;
  const displayTotalQuestions = submission.totalQuestions || questions.length;
  const percentage = displayTotalQuestions > 0 ? Math.round((displayCorrectCount / displayTotalQuestions) * 100) : 0;
  const correctCount = displayCorrectCount; // For legacy logic below
  const totalQuestions = displayTotalQuestions;

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 select-none ${isContentBlurred ? 'exam-blur' : ''} disable-selection`}>
      <Navbar />
      <Container>
        <div className="max-w-3xl mx-auto py-6 sm:py-12">
          <Link to="/student" className="text-primary-600 text-sm font-bold flex items-center mb-8 hover:translate-x-[-4px] transition-transform w-fit">
            <i className="fas fa-arrow-left mr-2"></i> Back to Student Dashboard
          </Link>

          <header className="mb-6 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tight">Examination Performance Summary</h1>
            <p className="text-slate-500 font-medium">Verified result record for {quiz?.title}</p>
          </header>

          <section className="grid sm:grid-cols-3 gap-6 mb-6 sm:mb-12">
            <Card className="sm:col-span-2 p-5 sm:p-8 flex items-center justify-between border-none shadow-xl shadow-slate-200/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-primary-600"></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Exam Score</p>
                <div className="flex items-baseline space-x-3">
                  <span className="text-3xl sm:text-6xl font-black text-slate-900">{correctCount}/{totalQuestions}</span>
                  <span className="text-base sm:text-xl font-bold text-slate-400">({percentage}%)</span>
                </div>
                {submission.score !== correctCount && (
                  <p className="text-xs text-slate-400 mt-2 font-bold">Weighted Marks: {submission.score}/{submission.totalPossible}</p>
                )}
              </div>
              <div className="hidden sm:block">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${percentage >= 70 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                  <i className={`fas ${percentage >= 70 ? 'fa-check-double' : 'fa-hourglass-end'}`}></i>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-8 border-none shadow-xl shadow-slate-200/50 flex flex-col justify-center text-center sm:text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student Identity</p>
              <p className="text-slate-900 font-black truncate text-lg uppercase tracking-tight">{submission.studentName}</p>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session ID</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{submission.id}</p>
              </div>
            </Card>
          </section>

          <div className="space-y-8">
            <div className="flex items-center justify-between mb-2 px-2">
              <h2 className="text-xl font-bold text-slate-900">Module Performance Breakdown</h2>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{questions.length} Items Evaluated</span>
            </div>

            {questions.length === 0 ? (
              <Card className="p-12 text-center text-slate-400 italic bg-white border-dashed border-2">
                Question data has been archived for this session.
              </Card>
            ) : quiz?.showResults === false ? (
              <Card className="p-12 text-center text-slate-400 italic bg-white border-dashed border-2">
                Detailed question breakdown is currently hidden by the administrator.
              </Card>
            ) : (
              questions.map((q, idx) => {
                const studentAnswerIdx = submission.answers[q.id];
                const isCorrect = studentAnswerIdx === q.correctOptionIndex;
                const studentAnswerText = q.options[studentAnswerIdx] || "No Answer Provided";
                const correctAnswerText = q.options[q.correctOptionIndex];

                return (
                  <Card key={q.id} className="p-5 sm:p-8 relative overflow-hidden group hover:border-primary-200 transition-colors border-none shadow-lg shadow-slate-200/40">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></div>

                    <div className="flex items-start mb-4 sm:mb-6">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mr-4 shrink-0 shadow-sm ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2">{q.text}</h3>
                        <div className="flex items-center space-x-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${isCorrect ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 shrink-0">
                        {isCorrect ? (
                          <i className="fas fa-check-circle text-2xl text-green-500"></i>
                        ) : (
                          <i className="fas fa-times-circle text-2xl text-red-500"></i>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Selected Answer</p>
                        <p className={`text-sm font-bold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>{studentAnswerText}</p>
                      </div>
                      {!isCorrect && (
                        <div className="p-4 rounded-xl border-2 border-primary-100 bg-primary-50/30">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Correct Solution</p>
                          <p className="text-sm font-bold text-primary-800">{correctAnswerText}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </Container>

      {/* Screenshot Prevention Watermark */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden select-none opacity-[0.04]">
        <div
          className="absolute text-2xl font-black whitespace-nowrap text-slate-900 tracking-tighter uppercase italic transition-all duration-1000"
          style={{ transform: `translate(${watermarkPos.left}, ${watermarkPos.top})` }}
        >
          {profile?.displayName} • {profile?.email} • {new Date().toLocaleDateString()}
        </div>
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-20 transform -rotate-45 scale-150">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="text-2xl font-black whitespace-nowrap text-slate-900 tracking-tighter uppercase italic opacity-20">
              {profile?.displayName} • {profile?.email} • OFFICIAL RECORD
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
            <p className="text-slate-500 text-[10px] leading-relaxed uppercase tracking-widest font-black">
              {showScreenshotOverlay ? "Screen capturing is prohibited" : "Confidential Result Data"}
            </p>
            <p className="mt-4 text-[10px] text-slate-600 font-bold italic">
              Please focus on the result window. Navigation or screen capturing is restricted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;

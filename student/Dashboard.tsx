import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { quizService } from '../services/quizService';
import { submissionService } from '../services/submissionService';
import { questionService } from '../services/questionService';
import { adminService } from '../services/adminService';
import { Quiz, Submission } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { APP_CONFIG } from '../core/config';

const StudentDashboard: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [history, setHistory] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalizingIds, setFinalizingIds] = useState<Set<string>>(new Set());
  const [quizzesLoaded, setQuizzesLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.uid) return;
    const now = Date.now();
    console.log("Dashboard Subscriptions starting for UID:", profile.uid);
    // 1. Subscribe to Quizzes
    const unsubscribeQuizzes = quizService.subscribeToQuizzes((qDataRaw) => {
      console.log("Raw quizzes received:", qDataRaw.length);
      // We use the latest profile from the outer scope carefully
      if (!profile) return;
      
      const filtered = qDataRaw.filter(quiz => {
        if (!quiz.published) return false;
        // NOTE: We do NOT filter by quiz.status here.
        // A quiz with status 'completed' (ended by admin) still shows on the dashboard
        // but the attempt button will be disabled in the UI below.
        const studentEmail = profile.email?.toLowerCase().trim();
        const studentInst = profile.institution;
        const studentLevel = profile.level;

        if (quiz.allowedUsers && quiz.allowedUsers.length > 0) {
          const emailMatch = studentEmail && quiz.allowedUsers.some(u => u.toLowerCase().trim() === studentEmail);
          if (!emailMatch) return false;
        }

        if (quiz.availableFrom && now < quiz.availableFrom) return false;
        if (quiz.availableUntil && now > quiz.availableUntil) return false;

        if (APP_CONFIG.appId?.includes('smartprep') || APP_CONFIG.name === 'SmartPrepAca') {
          if (quiz.institution && studentInst && studentInst !== 'Pending') {
            if (quiz.institution !== studentInst) return false;
          }
        }

        if (quiz.level && studentLevel) {
          if (quiz.level !== studentLevel) return false;
        }

        if (quiz.allowedPrograms && quiz.allowedPrograms.length > 0) {
          if (!profile.program || !quiz.allowedPrograms.includes(profile.program)) {
            return false;
          }
        }

        return true;
      });

      setQuizzes(filtered);
      setQuizzesLoaded(true);
    }, (err) => {
      console.error("Quiz sub error:", err);
      setError("Sync failed.");
      setQuizzesLoaded(true);
    });

    const unsubscribeHistory = submissionService.subscribeToStudentResults(profile.uid, (hData) => {
      setHistory(hData);
      setHistoryLoaded(true);
    }, (err) => {
      console.error("History sub error:", err);
      setHistoryLoaded(true);
    });

    return () => {
      unsubscribeQuizzes();
      unsubscribeHistory();
    };
  }, [profile?.uid]); // ONLY re-run if the user ID changes

  // Separate Heartbeat Effect to avoid loops
  useEffect(() => {
    if (!profile?.uid) return;

    adminService.updateHeartbeat(profile.uid);
    const heartbeatInterval = setInterval(() => {
      adminService.updateHeartbeat(profile.uid);
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [profile?.uid]);

  // Stable Fallback Timeout
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (!quizzesLoaded) {
        console.warn("Dashboard quiz loading timed out. Forcing state to loaded.");
        setQuizzesLoaded(true);
      }
      if (!historyLoaded) {
        console.warn("Dashboard history loading timed out. Forcing state to loaded.");
        setHistoryLoaded(true);
      }
    }, 8000);

    return () => clearTimeout(fallbackTimeout);
  }, [quizzesLoaded, historyLoaded]);

  // Handle auto-finalization separately when quiz/history lists change
  useEffect(() => {
    if (quizzes.length > 0 && history.length > 0) {
      autoFinalizeExpired(quizzes, history);
    }
  }, [quizzes, history]);

  // Decoupled loading states for better UX on mobile/slow networks
  // const loading = !quizzesLoaded || !historyLoaded;

  const fetchData = async () => {
    // Force a fresh sync
    setQuizzesLoaded(false);
    setHistoryLoaded(false);
    setError(null);
  };

  const autoFinalizeExpired = async (qList: Quiz[], hList: Submission[]) => {
    const expiredActive = hList.filter(s => {
      if (s.status !== 'active') return false;
      const quiz = qList.find(q => q.id === s.quizId);
      if (!quiz) return false;
      const startedAt = s.startedAt || s.createdAt || 0;
      return (Date.now() - startedAt) > (quiz.timeLimit * 60 * 1000);
    });

    for (const sub of expiredActive) {
      if (finalizingIds.has(sub.id)) continue;

      setFinalizingIds(prev => {
        const next = new Set(prev);
        next.add(sub.id);
        return next;
      });

      try {
        const questions = await questionService.getQuestionsByQuiz(sub.quizId);
        const quiz = qList.find(q => q.id === sub.quizId);
        let score = 0;
        let correctCount = 0;
        questions.forEach(q => {
          if (sub.answers && sub.answers[q.id] === q.correctOptionIndex) {
            correctCount++;
            score += (q.mark !== undefined ? q.mark : (quiz?.defaultMarkPerQuestion || 1));
          }
        });
        await submissionService.finalSubmit(sub.id, score, false, correctCount, questions.length);
        setHistory(prev => prev.map(s => s.id === sub.id ? {
          ...s,
          status: 'completed' as any,
          score,
          correctCount,
          totalQuestions: questions.length,
          completedAt: Date.now()
        } : s));
      } catch (err) {
        console.error("Auto-finalization failed", err);
      } finally {
        setFinalizingIds(prev => {
          const next = new Set(prev);
          next.delete(sub.id);
          return next;
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        {/* Welcome Card */}
        <div className="mb-6 welcome-card-enter" style={{ maxWidth: 'fit-content' }}>
          <div className="px-5 py-3.5 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-2.5">
            <span className="text-base leading-none" role="img" aria-label="wave">👋</span>
            <p className="text-sm font-medium text-black">
              Hey, <span className="font-semibold text-black">{profile?.displayName?.split(' ')[0] || 'Student'}</span>
            </p>
          </div>
        </div>


        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-700 text-sm font-medium">
            <i className="fas fa-exclamation-circle mr-3"></i>
            {error}
            <button onClick={fetchData} className="ml-auto underline hover:no-underline">Retry Sync</button>
          </div>
        )}
        {!profile?.phoneNumber && (
          <Link to="/student/profile">
            <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center text-amber-900 text-sm font-bold shadow-sm hover:shadow-md transition-all animate-pulse">
              <i className="fas fa-phone-alt mr-3 text-amber-600"></i>
              Please update your phone number in your personal information to ensure you receive important updates.
              <i className="fas fa-arrow-right ml-auto"></i>
            </div>
          </Link>
        )}
        {!profile?.level && (
          <Link to="/student/profile">
            <div className="mb-8 p-4 bg-primary-50 border border-primary-100 rounded-xl flex items-center text-primary-900 text-sm font-bold shadow-sm hover:shadow-md transition-all animate-pulse">
              <i className="fas fa-graduation-cap mr-3 text-primary-600"></i>
              Please select your academic level (100, 200, or 300) in your academic settings to see examinations at your level.
              <i className="fas fa-arrow-right ml-auto"></i>
            </div>
          </Link>
        )}
        {!profile?.program && (
          <Link to="/student/profile">
            <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center text-orange-900 text-sm font-bold shadow-sm hover:shadow-md transition-all animate-pulse">
              <i className="fas fa-microscope mr-3 text-orange-600"></i>
              Please select your academic program (RCN, RGN, RMN, or RPHN) in your profile to see specialized examinations.
              <i className="fas fa-arrow-right ml-auto"></i>
            </div>
          </Link>
        )}        {/* Bento Grid Layout */}
        <div className="bento-grid">
          
          {/* Main Examinations Section */}
          <section className="bento-item-large space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-black flex items-center uppercase tracking-widest text-xs">
                Available Modules
              </h2>
              {quizzesLoaded && (
                <span className="text-[10px] font-black text-black bg-slate-100 px-3 py-1 rounded-full">{quizzes.length} AVAILABLE</span>
              )}
            </div>

            {!quizzesLoaded ? (
              <div className="grid sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-200 rounded-3xl animate-pulse"></div>)}
              </div>
            ) : quizzes.length === 0 ? (
              <Card variant="glass" className="p-16 text-center border-dashed border-2 border-slate-200 bg-transparent flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-6 drop-shadow-sm">
                  <i className="fas fa-wind text-3xl"></i>
                </div>
                <p className="text-black font-bold text-lg">Your queue is currently empty.</p>
                <p className="text-slate-300 text-sm mt-1">Check back soon for new assignments.</p>
              </Card>
            ) : (
            <div className="flex flex-col gap-3">
                {quizzes.map(quiz => {
                  const submission = history.find(h => h.quizId === quiz.id);
                  const isCompleted = submission?.status === 'completed';
                  const isActive = submission?.status === 'active';
                  const isExpired = isActive && submission && ((Date.now() - (submission.startedAt || submission.createdAt || 0)) > (quiz.timeLimit * 60 * 1000));

                  return (
                    <Card key={quiz.id} className="p-3 flex items-center gap-4 hover:bg-slate-50/50 transition-all border-slate-100 shadow-none group">
                      {/* Icon */}
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-black group-hover:text-primary-600 group-hover:bg-white transition-all">
                        <i className="fas fa-file-signature text-lg"></i>
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-bold text-black truncate group-hover:text-primary-600 transition-colors">
                            {quiz.title}
                          </h3>
                          {isCompleted && (
                            <span className="shrink-0 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                              Success
                            </span>
                          )}
                          {isActive && !isExpired && (
                            <span className="shrink-0 bg-amber-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">
                              Resuming
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest mb-1.5 leading-none">{quiz.subjectTitle}</p>
                        
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center text-[9px] font-bold text-black bg-slate-50 rounded-md px-2 py-0.5 border border-slate-100">
                            <i className="far fa-clock mr-1.5 opacity-70"></i> {quiz.timeLimit}m
                          </div>
                          <div className="flex items-center text-[9px] font-bold text-black bg-slate-50 rounded-md px-2 py-0.5 border border-slate-100">
                            <i className="fas fa-shapes mr-1.5 opacity-70"></i> {quiz.totalQuestions} Qs
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0">
                        {isCompleted ? (
                          <Link to={`/student/results/${submission.id}`} className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 shadow-sm">
                             <i className="fas fa-arrow-right text-xs"></i>
                          </Link>
                        ) : isExpired ? (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center">
                             <i className="fas fa-lock text-xs"></i>
                          </div>
                        ) : (
                          <Link to={`/student/quiz/${quiz.id}`} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm ${isActive ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
                            <i className="fas fa-arrow-right text-xs"></i>
                          </Link>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sidebar Section */}
          <div className="bento-item-medium space-y-6">
             {/* Additional sidebar components can be added here in the future */}
          </div>
        </div>

      </Container>
    </div>
  );
};

export default StudentDashboard;

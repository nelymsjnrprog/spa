import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { quizService } from '../services/quizService';
import { submissionService } from '../services/submissionService';
import { Quiz, Submission } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';

const LiveMonitor: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [announcementMsg, setAnnouncementMsg] = useState('');
    const { profile } = useAuth();

    useEffect(() => {
        if (!quizId) return;

        // Subscribe to quiz changes (including status and announcement)
        const unsubscribeQuiz = quizService.subscribeToQuiz(quizId, (data) => {
            if (!data) return;
            
            // Access Control Guard:
            const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';
            if (!isSuperAdmin) {
                const assigned = profile?.assignedInstitutions || [];
                const quizInst = (data.institution || '').trim().toLowerCase();
                if (!assigned.some(inst => inst.trim().toLowerCase() === quizInst)) {
                    alert("Unauthorized access attempt. Redirecting...");
                    window.location.hash = "/admin/quizzes";
                    return;
                }
            }

            setQuiz(data);
            if (data.announcement) {
                setAnnouncementMsg(data.announcement);
            }
            setLoading(false);
        });

        // Subscribe to all student submissions for this quiz to monitor presence
        const unsubscribeSubmissions = submissionService.subscribeToQuizSubmissions(quizId, (data) => {
            setSubmissions(data);
        });

        return () => {
            unsubscribeQuiz();
            unsubscribeSubmissions();
        };
    }, [quizId]);

    const handleStatusChange = async (newStatus: Quiz['status']) => {
        if (!quiz) return;
        try {
            if (newStatus === 'completed') {
                const confirmed = window.confirm("Are you sure you want to end this exam? Student exams will be auto-submitted immediately.");
                if (!confirmed) return;
            }
            await quizService.setQuizStatus(quiz.id, newStatus);
        } catch (err) {
            alert("Failed to update status.");
        }
    };

    const handleBroadcast = async () => {
        if (!quiz) return;
        try {
            await quizService.broadcastAnnouncement(quiz.id, announcementMsg);
            alert("Announcement broadcasted.");
        } catch (err) {
            alert("Failed to broadcast.");
        }
    };

    const clearAnnouncement = async () => {
        if (!quiz) return;
        try {
            await quizService.broadcastAnnouncement(quiz.id, '');
            setAnnouncementMsg('');
        } catch (err) {
            alert("Failed to clear.");
        }
    };

    const handleExtendTime = async (sub: Submission) => {
        const minInput = window.prompt("How many extra minutes for this student?", "5");
        if (!minInput) return;
        const mins = parseInt(minInput, 10);
        if (isNaN(mins) || mins <= 0) return;

        try {
            await submissionService.extendTime(sub.id, mins);
        } catch (err) {
            alert("Failed to extend time.");
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading monitor...</div>;
    if (!quiz) return <div className="p-8 text-center text-red-500">Module not found.</div>;

    const now = Date.now();
    const activeSubmissions = submissions.filter(s => s.status === 'active');
    const completedSubmissions = submissions.filter(s => s.status === 'completed');
    const stoppedSubmissions = completedSubmissions.filter(s => s.stoppedByAdmin);

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <Link 
                            to={quiz.institution 
                                ? `/admin/institution/${encodeURIComponent(quiz.institution)}` 
                                : `/admin/level/${quiz.level || '100'}`} 
                            className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit"
                        >
                             <i className="fas fa-arrow-left mr-2"></i> Back to Level Management
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Live Monitor</h1>
                        <p className="text-slate-500 font-medium">Session: {quiz.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {quiz.status === 'active' && (
                            <button onClick={() => handleStatusChange('paused')} className="flex-1 sm:flex-none bg-amber-500 text-white px-6 py-3 sm:py-2 rounded-xl font-bold hover:bg-amber-600 transition-all text-sm">
                                 Pause
                            </button>
                        )}
                        {quiz.status !== 'completed' && (
                            <button onClick={() => handleStatusChange('completed')} className="flex-1 sm:flex-none bg-red-600 text-white px-6 py-3 sm:py-2 rounded-xl font-bold hover:bg-red-700 transition-all text-sm">
                                 End Exam
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8">
                    <Card className="p-6 border-none shadow-xl shadow-slate-100/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600">
                            
                        </div>
                        <h4 className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Active Students</h4>
                        <div className="text-4xl sm:text-5xl font-black text-slate-900">{activeSubmissions.length}</div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl shadow-slate-100/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-primary-600">
                            
                        </div>
                        <h4 className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Submitted</h4>
                        <div className="text-4xl sm:text-5xl font-black text-slate-900">{completedSubmissions.length}</div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl shadow-slate-100/50 relative overflow-hidden sm:col-span-2 lg:col-span-1">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-600">
                            
                        </div>
                        <h4 className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Live Announcement</h4>
                        <div className="flex flex-col gap-2 mt-2 relative z-10">
                            <input
                                type="text"
                                value={announcementMsg}
                                onChange={e => setAnnouncementMsg(e.target.value)}
                                placeholder="Alert text..."
                                className="w-full p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                            />
                            <div className="flex space-x-2">
                                <button onClick={handleBroadcast} className="flex-1 bg-amber-500 text-white text-xs font-black py-3 rounded text-center hover:bg-amber-600 uppercase tracking-widest">
                                    Broadcast
                                </button>
                                <button onClick={clearAnnouncement} className="flex-1 bg-slate-200 text-slate-700 text-xs font-black py-3 rounded text-center hover:bg-slate-300 uppercase tracking-widest">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>

                {stoppedSubmissions.length > 0 && (
                    <Card className="p-8 border-none shadow-xl shadow-slate-100/50 mb-6">
                        <h2 className="text-xl font-black text-slate-900 mb-6 border-b pb-4 flex items-center gap-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                                 Distribution Stopped
                            </span>
                            Students force-submitted when distribution was stopped
                        </h2>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-black">
                                        <th className="p-4 rounded-tl-xl">Student</th>
                                        <th className="p-4">Progress at Stop</th>
                                        <th className="p-4">Score</th>
                                        <th className="p-4 rounded-tr-xl">Stopped At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stoppedSubmissions.map(sub => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 border-b">
                                                <div className="font-bold text-slate-900">{sub.studentName}</div>
                                            </td>
                                            <td className="p-4 border-b">
                                                <div className="flex items-center">
                                                    <span className="text-sm font-bold text-slate-700 mr-2">
                                                        {sub.currentQuestionIndex !== undefined ? sub.currentQuestionIndex + 1 : '-'}/{quiz.totalQuestions}
                                                    </span>
                                                    <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-red-400 rounded-full"
                                                            style={{ width: `${((sub.currentQuestionIndex || 0) + 1) / (quiz.totalQuestions || 1) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 border-b">
                                                <span className="text-sm font-bold text-slate-700">{sub.score ?? '-'} / {sub.totalPossible ?? '-'}</span>
                                            </td>
                                            <td className="p-4 border-b">
                                                <span className="text-xs text-slate-500">{sub.completedAt ? new Date(sub.completedAt).toLocaleTimeString() : '-'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden space-y-3">
                            {stoppedSubmissions.map(sub => (
                                <div key={sub.id} className="p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-slate-900">{sub.studentName}</div>
                                        <div className="text-xs text-slate-500 mt-1">Q {sub.currentQuestionIndex !== undefined ? sub.currentQuestionIndex + 1 : '-'}/{quiz.totalQuestions} · Score: {sub.score ?? '-'}</div>
                                    </div>
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-600 border border-red-200">
                                         Stopped
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card className="p-8 border-none shadow-xl shadow-slate-100/50">
                    <h2 className="text-xl font-black text-slate-900 mb-6 border-b pb-4">Real-Time Presence</h2>

                    {activeSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest">
                            No students currently active.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-black">
                                            <th className="p-4 rounded-tl-xl">Student</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Progress (Qs)</th>
                                            <th className="p-4">Violations</th>
                                            <th className="p-4">Time Ext.</th>
                                            <th className="p-4 rounded-tr-xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {activeSubmissions.map(sub => {
                                            const isIdle = sub.lastActive ? now - sub.lastActive > 60000 : false;
                                            return (
                                                <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 border-b">
                                                        <div className="font-bold text-slate-900">{sub.studentName}</div>
                                                    </td>
                                                    <td className="p-4 border-b">
                                                        {isIdle ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                                                 Idle
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                 Live
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 border-b">
                                                        <div className="flex items-center">
                                                            <span className="text-sm font-bold text-slate-700 mr-2">
                                                                {sub.currentQuestionIndex !== undefined ? sub.currentQuestionIndex + 1 : '-'}/{quiz.totalQuestions}
                                                            </span>
                                                            <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${((sub.currentQuestionIndex || 0) + 1) / (quiz.totalQuestions || 1) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 border-b">
                                                        {sub.violations && sub.violations > 0 ? (
                                                            <span className="text-red-500 font-bold text-sm"> {sub.violations}</span>
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 border-b">
                                                        {sub.timeExtension ? <span className="text-primary-600 font-bold text-sm">+{sub.timeExtension}m</span> : <span className="text-slate-300">-</span>}
                                                    </td>
                                                    <td className="p-4 border-b">
                                                        <button
                                                            onClick={() => handleExtendTime(sub)}
                                                            className="bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                            title="Add Extra Time"
                                                        >
                                                             +Time
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card List */}
                            <div className="md:hidden space-y-4">
                                {activeSubmissions.map(sub => {
                                    const isIdle = sub.lastActive ? now - sub.lastActive > 60000 : false;
                                    const progress = ((sub.currentQuestionIndex || 0) + 1) / (quiz.totalQuestions || 1) * 100;
                                    return (
                                        <div key={sub.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="font-bold text-slate-900">{sub.studentName}</div>
                                                </div>
                                                {isIdle ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-100">
                                                        Idle
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                         Live
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                                                        <span className="text-xs font-bold text-slate-700">{sub.currentQuestionIndex !== undefined ? sub.currentQuestionIndex + 1 : '-'}/{quiz.totalQuestions}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Violations</p>
                                                        <p className={`font-bold ${sub.violations ? 'text-red-500' : 'text-slate-300'}`}>
                                                            {sub.violations ? <> {sub.violations}</> : '0'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 text-right">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Ext.</p>
                                                        <p className={`font-bold ${sub.timeExtension ? 'text-primary-600' : 'text-slate-300'}`}>
                                                            {sub.timeExtension ? `+${sub.timeExtension}m` : 'None'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleExtendTime(sub)}
                                                    className="w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50"
                                                >
                                                     Extend Time
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Card>
            </Container>
        </div>
    );
};

export default LiveMonitor;

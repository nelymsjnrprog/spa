
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { submissionService } from '../services/submissionService';
import { quizService } from '../services/quizService';
import { userService } from '../services/userService';
import { Submission, Quiz, UserProfile } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';

type Tab = 'overview' | 'results' | 'institution' | 'levels';

const Reports: React.FC = () => {
   const [submissions, setSubmissions] = useState<Submission[]>([]);
   const [quizzes, setQuizzes] = useState<Quiz[]>([]);
   const [students, setStudents] = useState<UserProfile[]>([]);
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState<Tab>('overview');

   // Filters for Exam Results tab
   const [searchTerm, setSearchTerm] = useState('');
   const [filterQuizId, setFilterQuizId] = useState('');
   const [filterLevel, setFilterLevel] = useState('');

   const { profile } = useAuth();
   const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';
   const location = useLocation();

   // What institutions this admin can see
   const allowedInstitutions: string[] = isSuperAdmin
      ? [] // empty means all — we'll compute from data
      : (profile?.assignedInstitutions || []);

   useEffect(() => {
      const unsubQ = quizService.subscribeToQuizzes((data) => setQuizzes(data));
      const unsubS = submissionService.subscribeToAllSubmissions((data) => {
         setSubmissions(data);
         setLoading(false);
      });
      const unsubU = userService.subscribeToUsers((data) => {
         setStudents(data.filter(u => u.role === 'student'));
      });

      const params = new URLSearchParams(location.search);
      const quizId = params.get('quizId');
      if (quizId) {
         setFilterQuizId(quizId);
      }

      return () => { unsubQ(); unsubS(); unsubU(); };
   }, [location.search]);

   const selectedQuiz = useMemo(() => {
      return quizzes.find(q => q.id === filterQuizId);
   }, [quizzes, filterQuizId]);

   // ─── Permission-scoped data ─────────────────────────────────────────────────

   const isResourceVisible = (institution?: string): boolean => {
      if (isSuperAdmin) return true;
      if (!institution) return false;
      const target = institution.trim().toLowerCase();
      return allowedInstitutions.some(i => i.trim().toLowerCase() === target);
   };

   const scopedSubmissions = useMemo(() => {
      return submissions.filter(s => {
         const quiz = quizzes.find(q => q.id === s.quizId);
         const inst = s.studentInstitution || quiz?.institution || '';
         return isResourceVisible(inst);
      });
   }, [submissions, quizzes, isSuperAdmin, allowedInstitutions]);

   const scopedStudents = useMemo(() => {
      return students.filter(s => isResourceVisible(s.institution));
   }, [students, isSuperAdmin, allowedInstitutions]);

   const allowedQuizzes = useMemo(() => {
      return quizzes.filter(q => isResourceVisible(q.institution));
   }, [quizzes, isSuperAdmin, allowedInstitutions]);

   // All distinct levels visible to this admin (from scoped data)
   const visibleLevels: string[] = useMemo(() => {
      const fromStudents = scopedStudents.map(s => s.level || '').filter(Boolean);
      const fromQuizzes = allowedQuizzes.map(q => q.level || '').filter(Boolean);
      const all = Array.from(new Set([...fromStudents, ...fromQuizzes]));
      return all.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
   }, [scopedStudents, allowedQuizzes]);

   // ─── Helpers ────────────────────────────────────────────────────────────────

   const getQuizTitle = (id: string) => quizzes.find(q => q.id === id)?.title || 'Unknown Exam';

   const calcPassRate = (subs: Submission[]) => {
      if (!subs.length) return 0;
      const avg = subs.reduce((acc, s) => {
         const pct = s.correctCount !== undefined && s.totalQuestions
            ? s.correctCount / s.totalQuestions
            : s.score / s.totalPossible;
         return acc + (isNaN(pct) ? 0 : pct);
      }, 0) / subs.length;
      return Math.round(avg * 100);
   };

   const handleReset = async (submissionId: string) => {
      if (!window.confirm(
         "PERMANENT RESET WARNING:\n\nThis will permanently delete this student's submission.\nThe student will be authorized to re-attempt this examination.\n\nProceed?"
      )) return;
      try {
         setLoading(true);
         await submissionService.deleteSubmission(submissionId);
      } catch (err: any) { 
         console.error("Reset Error:", err);
         alert(`Failed to reset: ${err.message || "Check your administrative permissions."}`); 
      }
      finally { setLoading(false); }
   };

   const handleOverrideGrade = async (submissionId: string, currentScore: number, totalPossible: number) => {
      const input = window.prompt(`Override grade (Current: ${currentScore}/${totalPossible}):\nEnter new score:`, currentScore.toString());
      if (input === null) return;
      const newScore = parseInt(input, 10);
      if (isNaN(newScore) || newScore < 0 || newScore > totalPossible) { alert("Invalid score."); return; }
      try {
         setLoading(true);
         await submissionService.overrideGrade(submissionId, newScore);
      } catch { alert("Failed to override grade."); }
      finally { setLoading(false); }
   };

   // ─── Tab definitions ────────────────────────────────────────────────────────

   const tabs = [
      { id: 'overview' as Tab,     label: 'Overview',          icon: 'fa-chart-pie' },
      { id: 'results' as Tab,      label: 'Exam Results',      icon: 'fa-table' },
      { id: 'institution' as Tab,  label: 'By Institution',    icon: 'fa-university', superAdminOnly: true },
      { id: 'levels' as Tab,       label: 'Level Performance', icon: 'fa-layer-group' },
   ].filter(t => !t.superAdminOnly || isSuperAdmin);

   // ─── TAB: Overview ──────────────────────────────────────────────────────────

   const OverviewTab = () => {
      const completedSubs = scopedSubmissions.filter(s => s.status === 'completed');
      const passRate = calcPassRate(completedSubs);

      const overviewStats = [
         { label: 'Total Students', value: scopedStudents.length, icon: 'fa-users', color: 'text-blue-600', bg: 'bg-blue-50' },
         { label: 'Exams Taken', value: completedSubs.length, icon: 'fa-file-alt', color: 'text-indigo-600', bg: 'bg-indigo-50' },
         { label: 'Avg Pass Rate', value: `${passRate}%`, icon: 'fa-percentage', color: 'text-emerald-600', bg: 'bg-emerald-50' },
         { label: 'Active Quizzes', value: allowedQuizzes.filter(q => q.published).length, icon: 'fa-broadcast-tower', color: 'text-amber-600', bg: 'bg-amber-50' },
      ];

      // Per-level summary
      const levelSummary = visibleLevels.map(level => {
         const lvlStudents = scopedStudents.filter(s => (s.level || '') === level);
         const lvlSubs = scopedSubmissions.filter(s => {
            const q = quizzes.find(q => q.id === s.quizId);
            return (s.studentLevel || q?.level || '') === level && s.status === 'completed';
         });
         return { level, studentCount: lvlStudents.length, submissionCount: lvlSubs.length, passRate: calcPassRate(lvlSubs) };
      });

      return (
         <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {overviewStats.map((s, i) => (
                  <Card key={i} className="p-6 border-none shadow-lg shadow-slate-200/50">
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                           <p className="text-3xl font-black text-slate-900">{s.value}</p>
                        </div>
                        <div className={`p-3 rounded-2xl ${s.bg} ${s.color} shadow-inner`}>
                           
                        </div>
                     </div>
                  </Card>
               ))}
            </div>

            {/* Per-Level Breakdown */}
            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
               <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                  <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                     
                     Performance Snapshot by Level
                  </h2>
               </div>
               {levelSummary.length === 0 ? (
                  <div className="p-16 text-center text-slate-300 text-xs font-bold uppercase">No level data available</div>
               ) : (
                  <div className="divide-y divide-slate-50">
                     {levelSummary.map(ls => (
                        <div key={ls.level} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                           <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center font-black text-sm">
                                 {ls.level}
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900 text-sm">Level {ls.level}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {ls.studentCount} student{ls.studentCount !== 1 ? 's' : ''} · {ls.submissionCount} submission{ls.submissionCount !== 1 ? 's' : ''}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center space-x-6">
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pass Rate</p>
                                 <p className={`text-xl font-black ${ls.passRate >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{ls.passRate}%</p>
                              </div>
                              {/* Mini progress bar */}
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                 <div
                                    className={`h-full rounded-full transition-all ${ls.passRate >= 50 ? 'bg-emerald-500' : 'bg-red-400'}`}
                                    style={{ width: `${ls.passRate}%` }}
                                 />
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </Card>
         </div>
      );
   };

   // ─── TAB: Exam Results ──────────────────────────────────────────────────────

   const ExamResultsTab = () => {
      // Apply filters
      const filtered = scopedSubmissions.filter(s => {
         const quiz = quizzes.find(q => q.id === s.quizId);
         const level = s.studentLevel || quiz?.level || '';
         if (filterLevel && level !== filterLevel) return false;
         if (filterQuizId && s.quizId !== filterQuizId) return false;
         if (searchTerm && !s.studentName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
         return true;
      });

      // Group by Level first, then by quizId within each level
      const byLevel: Record<string, Record<string, Submission[]>> = {};
      filtered.forEach(s => {
         const quiz = quizzes.find(q => q.id === s.quizId);
         const level = s.studentLevel || quiz?.level || 'Unknown';
         const qId = s.quizId;
         if (!byLevel[level]) byLevel[level] = {};
         if (!byLevel[level][qId]) byLevel[level][qId] = [];
         byLevel[level][qId].push(s);
      });

      const sortedLevels = Object.keys(byLevel).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      // Filters UI
      return (
         <div className="space-y-8">
            {/* Filter Bar */}
            <Card className="p-4 border-none shadow-lg shadow-slate-200/50">
               <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                     
                     <input
                        type="text"
                        placeholder="Search student name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none w-full transition-all"
                     />
                  </div>

                  {/* Level filter — scoped to visible data */}
                  <select
                     value={filterLevel}
                     onChange={(e) => setFilterLevel(e.target.value)}
                     disabled={!isSuperAdmin && allowedLevels.length === 1}
                     className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                     title="Filter by Level"
                  >
                     <option value="">All Levels</option>
                     {visibleLevels.map(l => <option key={l} value={l}>Level {l}</option>)}
                  </select>

                  <select
                     value={filterQuizId}
                     onChange={(e) => setFilterQuizId(e.target.value)}
                     className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                     title="Filter by Exam"
                  >
                     <option value="">All Exams</option>
                     {allowedQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>

                  {(searchTerm || filterLevel || filterQuizId) && (
                     <button
                        onClick={() => { setSearchTerm(''); setFilterLevel(''); setFilterQuizId(''); }}
                        className="px-4 py-3 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition whitespace-nowrap"
                     >
                        Clear
                     </button>
                  )}
               </div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3">
                  Showing {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
               </p>
            </Card>

            {filtered.length === 0 ? (
               <Card className="p-24 text-center border-none shadow-xl shadow-slate-200/50">
                  
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records match your filters</p>
               </Card>
            ) : (
               sortedLevels.map(level => (
                  <div key={level} className="space-y-4">
                     {/* Level separator header */}
                     <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-primary-200">
                           {level}
                        </div>
                        <div>
                           <h2 className="text-lg font-black text-slate-900">Level {level}</h2>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {Object.values(byLevel[level]).flat().length} submission{Object.values(byLevel[level]).flat().length !== 1 ? 's' : ''} across {Object.keys(byLevel[level]).length} exam{Object.keys(byLevel[level]).length !== 1 ? 's' : ''}
                           </p>
                        </div>
                     </div>

                     {/* Quizzes within this level */}
                     {Object.entries(byLevel[level]).map(([quizId, quizSubs]) => (
                        <div key={quizId} className="ml-0 sm:ml-4">
                           <h3 className="text-sm font-bold text-slate-600 px-2 py-1 border-l-4 border-slate-300 mb-3 flex items-center justify-between">
                              <span>{getQuizTitle(quizId)}</span>
                              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                 {quizSubs.length} attempt{quizSubs.length !== 1 ? 's' : ''} · Avg {calcPassRate(quizSubs)}%
                              </span>
                           </h3>
                           <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                               <div className="hidden md:block overflow-x-auto">
                                  <table className="w-full text-left">
                                     <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                        <tr>
                                           <th className="px-6 py-4 tracking-widest">Student</th>
                                           {isSuperAdmin && <th className="px-6 py-4 tracking-widest">Institution</th>}
                                           <th className="px-6 py-4 tracking-widest">Status</th>
                                           <th className="px-6 py-4 tracking-widest">Score</th>
                                           <th className="px-6 py-4 tracking-widest text-right">Date</th>
                                           <th className="px-6 py-4 tracking-widest text-right border-l border-slate-100 w-44">Actions</th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-50 text-sm">
                                        {quizSubs.map(s => (
                                           <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                              <td className="px-6 py-4">
                                                 <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                       {s.studentName.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-slate-900 truncate max-w-[140px]">{s.studentName}</span>
                                                 </div>
                                              </td>
                                              {isSuperAdmin && (
                                                 <td className="px-6 py-4">
                                                    <span className="text-xs text-slate-500 font-medium truncate max-w-[120px] block">
                                                       {s.studentInstitution || '—'}
                                                    </span>
                                                 </td>
                                              )}
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                 <div className="flex items-center space-x-1.5">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                       {s.status}
                                                    </span>
                                                    {s.isIncompleteAttempt && (
                                                       <span className="text-[8px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-lg uppercase tracking-wider font-black" title="Timed-out before meeting minimum threshold">
                                                          Timeout
                                                       </span>
                                                    )}
                                                 </div>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                 <div className="font-mono font-black text-primary-600 inline-flex items-center">
                                                    {s.score}/{s.totalPossible}
                                                 </div>
                                              </td>
                                              <td className="px-6 py-4 text-right text-slate-400 text-xs whitespace-nowrap">
                                                 {new Date(s.createdAt).toLocaleDateString()}
                                              </td>
                                              <td className="px-6 py-4 text-right border-l border-slate-50">
                                                 <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleOverrideGrade(s.id, s.score, s.totalPossible)} className="p-2 text-slate-400 hover:text-primary-600 transition-colors" title="Edit Score"><i className="fas fa-edit"></i></button>
                                                    <button onClick={() => handleReset(s.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Reset Attempt"><i className="fas fa-undo"></i></button>
                                                 </div>
                                              </td>
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>
                               </div>

                               {/* Mobile List View */}
                               <div className="md:hidden divide-y divide-slate-50 text-sm">
                                  {quizSubs.map(s => (
                                     <div key={s.id} className="p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                           <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                                                 {s.studentName.charAt(0)}
                                              </div>
                                              <div className="min-w-0">
                                                 <p className="font-black text-slate-900 truncate max-w-[120px]">{s.studentName}</p>
                                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.status}</p>
                                              </div>
                                           </div>
                                           <div className="text-right">
                                              <p className="text-[10px] font-black text-primary-600">{s.score}/{s.totalPossible}</p>
                                              <p className="text-[9px] text-slate-400 font-medium">{new Date(s.createdAt).toLocaleDateString()}</p>
                                           </div>
                                        </div>
                                        <div className="flex gap-2">
                                           <button onClick={() => handleOverrideGrade(s.id, s.score, s.totalPossible)} className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest active:bg-primary-50 active:text-primary-600 transition-colors flex items-center justify-center gap-2"><i className="fas fa-edit"></i><span>Edit Score</span></button>
                                           <button onClick={() => handleReset(s.id)} className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest active:bg-red-50 active:text-red-600 transition-colors flex items-center justify-center gap-2"><i className="fas fa-undo"></i><span>Reset</span></button>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            </Card>
                         </div>
                      ))}
                   </div>
                ))
            )}
         </div>
      );
   };

   // ─── TAB: By Institution (Super Admin only) ──────────────────────────────

   const InstitutionTab = () => {
      // Group students by institution then level
      const byInstitution: Record<string, Record<string, UserProfile[]>> = {};
      students.forEach(s => {
         const inst = s.institution || 'Unknown Institution';
         const level = s.level || 'Unknown';
         if (!byInstitution[inst]) byInstitution[inst] = {};
         if (!byInstitution[inst][level]) byInstitution[inst][level] = [];
         byInstitution[inst][level].push(s);
      });

      const sortedInstitutions = Object.keys(byInstitution).sort();

      return (
         <div className="space-y-8">
            {sortedInstitutions.length === 0 ? (
               <Card className="p-24 text-center border-none shadow-xl">
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">No institution data available</p>
               </Card>
            ) : (
               sortedInstitutions.map(inst => {
                  const totalStudentsInInst = Object.values(byInstitution[inst]).flat().length;
                  const instSubs = submissions.filter(s => s.studentInstitution === inst && s.status === 'completed');

                  return (
                     <div key={inst} className="space-y-3">
                        {/* Institution header */}
                        <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center">
                                 
                              </div>
                              <div>
                                 <h2 className="text-lg font-black text-slate-900">{inst}</h2>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {totalStudentsInInst} student{totalStudentsInInst !== 1 ? 's' : ''} · {instSubs.length} exam{instSubs.length !== 1 ? 's' : ''} taken · Avg {calcPassRate(instSubs)}%
                                 </p>
                              </div>
                           </div>
                        </div>

                        {/* Levels within institution */}
                        <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 ml-0 sm:ml-4">
                           <div className="divide-y divide-slate-50">
                              {Object.keys(byInstitution[inst]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(level => {
                                 const lvlStudents = byInstitution[inst][level];
                                 const lvlSubs = submissions.filter(s =>
                                    s.studentInstitution === inst &&
                                    (s.studentLevel === level) &&
                                    s.status === 'completed'
                                 );

                                 return (
                                    <div key={level} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                                       <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-3">
                                             <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-black text-xs">
                                                {level}
                                             </div>
                                             <div>
                                                <p className="font-bold text-slate-900 text-sm">Level {level}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                   {lvlStudents.length} student{lvlStudents.length !== 1 ? 's' : ''} registered
                                                </p>
                                             </div>
                                          </div>
                                          <div className="flex items-center space-x-6 text-right">
                                             <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Submissions</p>
                                                <p className="font-black text-slate-900">{lvlSubs.length}</p>
                                             </div>
                                             <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Avg Score</p>
                                                <p className={`font-black text-lg ${calcPassRate(lvlSubs) >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{calcPassRate(lvlSubs)}%</p>
                                             </div>
                                          </div>
                                       </div>

                                       {/* Students in this level/institution */}
                                       <div className="mt-3 flex flex-wrap gap-2">
                                          {lvlStudents.slice(0, 8).map(st => (
                                             <span key={st.uid} className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                                                <span className="w-4 h-4 rounded-full bg-slate-300 text-white flex items-center justify-center text-[8px] font-black mr-1.5">
                                                   {st.displayName?.charAt(0) || 'S'}
                                                </span>
                                                {st.displayName}
                                             </span>
                                          ))}
                                          {lvlStudents.length > 8 && (
                                             <span className="inline-flex items-center px-2.5 py-1 bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold">
                                                +{lvlStudents.length - 8} more
                                             </span>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </Card>
                     </div>
                  );
               })
            )}
         </div>
      );
   };

   // ─── TAB: Level Performance ──────────────────────────────────────────────

   const LevelPerformanceTab = () => {
      const rows = visibleLevels.map(level => {
         const lvlStudents = scopedStudents.filter(s => (s.level || '') === level);
         const lvlSubs = scopedSubmissions.filter(s => {
            const q = quizzes.find(q => q.id === s.quizId);
            return (s.studentLevel || q?.level || '') === level && s.status === 'completed';
         });
         const lvlQuizzes = allowedQuizzes.filter(q => (q.level || '') === level);

         // Top scorer
         const topScorer = lvlSubs.reduce<Submission | null>((best, s) => {
            const pct = s.correctCount !== undefined && s.totalQuestions ? s.correctCount / s.totalQuestions : s.score / s.totalPossible;
            const bestPct = best ? (best.correctCount !== undefined && best.totalQuestions ? best.correctCount / best.totalQuestions : best.score / best.totalPossible) : -1;
            return pct > bestPct ? s : best;
         }, null);

         return { level, lvlStudents, lvlSubs, lvlQuizzes, passRate: calcPassRate(lvlSubs), topScorer };
      });

      return (
         <div className="space-y-4">
            {rows.length === 0 ? (
               <Card className="p-24 text-center border-none shadow-xl">
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">No level data to display</p>
               </Card>
            ) : (
               rows.map(row => (
                  <Card key={row.level} className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
                     {/* Level header band */}
                     <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                           <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black text-sm">
                              {row.level}
                           </div>
                           <div>
                              <h3 className="font-black text-white">Level {row.level}</h3>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{row.lvlQuizzes.length} exam module{row.lvlQuizzes.length !== 1 ? 's' : ''}</p>
                           </div>
                        </div>
                        <div className={`text-3xl font-black ${row.passRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                           {row.passRate}%
                        </div>
                     </div>

                     {/* Stats row */}
                     <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                        <div className="px-6 py-4 text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p>
                           <p className="text-2xl font-black text-slate-900">{row.lvlStudents.length}</p>
                        </div>
                        <div className="px-6 py-4 text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submissions</p>
                           <p className="text-2xl font-black text-slate-900">{row.lvlSubs.length}</p>
                        </div>
                        <div className="px-6 py-4 text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Exam Modules</p>
                           <p className="text-2xl font-black text-slate-900">{row.lvlQuizzes.length}</p>
                        </div>
                        <div className="px-6 py-4 text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Scorer</p>
                           {row.topScorer ? (
                              <p className="text-sm font-black text-primary-600 truncate">{row.topScorer.studentName}</p>
                           ) : (
                              <p className="text-sm text-slate-300 font-medium italic">—</p>
                           )}
                        </div>
                     </div>

                     {/* Exam breakdown table */}
                     {row.lvlQuizzes.length > 0 && (
                        <div className="border-t border-slate-100">
                           <div className="px-6 py-3 bg-slate-50">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam Breakdown</p>
                           </div>
                           <div className="divide-y divide-slate-50">
                              {row.lvlQuizzes.map(q => {
                                 const qSubs = row.lvlSubs.filter(s => s.quizId === q.id);
                                 const qRate = calcPassRate(qSubs);
                                 return (
                                    <div key={q.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                       <div>
                                          <p className="text-sm font-bold text-slate-800">{q.title}</p>
                                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{qSubs.length} attempt{qSubs.length !== 1 ? 's' : ''}</p>
                                       </div>
                                       <div className="flex items-center space-x-4">
                                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                             <div className={`h-full rounded-full ${qRate >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${qRate}%` }} />
                                          </div>
                                          <span className={`text-sm font-black ${qRate >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{qRate}%</span>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     )}
                  </Card>
               ))
            )}
         </div>
      );
   };

   const ModuleIntelligenceView = () => {
      if (!selectedQuiz) return null;

      const quizSubmissions = submissions.filter(s => s.quizId === selectedQuiz.id);
      const completed = quizSubmissions.filter(s => s.status === 'completed');
      const passRate = calcPassRate(completed);
      const avgScoreRaw = completed.length > 0 
         ? completed.reduce((acc, s) => acc + (s.correctCount || 0), 0) / completed.length 
         : 0;
      
      const highestScore = completed.length > 0
         ? Math.max(...completed.map(s => s.score))
         : 0;

      const filtered = quizSubmissions.filter(s => 
         s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div>
                  <div className="flex items-center space-x-3 mb-2">
                     <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{selectedQuiz.title}</h1>
                     <span className="bg-primary-100 text-primary-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                        Level {selectedQuiz.level || '100'}
                     </span>
                  </div>
                  <p className="text-slate-500 font-medium text-sm">{selectedQuiz.description}</p>
               </div>
               <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                     
                     <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none w-full shadow-sm"
                     />
                  </div>
               </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                  { label: 'Candidates', value: quizSubmissions.length },
                  { label: 'Avg Pass Rate', value: `${passRate}%` },
                  { label: 'Avg Score', value: `${Math.round(avgScoreRaw)} / ${selectedQuiz.totalQuestions || '?' }` },
                  { label: 'Highest Score', value: `${highestScore} Pts` },
               ].map((s, i) => (
                  <Card key={i} className="p-5 border-none shadow-lg shadow-slate-200/50">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                     <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  </Card>
               ))}
            </div>

            {/* Results Table */}
            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
               <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate Performance Registry</h2>
                  <span className="text-[10px] font-bold text-slate-400">{filtered.length} Results Found</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                        <tr>
                           <th className="px-6 py-4">Identity</th>
                           <th className="px-6 py-4">Institution</th>
                           <th className="px-6 py-4">Status</th>
                           <th className="px-6 py-4">Score</th>
                           <th className="px-6 py-4">Accuracy</th>
                           <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 text-sm font-medium text-slate-600">
                        {filtered.length === 0 ? (
                           <tr><td colSpan={6} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest">No matching records found</td></tr>
                        ) : (
                           filtered.map(s => {
                              const accuracy = s.correctCount !== undefined && s.totalQuestions
                                 ? Math.round((s.correctCount / s.totalQuestions) * 100)
                                 : Math.round((s.score / s.totalPossible) * 100);
                              
                              return (
                                 <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                       <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase">
                                             {s.studentName.charAt(0)}
                                          </div>
                                          <span className="font-bold text-slate-900">{s.studentName}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight">{s.studentInstitution || 'General'}</td>
                                    <td className="px-6 py-4">
                                       <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                          {s.status}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="font-mono font-black text-slate-900">{s.score}</span>
                                       <span className="text-slate-300 mx-1">/</span>
                                       <span className="text-slate-400 text-xs">{s.totalPossible}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                             <div className={`h-full rounded-full ${accuracy >= 50 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${accuracy}%` }} />
                                          </div>
                                          <span className={`text-xs font-black ${accuracy >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{accuracy}%</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end gap-2">
                                          <button onClick={() => handleOverrideGrade(s.id, s.score, s.totalPossible)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><i className="fas fa-edit"></i></button>
                                          <button onClick={() => handleReset(s.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><i className="fas fa-undo"></i></button>
                                       </div>
                                    </td>
                                 </tr>
                              );
                           })
                        )}
                     </tbody>
                  </table>
               </div>
            </Card>
         </div>
      );
   };

   // ─── Render ─────────────────────────────────────────────────────────────────

   return (
      <div className="min-h-screen bg-slate-50">
         <Navbar />
         <Container>
            {/* Page header */}
            <div className="mb-8">
               {filterQuizId ? (
                   <Link 
                      to={selectedQuiz?.institution 
                        ? `/admin/institution/${encodeURIComponent(selectedQuiz.institution)}` 
                        : `/admin/level/${selectedQuiz?.level || '100'}`}
                      className="text-primary-600 text-sm font-bold flex items-center mb-3 hover:translate-x-[-4px] transition-transform w-fit"
                   >
                       <i className="fas fa-arrow-left mr-2"></i> Back to Level Management
                   </Link>
               ) : (
                  <button 
                     onClick={() => window.history.back()}
                     className="text-primary-600 text-sm font-bold flex items-center mb-3 hover:translate-x-[-4px] transition-transform w-fit"
                  >
                      <i className="fas fa-arrow-left mr-2"></i> Back to Previous Page
                  </button>
               )}
               {!filterQuizId && (
                  <>
                     <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Analytics & Reports</h1>
                     <p className="text-slate-500 font-medium mt-1">
                        {isSuperAdmin ? 'Platform-wide academic intelligence.' : `Scoped to Level${allowedLevels.length > 1 ? 's' : ''} ${allowedLevels.join(', ')}.`}
                     </p>
                  </>
               )}
            </div>

            {loading ? (
               <Card className="p-24 text-center border-none shadow-xl shadow-slate-200/50">
                  <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synchronizing Records...</p>
               </Card>
            ) : filterQuizId ? (
               <ModuleIntelligenceView />
            ) : (
               <>
                  {/* Tabs only shown in general mode */}
                  <div className="flex space-x-1 bg-white border border-slate-200 rounded-2xl p-1.5 mb-8 shadow-sm overflow-x-auto">
                     {tabs.map(tab => (
                        <button
                           key={tab.id}
                           onClick={() => setActiveTab(tab.id)}
                           className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex-1 justify-center ${
                              activeTab === tab.id
                                 ? 'bg-slate-900 text-white shadow-lg'
                                 : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                           }`}
                        >
                           
                           <span>{tab.label}</span>
                        </button>
                     ))}
                  </div>

                  {activeTab === 'overview'    && <OverviewTab />}
                  {activeTab === 'results'     && <ExamResultsTab />}
                  {activeTab === 'institution' && isSuperAdmin && <InstitutionTab />}
                  {activeTab === 'levels'      && <LevelPerformanceTab />}
               </>
            )}
         </Container>
      </div>
   );
};

export default Reports;

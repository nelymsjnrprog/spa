import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams, Navigate, useNavigate } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { quizService } from '../services/quizService';
import { userService } from '../services/userService';
import { submissionService } from '../services/submissionService';
import { adminService } from '../services/adminService';
import { Quiz, UserProfile, Submission } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { institutionService, Institution } from '../services/institutionService';
import { generateStudentInfoPDF } from '../utils/pdfGenerator';

const LevelManagement: React.FC = () => {
   const { level: levelParam, institutionName } = useParams<{ level?: string, institutionName?: string }>();
   const navigate = useNavigate();
   const [selectedLevel, setSelectedLevel] = useState<string>(levelParam || '100');
   const level = selectedLevel; // Alias for compatibility with existing logic
   const { profile } = useAuth();
   const [quizzes, setQuizzes] = useState<Quiz[]>([]);
   const [students, setStudents] = useState<UserProfile[]>([]);
   const [submissions, setSubmissions] = useState<Submission[]>([]);
   const [institutions, setInstitutions] = useState<Institution[]>([]);
   const [loading, setLoading] = useState(true);
   const [searchQuery, setSearchQuery] = useState('');
   const [promotingAll, setPromotingAll] = useState(false);
   const [activeTab, setActiveTab] = useState<'exams' | 'registry' | 'paid' | 'unpaid'>('exams');
   
   // Quiz Modal State
   const [showModal, setShowModal] = useState(false);
   const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
   
   // Form State (Same as QuizManagement)
   const [subjectTitle, setSubjectTitle] = useState('');
   const [title, setTitle] = useState('');
   const [desc, setDesc] = useState('');
   const [time, setTime] = useState(30);
   const [optionsCount, setOptionsCount] = useState(4);
   const [lockCode, setLockCode] = useState('');
   const [restrictScreenshot, setRestrictScreenshot] = useState(false);
   const [restrictCopyPaste, setRestrictCopyPaste] = useState(false);
   const [restrictTabSwitch, setRestrictTabSwitch] = useState(false);
   const [enforceFullscreen, setEnforceFullscreen] = useState(false);
   const [disableTextSelection, setDisableTextSelection] = useState(false);
   const [disableRightClick, setDisableRightClick] = useState(false);
   const [watermarkEnabled, setWatermarkEnabled] = useState(false);
   const [movingWatermark, setMovingWatermark] = useState(false);
   const [blurOnTabLeave, setBlurOnTabLeave] = useState(false);
   const [canvasRendering, setCanvasRendering] = useState(false);
   const [shuffleQuestions, setShuffleQuestions] = useState(false);
   const [shuffleOptions, setShuffleOptions] = useState(false);
   const [showResults, setShowResults] = useState(true);
   const [availableFrom, setAvailableFrom] = useState('');
   const [availableUntil, setAvailableUntil] = useState('');
   const [selectedInstitution, setSelectedInstitution] = useState('');
   const [allowedUsers, setAllowedUsers] = useState('');
   const [questionsPerPage, setQuestionsPerPage] = useState(1);
   const [minSubmissionPercentage, setMinSubmissionPercentage] = useState<number>(0);
   const [defaultMarkPerQuestion, setDefaultMarkPerQuestion] = useState<number>(1);
   const [allowedPrograms, setAllowedPrograms] = useState<string[]>([]);

   const effectivePerm = adminService.getEffectivePermission(profile);
   const canManage = level ? adminService.canManageLevel(profile, level) : false;
   const canWrite = adminService.canWrite(profile);
   const isSuperAdmin = effectivePerm === 'super_admin';


   useEffect(() => {
      if (levelParam && levelParam !== selectedLevel) {
         setSelectedLevel(levelParam);
      }
   }, [levelParam]);

   useEffect(() => {
      if (!level) return;

      const unsubQuizzes = quizService.subscribeToQuizzes((data) => {
         setQuizzes(data.filter(q => {
            // Filter by Level
            const quizLevel = q.level || '';
            const targetLevel = level || '';
            const matchesLevel = targetLevel.toLowerCase() === 'candidate' 
               ? (quizLevel.toLowerCase() === 'candidate' || quizLevel === '400')
               : (quizLevel.toLowerCase() === targetLevel.toLowerCase());
            
            if (!matchesLevel) return false;

            // Filter by Institution
            if (institutionName) {
               const decodedInst = decodeURIComponent(institutionName).trim().toLowerCase();
               return (q.institution || '').trim().toLowerCase() === decodedInst;
            }
            return true;
         }));
         setLoading(false);
      });

      const unsubUsers = userService.subscribeToUsers((data) => {
         setStudents(data.filter(u => {
            if (u.role !== 'student') return false;
            
            // Filter by Level
            const userLevel = u.level || '100';
            const targetLevel = level || '100';
            const matchesLevel = targetLevel.toLowerCase() === 'candidate'
               ? (userLevel.toLowerCase() === 'candidate' || userLevel === '400')
               : (userLevel.toLowerCase() === targetLevel.toLowerCase());
            
            if (!matchesLevel) return false;

            // Filter by Institution
            if (institutionName) {
               const decodedInst = decodeURIComponent(institutionName).trim().toLowerCase();
               return (u.institution || '').trim().toLowerCase() === decodedInst;
            }
            return true;
         }));
      });

      const unsubSubs = submissionService.subscribeToAllSubmissions((data) => {
         setSubmissions(data);
      });

      const unsubInst = institutionService.subscribeToInstitutions(setInstitutions);

      return () => {
         unsubQuizzes();
         unsubUsers();
         unsubSubs();
         unsubInst();
      };
   }, [level, institutionName]);

   // Only redirect for old /admin/level/:level routes with invalid levels
   if (!institutionName && (!level || !['100', '200', '300', 'Candidate'].includes(level))) {
      return <Navigate to="/admin" replace />;
   }

   if (!canManage) {
      return (
         <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
               <div className="flex flex-col items-center justify-center py-32">
                  
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Level {level} — Access Denied</h1>
                  <p className="text-slate-500">You don't have permission to manage this level.</p>
                  <Link to="/admin" className="mt-6 text-primary-600 font-bold hover:underline">
                     Back to Dashboard
                  </Link>
               </div>
            </Container>
         </div>
      );
   }

   const levelQuizzes = quizzes;
   const publishedCount = levelQuizzes.filter(q => q.published).length;

   // Get submissions for quizzes at this level
   const levelQuizIds = new Set(levelQuizzes.map(q => q.id));
   const levelSubmissions = submissions.filter(s => levelQuizIds.has(s.quizId));
   const completedSubmissions = levelSubmissions.filter(s => s.status === 'completed');
   const avgScore = completedSubmissions.length > 0
      ? Math.round((completedSubmissions.reduce((a, s) => a + ((s.correctCount !== undefined && s.totalQuestions) ? (s.correctCount / s.totalQuestions) : (s.score / s.totalPossible)), 0) / completedSubmissions.length) * 100)
      : 0;

    const handlePromoteStudent = async (student: UserProfile) => {
       if (student.level === 'Candidate') return;
       
       let nextLevel = '';
       if (student.level === '300') {
          nextLevel = 'Candidate';
       } else {
          const currentLevelNum = parseInt(student.level || '100');
          nextLevel = (currentLevelNum + 100).toString();
       }

       const nextLevelLabel = nextLevel === 'Candidate' ? 'Candidate' : `Level ${nextLevel}`;
       if (!confirm(`Promote ${student.displayName} to ${nextLevelLabel}?`)) return;

       try {
          await userService.updateUserProfile(student.uid, { level: nextLevel });
          await adminService.logAction(
             profile!.uid,
             profile!.displayName,
             'Promoted Student',
             `Promoted ${student.displayName} from ${student.level === 'Candidate' ? 'Candidate' : 'Level ' + student.level} to ${nextLevelLabel}`,
             level
          );
       } catch (err) {
          alert("Failed to promote student.");
       }
    };

    const handlePromoteAll = async () => {
       if (!isSuperAdmin || promotingAll || level === 'Candidate') return;
       
       let nextLevel = '';
       if (level === '300') {
          nextLevel = 'Candidate';
       } else {
          nextLevel = (parseInt(level) + 100).toString();
       }

       const nextLevelLabel = nextLevel === 'Candidate' ? 'Candidate' : `Level ${nextLevel}`;
       if (!confirm(`Are you sure you want to promote ALL ${students.length} students to ${nextLevelLabel}?`)) return;

       setPromotingAll(true);
       try {
          const results = await Promise.all(students.map(u => 
             userService.updateUserProfile(u.uid, { level: nextLevel })
          ));
         alert(`Success! ${results.length} students promoted.`);
      } catch (err) {
         console.error(err);
         alert("Promotion failed for one or more students.");
      } finally {
         setPromotingAll(false);
      }
   };

   const handleViewStudentInfo = (student: UserProfile) => {
      generateStudentInfoPDF(student);
   };

   const handleBlockToggle = async (student: UserProfile) => {
      const newStatus = !student.isBlocked;
      const action = newStatus ? 'BLOCK' : 'UNBLOCK';
      if (!confirm(`Are you sure you want to ${action} ${student.displayName}?`)) return;

      try {
         await userService.updateUserProfile(student.uid, { isBlocked: newStatus });
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            `${action} Student`,
            `${action}ed ${student.displayName} in Level ${level}`,
            level
         );
      } catch (err) {
         alert("Failed to update student status.");
      }
   };

   const handleDeleteUser = async (student: UserProfile) => {
      if (!confirm(`WARNING: Are you sure you want to PERMANENTLY delete ${student.displayName}?\n\nThis will remove their profile and all their exam submissions.`)) return;
      if (!confirm("This action CANNOT be undone. Click OK to confirm deletion.")) return;

      try {
         await userService.deleteUserData(student.uid);
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Deleted Student',
            `Permanently removed student ${student.displayName} from Level ${level}`,
            level
         );
      } catch (err) {
         alert("Failed to delete student.");
      }
   };

   // Quiz Actions
   const handleOpenCreate = () => {
      setEditingQuiz(null);
      resetForm();
      // Auto-set institution when creating from institution page
      if (institutionName) setSelectedInstitution(institutionName);
      setShowModal(true);
   };

   const handleOpenEdit = (quiz: Quiz) => {
      setEditingQuiz(quiz);
      setSubjectTitle(quiz.subjectTitle || '');
      setTitle(quiz.title);
      setDesc(quiz.description);
      setAllowedPrograms(quiz.allowedPrograms || []);
      setTime(quiz.timeLimit);
      setOptionsCount(quiz.defaultOptionsCount || 4);
      setLockCode(quiz.lockCode || '');
      setRestrictScreenshot(!!quiz.restrictScreenshot);
      setRestrictCopyPaste(!!quiz.restrictCopyPaste);
      setRestrictTabSwitch(!!quiz.restrictTabSwitch);
      setEnforceFullscreen(!!quiz.enforceFullscreen);
      setDisableTextSelection(!!quiz.disableTextSelection);
      setDisableRightClick(!!quiz.disableRightClick);
      setWatermarkEnabled(!!quiz.watermarkEnabled);
      setMovingWatermark(!!quiz.movingWatermark);
      setBlurOnTabLeave(!!quiz.blurOnTabLeave);
      setCanvasRendering(!!quiz.canvasRendering);
      setShuffleQuestions(!!quiz.shuffleQuestions);
      setShuffleOptions(!!quiz.shuffleOptions);
      setShowResults(quiz.showResults ?? true);
      setAvailableFrom(quiz.availableFrom ? new Date(quiz.availableFrom).toISOString().slice(0, 16) : '');
      setAvailableUntil(quiz.availableUntil ? new Date(quiz.availableUntil).toISOString().slice(0, 16) : '');
      setSelectedInstitution(quiz.institution || '');
      setAllowedUsers(quiz.allowedUsers ? quiz.allowedUsers.join(', ') : '');
      setQuestionsPerPage(quiz.questionsPerPage || 0);
      setMinSubmissionPercentage(quiz.minSubmissionPercentage || 0);
      setDefaultMarkPerQuestion(quiz.defaultMarkPerQuestion || 1);
      setShowModal(true);
   };

   const handleSubmitQuiz = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile || !level) return;
      try {
         const quizData = {
            subjectTitle,
            title,
            description: desc,
            allowedPrograms,
            timeLimit: time,
            defaultOptionsCount: optionsCount,
            lockCode: lockCode.trim() || "",
            restrictScreenshot,
            restrictCopyPaste,
            restrictTabSwitch,
            enforceFullscreen,
            disableTextSelection,
            disableRightClick,
            watermarkEnabled,
            movingWatermark,
            blurOnTabLeave,
            canvasRendering,
            showResults,
            availableFrom: availableFrom ? new Date(availableFrom).getTime() : undefined,
            availableUntil: availableUntil ? new Date(availableUntil).getTime() : undefined,
            institution: institutionName ? decodeURIComponent(institutionName) : (selectedInstitution || ""),
            level: level, // Locked to current level
            allowedUsers: allowedUsers ? allowedUsers.split(',').map(email => email.trim()).filter(Boolean) : [],
            questionsPerPage: Number(questionsPerPage) || 0,
            shuffleQuestions,
            shuffleOptions,
            minSubmissionPercentage: Number(minSubmissionPercentage) || 0,
            defaultMarkPerQuestion: Number(defaultMarkPerQuestion) || 1
         };

         let quizId = editingQuiz?.id;
         if (editingQuiz) {
            await quizService.updateQuiz(editingQuiz.id, quizData);
            await adminService.logAction(profile.uid, profile.displayName, 'Updated Quiz', `Updated quiz "${title}" in Level ${level}`, level);
         } else {
            quizId = await quizService.createQuiz(quizData, profile.uid);
            await adminService.logAction(profile.uid, profile.displayName, 'Created Quiz', `Created new quiz "${title}" in Level ${level}`, level);
         }

         setShowModal(false);
         resetForm();

         if (quizId) {
            navigate(`/admin/questions/${quizId}`);
         }
      } catch (err) {
         alert("Error saving quiz.");
      }
   };

   const resetForm = () => {
      setSubjectTitle('');
      setTitle('');
      setDesc('');
      setTime(30);
      setOptionsCount(4);
      setLockCode('');
      setRestrictScreenshot(false);
      setRestrictCopyPaste(false);
      setRestrictTabSwitch(false);
      setEnforceFullscreen(false);
      setDisableTextSelection(false);
      setDisableRightClick(false);
      setWatermarkEnabled(false);
      setMovingWatermark(false);
      setBlurOnTabLeave(false);
      setCanvasRendering(false);
      setShowResults(true);
      setAvailableFrom('');
      setAvailableUntil('');
      setSelectedInstitution(institutionName || '');
      setAllowedUsers('');
      setQuestionsPerPage(1);
      setShuffleQuestions(false);
      setShuffleOptions(false);
      setMinSubmissionPercentage(0);
      setDefaultMarkPerQuestion(1);
      setAllowedPrograms([]);
   };

   const togglePublish = async (quiz: Quiz) => {
      const isPublishing = !quiz.published;
      await quizService.updateQuiz(quiz.id, {
         published: isPublishing,
         status: isPublishing ? 'active' : 'draft'
      });
      await adminService.logAction(profile!.uid, profile!.displayName, isPublishing ? 'Published Quiz' : 'Unpublished Quiz', `${isPublishing ? 'Published' : 'Unpublished'} quiz "${quiz.title}" in Level ${level}`, level!);
   };

   const handleDeleteQuiz = async (id: string) => {
      if (!confirm("PERMANENT DELETION WARNING: This will delete the quiz and all its results. Proceed?")) return;
      try {
         await quizService.deleteQuiz(id);
         await adminService.logAction(profile!.uid, profile!.displayName, 'Deleted Quiz', `Permanently deleted quiz ${id} from Level ${level}`, level!);
      } catch (err) {
         alert("Deletion failed.");
      }
   };



   const filteredStudents = students.filter(s => {
      const search = searchQuery.toLowerCase();
      return (
         (s.displayName || "").toLowerCase().includes(search) ||
         (s.email || "").toLowerCase().includes(search)
      );
   });

   const displayStudents = useMemo(() => {
      if (activeTab === 'paid') {
         return filteredStudents.filter(s => s.paid || s.membershipStatus === 'active');
      }
      if (activeTab === 'unpaid') {
         return filteredStudents.filter(s => !s.paid && s.membershipStatus !== 'active');
      }
      return filteredStudents;
   }, [filteredStudents, activeTab]);

   return (
      <div className="min-h-screen bg-slate-50">
         <Navbar />
         <Container>
            <div className="mb-8">

               <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">

                   Back to Dashboard

               </Link>

               {institutionName ? (

                  <>

                     <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center">

                        <i className="fas fa-university text-primary-500 mr-3"></i>

                        {decodeURIComponent(institutionName)}

                     </h1>

                     <p className="text-slate-500 font-medium text-sm mt-1">Institution Management &mdash; {students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>

                  </>

               ) : (

                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">

                     {level === 'Candidate' ? 'Candidate' : `Level ${level}`} Management

                  </h1>

               )}

            </div>


            {/* Level Selection Tabs (Institution Mode) */}

            {institutionName && (

               <div className="mb-6 flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit">

                  {['100', '200', '300', 'Candidate'].map(lvl => (

                     <button

                        key={lvl}

                        onClick={() => setSelectedLevel(lvl)}

                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${

                           selectedLevel === lvl

                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'

                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'

                        }`}

                     >

                        {lvl === 'Candidate' ? 'Candidate' : `Level ${lvl}`}

                     </button>

                  ))}

               </div>

            )}

            {/* Top Toolbar - Tab Switches */}
            <div className="mb-10 flex flex-wrap items-center gap-4">
               <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-200/60 backdrop-blur-sm shadow-inner w-fit">
                  {[
                     { id: 'exams', label: 'Exams' },
                     { id: 'registry', label: 'Student Registry' },
                     { id: 'paid', label: 'Paid Students' },
                     { id: 'unpaid', label: 'Unpaid Students' }
                  ].map((tab) => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                           activeTab === tab.id 
                              ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                        }`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>

               {isSuperAdmin && level !== 'Candidate' && students.length > 0 && (
                  <button
                     onClick={handlePromoteAll}
                     disabled={promotingAll}
                     className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                     {promotingAll ? 'Processing...' : `Promote All to ${level === '300' ? 'Candidate' : 'L' + (parseInt(level) + 100)}`}
                  </button>
               )}
            </div>

            <div className="space-y-12">
               {activeTab === 'exams' && (
                  <section className="animate-in fade-in slide-in-from-bottom-4">
                     <div className="flex items-center justify-between mb-8">
                        <div>

                           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 tracking-widest">{level === 'Candidate' ? 'Candidate' : `Level ${level}`} Modules</p>
                        </div>
                        {canWrite && (
                           <button 
                              onClick={handleOpenCreate}
                              className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg"
                           >
                              New Exam
                           </button>
                        )}
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {loading ? (
                           <div className="col-span-full p-20 text-center text-slate-400 animate-pulse font-bold uppercase tracking-widest text-xs">Accessing encrypted modules...</div>
                        ) : levelQuizzes.length === 0 ? (
                           <div className="col-span-full p-20 text-center text-slate-400 text-sm font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-[2rem]">No active modules for Level {level}.</div>
                        ) : (
                           levelQuizzes.map(quiz => (
                              <Card key={quiz.id} className="p-8 border-none shadow-2xl shadow-slate-200/40 hover:translate-y-[-4px] transition-all group relative bg-white rounded-[2rem]">
                                 <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleOpenEdit(quiz)} className="p-2 text-slate-400 hover:text-primary-600 font-bold text-[10px] uppercase">Edit</button>
                                    <button onClick={() => handleDeleteQuiz(quiz.id)} className="p-2 text-slate-400 hover:text-red-500 font-bold text-[10px] uppercase">Delete</button>
                                 </div>
                                 
                                 <div className="mb-6">
                                    <h3 className="font-black text-slate-900 text-xl leading-tight mb-1">{quiz.title}</h3>
                                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-3">{quiz.subjectTitle}</p>
                                    <p className="text-sm text-slate-500 font-medium line-clamp-2">{quiz.description}</p>
                                 </div>

                                 <div className="flex flex-wrap gap-3 mb-8">
                                    <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider ${quiz.published ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                       {quiz.published ? 'Live' : 'Draft'}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg">
                                       {quiz.timeLimit}m
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg">
                                       {quiz.totalQuestions} Qs
                                    </span>
                                 </div>

                                 <div className="grid grid-cols-2 gap-3">
                                    <Link to={`/admin/questions/${quiz.id}`} className="py-3.5 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center hover:bg-primary-50 hover:text-primary-600 transition-all">
                                       Questions
                                    </Link>
                                    <Link to={`/admin/reports?quizId=${quiz.id}`} className="py-3.5 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center hover:bg-primary-50 hover:text-primary-600 transition-all">
                                       Analysis
                                    </Link>
                                    <Link to={`/admin/live-monitor/${quiz.id}`} className="py-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center hover:bg-emerald-600 hover:text-white transition-all col-span-2">
                                       Live Monitor
                                    </Link>
                                    <button 
                                       onClick={() => togglePublish(quiz)}
                                       className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center transition-all col-span-2 mt-1 ${quiz.published ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-primary-600 text-white shadow-xl shadow-primary-200'}`}
                                    >
                                       {quiz.published ? 'Stop Distribution' : 'Publish to Level'}
                                    </button>
                                 </div>
                              </Card>
                           ))
                        )}
                     </div>
                  </section>
               )}

               {activeTab !== 'exams' && (
                  <section className="animate-in fade-in slide-in-from-bottom-4">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                        <div>

                           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Level {level} Academic Oversight</p>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full sm:w-80">
                           <input 
                              type="text"
                              placeholder="Search candidate..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:ring-4 focus:ring-primary-50 outline-none shadow-sm transition-all"
                           />
                        </div>
                     </div>

                     <Card className="overflow-hidden border-none shadow-2xl shadow-slate-200/50 bg-white rounded-[2rem]">
                        <div className="overflow-x-auto">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                 <tr>
                                    <th className="px-8 py-5">Identity</th>
                                    <th className="px-8 py-5">Joined</th>
                                    {isSuperAdmin && <th className="px-8 py-5 text-right">Actions</th>}
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {displayStudents.length === 0 ? (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest">No matching records found</td></tr>
                                 ) : (
                                    displayStudents
                                       .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
                                       .map(u => (
                                          <tr key={u.uid} className={`transition-colors group ${u.isBlocked ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                                             <td className="px-8 py-6">
                                                <div className="flex items-center">
                                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black mr-4 shadow-sm transition-all ${u.isBlocked ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-600 group-hover:bg-slate-900 group-hover:text-white'}`}>
                                                      {(u.displayName || "U").charAt(0)}
                                                   </div>
                                                   <div>
                                                      <div className="flex items-center space-x-2">
                                                         <p className={`font-black tracking-tight ${u.isBlocked ? 'text-red-900' : 'text-slate-900'}`}>{u.displayName || "Unnamed User"}</p>
                                                         {u.isBlocked && <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Blocked</span>}
                                                      </div>
                                                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{u.email}</p>
                                                   </div>
                                                </div>
                                             </td>

                                             <td className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Legacy'}
                                             </td>
                                             {isSuperAdmin && (
                                                <td className="px-8 py-6 text-right space-x-4">
                                                   <button
                                                      onClick={() => handleViewStudentInfo(u)}
                                                      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
                                                   >
                                                      View Info
                                                   </button>
                                                   <button
                                                       onClick={() => handlePromoteStudent(u)}
                                                       disabled={u.level === 'Candidate'}
                                                       className={`text-[10px] font-black uppercase tracking-widest transition-colors ${u.level !== 'Candidate' ? 'text-primary-600 hover:text-primary-800' : 'text-slate-300 cursor-not-allowed'}`}
                                                    >
                                                      {parseInt(u.level || '100') < 300 ? `To L${parseInt(u.level || '100') + 100}` : u.level === '300' ? 'To CANDIDATE' : 'MAX'}
                                                   </button>
                                                   <button
                                                      onClick={() => handleBlockToggle(u)}
                                                      className={`text-[10px] font-black uppercase tracking-widest transition-colors ${u.isBlocked ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-500 hover:text-red-700'}`}
                                                   >
                                                      {u.isBlocked ? 'Unblock' : 'Block'}
                                                   </button>
                                                   <button
                                                      onClick={() => handleDeleteUser(u)}
                                                      className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors"
                                                   >
                                                      Remove
                                                   </button>
                                                </td>
                                             )}
                                          </tr>
                                       ))
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </Card>
                  </section>
               )}
            </div>

         {/* Quiz Creation / Edit — Full Page Slide-over */}
         {showModal && (
            <div className="fixed inset-0 bg-slate-50 z-[200] overflow-y-auto animate-in slide-in-from-right duration-500 flex flex-col">
               <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                     <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{editingQuiz ? 'Edit Exam' : 'New Exam'}</h2>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {institutionName ? decodeURIComponent(institutionName) + ' \u2014 ' : ''}{level === 'Candidate' ? 'Candidate' : `Level ${level}`}
                     </p>
                  </div>
                  <button
                     onClick={() => setShowModal(false)}
                     className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition font-black text-[10px] uppercase tracking-widest"
                  >
                     Cancel
                  </button>
               </div>

               <Container className="py-12 max-w-4xl">
                  <form onSubmit={handleSubmitQuiz} className="space-y-10">
                     <div className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
                        <div className="space-y-6">
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exam Title</label>
                              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200 font-bold" placeholder="e.g. Mid-Semester Exam" required />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject Title</label>
                              <input type="text" value={subjectTitle} onChange={e => setSubjectTitle(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200 font-bold" placeholder="e.g. Medical Surgical Nursing" required />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Curriculum Overview</label>
                              <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200 font-medium min-h-[100px]" placeholder="Brief description for student dashboard..." required />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Default Answer Options</label>
                              <div className="flex gap-2 h-[54px]">
                                 {[
                                    { count: 2, label: 'A \u2014 B', desc: '2 Ops' },
                                    { count: 3, label: 'A \u2014 C', desc: '3 Ops' },
                                    { count: 4, label: 'A \u2014 D', desc: '4 Ops' },
                                 ].map(opt => (
                                    <button
                                       key={opt.count}
                                       type="button"
                                       onClick={() => setOptionsCount(opt.count)}
                                       className={`flex-1 rounded-2xl border-2 text-center transition-all ${
                                          optionsCount === opt.count
                                             ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-200'
                                             : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'
                                       }`}
                                    >
                                       <span className="block text-xs font-black">{opt.label}</span>
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="mt-8 space-y-8">
                           <section>
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                 Scheduling & Access
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-[2rem]">
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Duration (Minutes)</label>
                                    <input type="number" value={time} onChange={e => setTime(Number(e.target.value))} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-bold" required min="1" />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Lock Code (Optional)</label>
                                    <input type="text" value={lockCode} onChange={e => setLockCode(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-bold" placeholder="e.g. SECRET123" />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Available From</label>
                                    <input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-bold" />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Available Until</label>
                                    <input type="datetime-local" value={availableUntil} onChange={e => setAvailableUntil(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-bold" />
                                 </div>
                              </div>
                           </section>

                           <section>
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                 Target Audience
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-[2rem]">
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Target Programs</label>
                                    <div className="flex flex-wrap gap-2">
                                       {['RCN', 'RGN', 'RMN', 'RPHN'].map(prog => (
                                          <button
                                             key={prog}
                                             type="button"
                                             onClick={() => {
                                                if (allowedPrograms.includes(prog)) {
                                                   setAllowedPrograms(allowedPrograms.filter(p => p !== prog));
                                                } else {
                                                   setAllowedPrograms([...allowedPrograms, prog]);
                                                }
                                             }}
                                             className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${allowedPrograms.includes(prog) ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200' : 'bg-white text-slate-400 border-white hover:border-slate-200'}`}
                                          >
                                             {prog}
                                          </button>
                                       ))}
                                    </div>
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Direct Assignments</label>
                                    <input type="text" value={allowedUsers} onChange={e => setAllowedUsers(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm" placeholder="Emails separated by commas..." />
                                 </div>
                              </div>
                           </section>

                           <section>
                               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                  <i className="fas fa-shield-alt mr-2 text-slate-400"></i> SECURITY ENFORCEMENT
                               </h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 bg-slate-50 rounded-[2rem]">
                                  {[
                                     { label: 'SCREENSHOT BLOCK', state: restrictScreenshot, toggle: () => setRestrictScreenshot(!restrictScreenshot), onIcon: 'fa-lock', offIcon: 'fa-unlock-alt' },
                                     { label: 'COPY/PASTE BLOCK', state: restrictCopyPaste, toggle: () => setRestrictCopyPaste(!restrictCopyPaste), onIcon: 'fa-lock', offIcon: 'fa-unlock-alt' },
                                     { label: 'TAB SWITCH ALERTS', state: restrictTabSwitch, toggle: () => setRestrictTabSwitch(!restrictTabSwitch), onIcon: 'fa-eye', offIcon: 'fa-eye-slash' },
                                     { label: 'AUTH FULLSCREEN', state: enforceFullscreen, toggle: () => setEnforceFullscreen(!enforceFullscreen), onIcon: 'fa-expand-arrows-alt', offIcon: 'fa-compress' },
                                     { label: 'DISABLE SELECTION', state: disableTextSelection, toggle: () => setDisableTextSelection(!disableTextSelection), onIcon: 'fa-mouse-pointer', offIcon: 'fa-i-cursor' },
                                     { label: 'DISABLE RIGHT-CLICK', state: disableRightClick, toggle: () => setDisableRightClick(!disableRightClick), onIcon: 'fa-ban', offIcon: 'fa-mouse' },
                                     { label: 'WATERMARK', state: watermarkEnabled, toggle: () => setWatermarkEnabled(!watermarkEnabled), onIcon: 'fa-stamp', offIcon: 'fa-ghost' },
                                     { label: 'MOVING WATERMARK', state: movingWatermark, toggle: () => setMovingWatermark(!movingWatermark), onIcon: 'fa-running', offIcon: 'fa-stop' },
                                     { label: 'BLUR ON TAB LEAVE', state: blurOnTabLeave, toggle: () => setBlurOnTabLeave(!blurOnTabLeave), onIcon: 'fa-mask', offIcon: 'fa-eye' },
                                     { label: 'CANVAS QUESTIONS', state: canvasRendering, toggle: () => setCanvasRendering(!canvasRendering), onIcon: 'fa-paint-brush', offIcon: 'fa-font' },
                                     { label: 'SHUFFLE QUESTIONS', state: shuffleQuestions, toggle: () => setShuffleQuestions(!shuffleQuestions), onIcon: 'fa-random', offIcon: 'fa-list-ol' },
                                     { label: 'SHUFFLE OPTIONS', state: shuffleOptions, toggle: () => setShuffleOptions(!shuffleOptions), onIcon: 'fa-layer-group', offIcon: 'fa-align-left' },
                                  ].map(({ label, state, toggle, onIcon, offIcon }) => (
                                     <button
                                        key={label}
                                        type="button"
                                        onClick={toggle}
                                        className={`p-4 rounded-2xl border-2 flex items-center justify-between transition ${state ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-white text-slate-400 hover:border-primary-100'}`}
                                     >
                                        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                        <i className={`fas ${state ? onIcon : offIcon} text-sm`}></i>
                                     </button>
                                  ))}
                               </div>
                            </section>
 
                            <section>
                               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                  <i className="fas fa-cog mr-2 text-slate-400"></i> CONFIGURATION
                               </h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem]">
                                  <div>
                                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Questions Per Page</label>
                                     <div className="flex flex-wrap gap-2">
                                        {[0, 1, 2, 5, 10].map(num => (
                                           <button
                                              key={num}
                                              type="button"
                                              onClick={() => setQuestionsPerPage(num)}
                                              className={`flex-1 min-w-[40px] py-3 rounded-xl border-2 font-black text-[10px] transition ${questionsPerPage === num ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white border-white text-slate-400 hover:border-slate-200'}`}
                                           >
                                              {num === 0 ? 'ALL' : num}
                                           </button>
                                        ))}
                                     </div>
                                  </div>
                                  <div>
                                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Required Answers %</label>
                                     <div className="relative">
                                        <input
                                           type="number"
                                           value={minSubmissionPercentage}
                                           onChange={e => setMinSubmissionPercentage(Number(e.target.value))}
                                           className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-bold"
                                           min="0"
                                           max="100"
                                           placeholder="e.g. 100"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</div>
                                     </div>
                                  </div>
                               </div>
                            </section>
                        </div>

                        <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-primary-600 shadow-xl transition-all mt-10">
                           {editingQuiz ? 'Update Exam' : 'Deploy Exam'}
                        </button>
                     </div>
                  </form>
               </Container>
            </div>
         )}
         </Container>
      </div>
   );
};

export default LevelManagement;

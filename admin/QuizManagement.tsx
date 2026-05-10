import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Navbar, Container, Card, Modal } from '../ui/Layout';
import { quizService } from '../services/quizService';
import { Quiz } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { institutionService, Institution } from '../services/institutionService';
import { adminService } from '../services/adminService';

const QuizManagement: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const effectivePerm = adminService.getEffectivePermission(profile);
  const isSuperAdmin = effectivePerm === 'super_admin';

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [subjectTitle, setSubjectTitle] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState(30);
  const [optionsCount, setOptionsCount] = useState(4); // Default to 4 options
  const [lockCode, setLockCode] = useState('');
  const [quizCode, setQuizCode] = useState('');
  const [restrictScreenshot, setRestrictScreenshot] = useState(false);
  const [restrictCopyPaste, setRestrictCopyPaste] = useState(false);
  const [restrictTabSwitch, setRestrictTabSwitch] = useState(false);
  const [enforceFullscreen, setEnforceFullscreen] = useState(false);
  const [disableTextSelection, setDisableTextSelection] = useState(false);
  const [disableRightClick, setDisableRightClick] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [movingWatermark, setMovingWatermark] = useState(false);
  const [blurOnTabLeave, setBlurOnTabLeave] = useState(false);
  const [restrictQuestionPrinting, setRestrictQuestionPrinting] = useState(false);
  const [restrictResultPrinting, setRestrictResultPrinting] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // New features state
  const [showResults, setShowResults] = useState(true);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [institution, setInstitution] = useState('');
  const [level, setLevel] = useState('');
  const [allowedUsers, setAllowedUsers] = useState('');
  const [questionsPerPage, setQuestionsPerPage] = useState(1); // 1 = one question per page (default)
  const [minSubmissionPercentage, setMinSubmissionPercentage] = useState<number>(0);
  const [defaultMarkPerQuestion, setDefaultMarkPerQuestion] = useState<number>(1);
  const [allowedPrograms, setAllowedPrograms] = useState<string[]>([]);
  
  // Duplication State
  const [showDuplicationModal, setShowDuplicationModal] = useState(false);
  const [duplicatingQuiz, setDuplicatingQuiz] = useState<Quiz | null>(null);
  const [dupInstitution, setDupInstitution] = useState('');
  const [dupLevel, setDupLevel] = useState('');
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Merge State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceQuiz, setSourceQuiz] = useState<Quiz | null>(null);
  const [destQuizId, setDestQuizId] = useState('');
  const [deleteSourceAfterMerge, setDeleteSourceAfterMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Delete Confirmation Modal State
  const [deleteModalQuiz, setDeleteModalQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    const unsubscribeQuizzes = quizService.subscribeToQuizzes((data) => {
      setQuizzes(data);
      setLoading(false);
    });
    const unsubscribeInstitutions = institutionService.subscribeToInstitutions(setInstitutions);

    // Load persisted form data
    const savedForm = localStorage.getItem('vsefa_quiz_form_draft');
    if (savedForm) {
      try {
        const draft = JSON.parse(savedForm);
        setTitle(draft.title || '');
        setDesc(draft.desc || '');
        setTime(draft.time || 30);
        setOptionsCount(draft.optionsCount || 4);
        setLockCode(draft.lockCode || '');
        setQuizCode(draft.quizCode || '');
        setRestrictScreenshot(!!draft.restrictScreenshot);
        setRestrictCopyPaste(!!draft.restrictCopyPaste);
        setRestrictTabSwitch(!!draft.restrictTabSwitch);
        setEnforceFullscreen(!!draft.enforceFullscreen);
        setDisableTextSelection(!!draft.disableTextSelection);
        setDisableRightClick(!!draft.disableRightClick);
        setWatermarkEnabled(!!draft.watermarkEnabled);
        setMovingWatermark(!!draft.movingWatermark);
        setBlurOnTabLeave(!!draft.blurOnTabLeave);
        setRestrictQuestionPrinting(!!draft.restrictQuestionPrinting);
        setRestrictResultPrinting(!!draft.restrictResultPrinting);
        setShuffleQuestions(!!draft.shuffleQuestions);
        setShuffleOptions(!!draft.shuffleOptions);
        setShowResults(draft.showResults ?? true);
        setAvailableFrom(draft.availableFrom || '');
        setAvailableUntil(draft.availableUntil || '');
        setInstitution(draft.institution || '');
        setLevel(draft.level || '');
        setAllowedUsers(draft.allowedUsers || '');
        setQuestionsPerPage(draft.questionsPerPage || 1);
        setMinSubmissionPercentage(draft.minSubmissionPercentage || 0);
        setDefaultMarkPerQuestion(draft.defaultMarkPerQuestion || 1);

        // Restore modal state if it was open
        if (draft.isModalOpen) {
          setShowModal(true);
          if (draft.editingQuizId) {
            localStorage.setItem('vsefa_recovery_quiz_id', draft.editingQuizId);
          }
        }
      } catch (e) {
        console.error("Failed to parse quiz form draft", e);
      }
    }

    return () => {
      unsubscribeInstitutions();
    };
  }, []);

  // Filtering Logic
  useEffect(() => {
    if (!profile) return;
    const perm = adminService.getEffectivePermission(profile);
    if (perm === 'super_admin') {
      setFilteredQuizzes(quizzes);
    } else {
      const assigned = profile.assignedInstitutions || [];
      const isMultiInst = assigned.length >= 2;
      setFilteredQuizzes(quizzes.filter(q => {
        const inst = (q.institution || '').trim().toLowerCase();
        if (inst === "" && isMultiInst) return true;
        return assigned.some(i => i.trim().toLowerCase() === inst);
      }));
    }
  }, [quizzes, profile]);

  // Set editing quiz after quizzes are loaded if we are in recovery
  useEffect(() => {
    if (quizzes.length > 0) {
      const recoveryId = localStorage.getItem('vsefa_recovery_quiz_id');
      if (recoveryId) {
        const quiz = quizzes.find(q => q.id === recoveryId);
        if (quiz) setEditingQuiz(quiz);
        localStorage.removeItem('vsefa_recovery_quiz_id');
      }
    }
  }, [quizzes]);

  // Persistence Effect
  useEffect(() => {
    const formData = {
      title, desc, time, optionsCount, lockCode, quizCode, restrictScreenshot,
      restrictCopyPaste, restrictTabSwitch, enforceFullscreen,
      disableTextSelection, disableRightClick, watermarkEnabled,
      movingWatermark, blurOnTabLeave, showResults,
      restrictQuestionPrinting, restrictResultPrinting,
      availableFrom, availableUntil, institution, level, allowedUsers,
      questionsPerPage, shuffleQuestions, shuffleOptions, minSubmissionPercentage, defaultMarkPerQuestion,
      isModalOpen: showModal, editingQuizId: editingQuiz?.id
    };

    if (showModal || title || desc) {
      localStorage.setItem('vsefa_quiz_form_draft', JSON.stringify(formData));
    } else {
      localStorage.removeItem('vsefa_quiz_form_draft');
    }
  }, [
    title, desc, time, optionsCount, lockCode, restrictScreenshot,
    restrictCopyPaste, restrictTabSwitch, enforceFullscreen,
    disableTextSelection, disableRightClick, watermarkEnabled,
    movingWatermark, blurOnTabLeave, showResults,
    restrictQuestionPrinting, restrictResultPrinting,
    availableFrom, availableUntil, institution, allowedUsers,
    questionsPerPage, shuffleQuestions, shuffleOptions, minSubmissionPercentage, defaultMarkPerQuestion,
    showModal, editingQuiz
  ]);

  const handleOpenCreate = () => {
    setEditingQuiz(null);
    resetForm();
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
    setQuizCode(quiz.quizCode || '');
    setRestrictScreenshot(!!quiz.restrictScreenshot);
    setRestrictCopyPaste(!!quiz.restrictCopyPaste);
    setRestrictTabSwitch(!!quiz.restrictTabSwitch);
    setEnforceFullscreen(!!quiz.enforceFullscreen);
    setDisableTextSelection(!!quiz.disableTextSelection);
    setDisableRightClick(!!quiz.disableRightClick);
    setWatermarkEnabled(!!quiz.watermarkEnabled);
    setMovingWatermark(!!quiz.movingWatermark);
    setBlurOnTabLeave(!!quiz.blurOnTabLeave);
    setRestrictQuestionPrinting(!!quiz.restrictQuestionPrinting);
    setRestrictResultPrinting(!!quiz.restrictResultPrinting);
    setShuffleQuestions(!!quiz.shuffleQuestions);
    setShuffleOptions(!!quiz.shuffleOptions);

    setShowResults(quiz.showResults ?? true);
    setAvailableFrom(quiz.availableFrom ? new Date(quiz.availableFrom).toISOString().slice(0, 16) : '');
    setAvailableUntil(quiz.availableUntil ? new Date(quiz.availableUntil).toISOString().slice(0, 16) : '');
    setInstitution(quiz.institution || '');
    setLevel(quiz.level || '');
    setAllowedUsers(quiz.allowedUsers ? quiz.allowedUsers.join(', ') : '');
    setQuestionsPerPage(quiz.questionsPerPage || 0);
    setMinSubmissionPercentage(quiz.minSubmissionPercentage || 0);
    setDefaultMarkPerQuestion(quiz.defaultMarkPerQuestion || 1);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (quizCode && !/^\d{6}$/.test(quizCode)) {
      alert("Quiz Join Code must be exactly 6 numeric digits.");
      return;
    }

    try {
      const quizData = {
        subjectTitle,
        title,
        description: desc,
        allowedPrograms,
        timeLimit: time,
        defaultOptionsCount: optionsCount,
        lockCode: lockCode.trim() || "",
        quizCode: quizCode.trim() || "",
        restrictScreenshot,
        restrictCopyPaste,
        restrictTabSwitch,
        enforceFullscreen,
        disableTextSelection,
        disableRightClick,
        watermarkEnabled,
        movingWatermark,
        blurOnTabLeave,
        restrictQuestionPrinting,
        restrictResultPrinting,
        showResults,
        availableFrom: availableFrom ? new Date(availableFrom).getTime() : undefined,
        availableUntil: availableUntil ? new Date(availableUntil).getTime() : undefined,
        institution: institution || "",
        level: level || "",
        allowedUsers: allowedUsers ? allowedUsers.split(',').map(email => email.trim()).filter(Boolean) : [],
        questionsPerPage: Number(questionsPerPage) || 0,
        shuffleQuestions,
        shuffleOptions,
        minSubmissionPercentage: Number(minSubmissionPercentage) || 0,
        defaultMarkPerQuestion: Number(defaultMarkPerQuestion) || 1
      };

      if (editingQuiz) {
        await quizService.updateQuiz(editingQuiz.id, quizData);
      } else {
        await quizService.createQuiz(quizData, profile.uid);
      }

      setShowModal(false);
      resetForm();
      localStorage.removeItem('vsefa_quiz_form_draft');

    } catch (err) {
      console.error("Failed to save quiz:", err);
      alert("Error saving quiz configuration.");
    }
  };

  const resetForm = () => {
    setSubjectTitle('');
    setTitle('');
    setDesc('');
    setAllowedPrograms([]);
    setTime(30);
    setOptionsCount(4);
    setLockCode('');
    setQuizCode('');
    setRestrictScreenshot(false);
    setRestrictCopyPaste(false);
    setRestrictTabSwitch(false);
    setEnforceFullscreen(false);
    setDisableTextSelection(false);
    setDisableRightClick(false);
    setWatermarkEnabled(false);
    setMovingWatermark(false);
    setBlurOnTabLeave(false);
    setRestrictQuestionPrinting(false);
    setRestrictResultPrinting(false);
    setShowResults(true);
    setAvailableFrom('');
    setAvailableUntil('');
    setInstitution('');
    setLevel('');
    setAllowedUsers('');
    setQuestionsPerPage(1);
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setMinSubmissionPercentage(0);
    setDefaultMarkPerQuestion(1);
  };

  const togglePublish = async (quiz: Quiz) => {
    const isPublishing = !quiz.published;
    await quizService.updateQuiz(quiz.id, {
      published: isPublishing,
      status: isPublishing ? 'active' : 'draft'
    });
  };

  const handleDelete = async () => {
    if (!deleteModalQuiz || !profile) return;
    const { id, title } = deleteModalQuiz;

    try {
      setDeleteModalQuiz(null);
      setLoading(true);
      await quizService.deleteQuiz(id);
      await adminService.logAction(
        profile.uid,
        profile.displayName,
        'DELETE_QUIZ',
        `Permanently deleted examination module: "${title}"`
      );
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("Failed to delete the module. Ensure you have administrative permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !duplicatingQuiz) return;
    
    setIsDuplicating(true);
    try {
      await quizService.duplicateQuiz(
        duplicatingQuiz.id,
        dupInstitution,
        dupLevel,
        profile.uid
      );
      setShowDuplicationModal(false);
      setDuplicatingQuiz(null);
      setDupInstitution('');
      setDupLevel('');
      alert("Module duplicated successfully to " + (dupInstitution || "All Institutions") + ".");
    } catch (err) {
      console.error("Duplication failed:", err);
      alert("Failed to duplicate the module. Check your permissions and connection.");
    } finally {
      setIsDuplicating(false);
    }
  };

  const openDuplicateModal = (quiz: Quiz) => {
    setDuplicatingQuiz(quiz);
    setDupInstitution(quiz.institution || '');
    setDupLevel(quiz.level || '');
    setShowDuplicationModal(true);
  };

  const openMergeModal = (quiz: Quiz) => {
    setSourceQuiz(quiz);
    setDestQuizId('');
    setDeleteSourceAfterMerge(false);
    setShowMergeModal(true);
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceQuiz || !destQuizId) return;
    if (sourceQuiz.id === destQuizId) {
      alert("Source and destination modules cannot be the same.");
      return;
    }

    setIsMerging(true);
    try {
      const result = await quizService.mergeQuizzes(sourceQuiz.id, destQuizId, deleteSourceAfterMerge);
      setShowMergeModal(false);
      setSourceQuiz(null);
      setDestQuizId('');
      alert(`Successfully merged ${result.mergedCount} questions. Destination module now has ${result.totalCount} questions total.`);
    } catch (err) {
      console.error("Merge failed:", err);
      alert("Failed to merge modules. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  const canAccessManagement = isSuperAdmin || (profile?.assignedInstitutions && profile.assignedInstitutions.length >= 2);

  if (!authLoading && !canAccessManagement) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 sm:mb-12 gap-6 sm:gap-4">
          <div>
            <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
              <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">Module Management</h1>
            <p className="text-black font-medium text-sm sm:text-base">Author and deploy examination curriculum.</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-primary-600 text-white px-8 py-4 sm:py-3 rounded-xl font-bold hover:bg-primary-700 hover:shadow-xl transition-all active:scale-95"
          >
            Create New Exam
          </button>
        </div>

        {loading && quizzes.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[1, 2, 3].map(i => <div key={i} className="h-56 sm:h-64 bg-white rounded-3xl animate-pulse shadow-xl shadow-slate-100/50 border border-slate-100"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {filteredQuizzes.map(quiz => (
              <Card key={quiz.id} className="relative p-5 sm:p-8 border-none shadow-xl shadow-slate-100/50 flex flex-col hover:scale-[1.01] transition-all group overflow-visible">
                <button
                  onClick={() => setDeleteModalQuiz(quiz)}
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 text-slate-300 hover:text-red-500 p-2 transition-colors z-10"
                  title="Permanently Delete Module & Results"
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>

                <div className="p-3 sm:p-4 bg-primary-50 text-primary-600 rounded-2xl mb-4 sm:mb-6 w-fit shadow-inner flex items-center">
                  <i className="fas fa-scroll text-xl sm:text-2xl mr-2 sm:mr-3"></i>
                  {quiz.lockCode && (
                    <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center border border-amber-200">
                      <i className="fas fa-lock mr-1 text-[8px]"></i> Locked
                    </div>
                  )}
                  <button
                    onClick={() => handleOpenEdit(quiz)}
                    className="ml-3 sm:ml-4 text-black hover:text-primary-600 transition-colors"
                    title="Edit Module Details"
                  >
                    <i className="fas fa-edit text-sm"></i>
                  </button>
                  {isSuperAdmin && (
                    <>
                      <button
                        onClick={() => openDuplicateModal(quiz)}
                        className="ml-3 sm:ml-4 text-black hover:text-indigo-600 transition-colors"
                        title="Duplicate to another Institution"
                      >
                        <i className="fas fa-clone text-sm"></i>
                      </button>
                      <button
                        onClick={() => openMergeModal(quiz)}
                        className="ml-3 sm:ml-4 text-black hover:text-amber-600 transition-colors"
                        title="Merge Questions into another Module"
                      >
                        <i className="fas fa-object-group text-sm"></i>
                      </button>
                    </>
                  )}
                </div>

                {quiz.subjectTitle && (
                  <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1.5 leading-none">{quiz.subjectTitle}</p>
                )}
                <h3 className="text-lg sm:text-2xl font-black text-black mb-1 leading-tight pr-6">{quiz.title}</h3>
                <p className="text-xs sm:text-sm text-black line-clamp-2 mb-4 sm:mb-6 font-medium">{quiz.description}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 sm:mb-6 text-[10px] sm:text-[11px] font-black text-black uppercase tracking-widest border-t border-slate-50 pt-4">
                  <span className="flex items-center" title="Time Limit"><i className="far fa-clock mr-1.5 text-primary-400"></i> {quiz.timeLimit}M</span>
                  <span className="flex items-center" title="Total Questions"><i className="fas fa-list-ul mr-1.5 text-primary-400"></i> {quiz.totalQuestions} QS</span>
                  <span className="flex items-center" title="Options Format"><i className="fas fa-th-list mr-1.5 text-primary-400"></i> {quiz.defaultOptionsCount || 4} OP</span>
                  {quiz.shuffleQuestions && (
                    <span className="flex items-center text-amber-600" title="Shuffled Order">
                      <i className="fas fa-random mr-1.5"></i> Q-Shuffle
                    </span>
                  )}
                  {quiz.shuffleOptions && (
                    <span className="flex items-center text-indigo-600" title="Options Shuffled">
                      <i className="fas fa-layer-group mr-1.5"></i> O-Shuffle
                    </span>
                  )}
                  <span className={`flex items-center ${quiz.published ? 'text-green-600' : 'text-black'}`}>
                    <i className="fas fa-circle mr-1.5 text-[6px]"></i> {quiz.published ? 'Live' : 'Draft'}
                  </span>
                  {quiz.institution && (
                    <span className="flex items-center text-primary-600 bg-primary-50 px-2 py-0.5 rounded w-fit" title="Assigned Institution">
                      <i className="fas fa-university mr-1.5"></i> {institutions.find(i => i.name === quiz.institution)?.name || quiz.institution}
                    </span>
                  )}
                  {quiz.level && (
                    <span className="flex items-center text-primary-600 bg-primary-50 px-2 py-0.5 rounded w-fit" title="Target Level">
                      <i className="fas fa-layer-group mr-1.5"></i> Level {quiz.level}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-auto mb-3 sm:mb-4">
                  <Link to={`/admin/questions/${quiz.id}`} className="flex items-center justify-center p-3 sm:p-4 bg-slate-900 text-white rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-colors shadow-lg shadow-slate-200">
                    Questions
                  </Link>
                  <Link to={`/admin/reports?quizId=${quiz.id}`} className="flex items-center justify-center p-3 sm:p-4 bg-slate-50 text-black rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">
                    Results
                  </Link>
                </div>

                <div className="w-full flex items-center justify-center p-3 sm:p-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors mb-3 sm:mb-4">
                  <i className="fas fa-satellite-dish mr-2 animate-pulse"></i> Live Monitor
                </div>

                <button
                  onClick={() => togglePublish(quiz)}
                  className={`w-full py-3 sm:py-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${quiz.published ? 'text-red-500 bg-red-50 hover:bg-red-100 border border-red-100' : 'text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-100'}`}
                >
                  {quiz.published ? 'Stop Distribution' : 'Publish to Students'}
                </button>
              </Card>
            ))}

            {quizzes.length === 0 && !loading && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[3rem] opacity-50">
                <i className="fas fa-layer-group text-6xl text-slate-300 mb-4"></i>
                <p className="text-black font-bold uppercase tracking-widest">No Examinations Found</p>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <Card className="max-w-xl w-full p-5 sm:p-10 relative border-none shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] sm:max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl rounded-b-none sm:rounded-b-3xl">
              <div className="flex items-center justify-between mb-5 sm:mb-8">
                <h2 className="text-xl sm:text-3xl font-black text-black tracking-tight">{editingQuiz ? 'Edit Module' : 'New Module'}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-black hover:bg-slate-200 hover:text-black transition flex-shrink-0"
                  title="Close Modal"
                  aria-label="Close"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Exam Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200" placeholder="e.g. Clinical Nursing Practice" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Subject Title</label>
                    <input type="text" value={subjectTitle} onChange={e => setSubjectTitle(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200" placeholder="e.g. Medical Surgical Nursing" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Curriculum Overview</label>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-slate-50 border-slate-200" placeholder="Brief description for student dashboard..." required />
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 rounded-3xl space-y-4 sm:space-y-6">
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest mb-2 flex items-center">
                    <i className="fas fa-clock mr-2"></i> Scheduling & Access
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Duration (Minutes)</label>
                      <input
                        type="number"
                        id="duration"
                        value={time}
                        onChange={e => setTime(Number(e.target.value))}
                        className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm"
                        required
                        min="1"
                        title="Duration in minutes"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Lock Code (Optional)</label>
                      <input type="text" value={lockCode} onChange={e => setLockCode(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm" placeholder="e.g. SECRET123" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Quiz Join Code (6 Digits)</label>
                      <input 
                        type="text" 
                        value={quizCode} 
                        onChange={e => setQuizCode(e.target.value.replace(/\D/g, '').substring(0, 6))} 
                        className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm font-mono" 
                        placeholder="e.g. 123456" 
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Available From (Optional)</label>
                      <input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} className="w-full p-3 sm:p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-xs sm:text-sm" title="Available from date" placeholder="Select start date" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Available Until (Optional)</label>
                      <input type="datetime-local" value={availableUntil} onChange={e => setAvailableUntil(e.target.value)} className="w-full p-3 sm:p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-xs sm:text-sm" title="Available until date" placeholder="Select end date" />
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 rounded-3xl space-y-4 sm:space-y-6">
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest mb-2 flex items-center">
                    <i className="fas fa-university mr-2"></i> Target Audience
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Institution</label>
                      <select
                        id="institution"
                        value={institution}
                        title="Select Institution"
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full px-4 py-4 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none select-custom-arrow"
                      >
                        {isSuperAdmin ? (
                          <>
                            <option value="">All Institutions (VSEFA)</option>
                            {institutions.map(inst => (
                              <option key={inst.id} value={inst.name}>{inst.name}</option>
                            ))}
                          </>
                        ) : (
                          <>
                            {profile?.assignedInstitutions && profile.assignedInstitutions.length >= 2 && (
                              <option value="">All Institutions (Global)</option>
                            )}
                            {profile?.assignedInstitutions?.map(inst => (
                              <option key={inst} value={inst}>{inst}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Academic Level</label>
                      <select
                        value={level}
                        title="Target Academic Level"
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full px-4 py-4 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none select-custom-arrow"
                      >
                        <option value="">All Levels</option>
                        <option value="100">Level 100</option>
                        <option value="200">Level 200</option>
                        <option value="300">Level 300</option>
                        <option value="Candidate">Candidate</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Target Programs</label>
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
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${allowedPrograms.includes(prog) ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200' : 'bg-white text-black border-white hover:border-slate-200'}`}
                        >
                          {prog}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Assigned Students (Emails separated by commas)</label>
                    <input type="text" value={allowedUsers} onChange={e => setAllowedUsers(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200" placeholder="leave blank for all students" />
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 rounded-3xl space-y-4 sm:space-y-6">
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest mb-2 flex items-center">
                    <i className="fas fa-cog mr-2"></i> Configuration
                  </h3>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowResults(!showResults)}
                      className={`p-4 w-full rounded-xl border-2 flex items-center justify-between transition ${showResults ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-white text-black hover:border-primary-100'}`}
                    >
                      <span className="text-[11px] font-bold uppercase">Show Results Immediately</span>
                      <i className={`fas ${showResults ? 'fa-eye text-primary-500' : 'fa-eye-slash'} text-lg`}></i>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Options Per Question</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[2, 3, 4].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setOptionsCount(num)}
                            className={`py-3 rounded-xl border-2 font-black text-xs transition ${optionsCount === num ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : 'bg-white border-white text-black hover:border-primary-200'}`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Questions Per Page</label>
                      <div className="flex flex-wrap gap-2">
                        {[0, 1, 2, 5, 10].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setQuestionsPerPage(num)}
                            className={`flex-1 min-w-[40px] py-3 rounded-xl border-2 font-black text-xs transition ${questionsPerPage === num ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : 'bg-white border-white text-black hover:border-primary-200'}`}
                          >
                            {num === 0 ? 'All' : num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Required Answers %</label>
                      <input
                        type="number"
                        value={minSubmissionPercentage}
                        onChange={e => setMinSubmissionPercentage(Number(e.target.value))}
                        className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm"
                        placeholder="e.g. 70"
                        min="0"
                        max="100"
                        title="Minimum percentage of questions that must be answered to submit"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Marks Per Question</label>
                      <input
                        type="number"
                        value={defaultMarkPerQuestion}
                        onChange={e => setDefaultMarkPerQuestion(Number(e.target.value))}
                        className="w-full p-4 border rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-white border-slate-200 text-sm"
                        placeholder="e.g. 1"
                        min="1"
                        title="Default number of marks awarded for each correct answer"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 rounded-3xl space-y-4">
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest mb-2 flex items-center">
                    <i className="fas fa-shield-alt mr-2"></i> Security Enforcement
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { label: 'Screenshot Block', state: restrictScreenshot, toggle: () => setRestrictScreenshot(!restrictScreenshot), onIcon: 'fa-lock', offIcon: 'fa-unlock-alt' },
                      { label: 'Copy/Paste Block', state: restrictCopyPaste, toggle: () => setRestrictCopyPaste(!restrictCopyPaste), onIcon: 'fa-lock', offIcon: 'fa-unlock-alt' },
                      { label: 'Tab Switch Alerts', state: restrictTabSwitch, toggle: () => setRestrictTabSwitch(!restrictTabSwitch), onIcon: 'fa-eye', offIcon: 'fa-eye-slash' },
                      { label: 'Auth Fullscreen', state: enforceFullscreen, toggle: () => setEnforceFullscreen(!enforceFullscreen), onIcon: 'fa-expand-arrows-alt', offIcon: 'fa-compress' },
                      { label: 'Disable Selection', state: disableTextSelection, toggle: () => setDisableTextSelection(!disableTextSelection), onIcon: 'fa-mouse-pointer', offIcon: 'fa-i-cursor' },
                      { label: 'Disable Right-Click', state: disableRightClick, toggle: () => setDisableRightClick(!disableRightClick), onIcon: 'fa-ban', offIcon: 'fa-mouse' },
                      { label: 'Watermark', state: watermarkEnabled, toggle: () => setWatermarkEnabled(!watermarkEnabled), onIcon: 'fa-stamp', offIcon: 'fa-ghost' },
                      { label: 'Moving Watermark', state: movingWatermark, toggle: () => setMovingWatermark(!movingWatermark), onIcon: 'fa-running', offIcon: 'fa-stop' },
                      { label: 'Blur on Tab Leave', state: blurOnTabLeave, toggle: () => setBlurOnTabLeave(!blurOnTabLeave), onIcon: 'fa-mask', offIcon: 'fa-eye' },
                      { label: 'Block Q-Print', state: restrictQuestionPrinting, toggle: () => setRestrictQuestionPrinting(!restrictQuestionPrinting), onIcon: 'fa-print', offIcon: 'fa-print' },
                      { label: 'Block R-Print', state: restrictResultPrinting, toggle: () => setRestrictResultPrinting(!restrictResultPrinting), onIcon: 'fa-file-invoice', offIcon: 'fa-file-invoice' },
                      { label: 'Shuffle Questions', state: shuffleQuestions, toggle: () => setShuffleQuestions(!shuffleQuestions), onIcon: 'fa-random', offIcon: 'fa-list-ol' },
                      { label: 'Shuffle Options', state: shuffleOptions, toggle: () => setShuffleOptions(!shuffleOptions), onIcon: 'fa-layer-group', offIcon: 'fa-align-left' },
                    ].map(({ label, state, toggle, onIcon, offIcon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={toggle}
                        className={`p-3 sm:p-4 rounded-xl border-2 flex items-center justify-between transition ${state ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-white text-black hover:border-primary-100'}`}
                      >
                        <span className="text-[10px] font-bold uppercase">{label}</span>
                        <i className={`fas ${state ? onIcon : offIcon} text-xs`}></i>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 text-primary-700 text-xs font-medium">
                  <i className="fas fa-info-circle mr-2"></i>
                  Choosing <b>{optionsCount} options</b> will configure the question builder to enforce this layout for all questions in this module.
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg hover:bg-primary-600 shadow-xl shadow-slate-200 transition-all active:scale-[0.98]">
                  {editingQuiz ? 'Update Module Registry' : 'Deploy Draft Registry'}
                </button>
              </form>
            </Card>
          </div>
        )}

        {showDuplicationModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-5 sm:p-8 relative border-none shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 rounded-t-3xl sm:rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-black tracking-tight">Duplicate Module</h2>
                <button
                  onClick={() => setShowDuplicationModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-black hover:bg-slate-200 transition"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">Source Module</p>
                <p className="font-black text-black">{duplicatingQuiz?.title}</p>
              </div>

              <form onSubmit={handleDuplicate} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Target Institution</label>
                  <select
                    value={dupInstitution}
                    onChange={(e) => setDupInstitution(e.target.value)}
                    className="w-full px-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none select-custom-arrow"
                    required
                  >
                    <option value="">All Institutions (VSEFA)</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.name}>{inst.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Target Academic Level</label>
                  <select
                    value={dupLevel}
                    onChange={(e) => setDupLevel(e.target.value)}
                    className="w-full px-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none select-custom-arrow"
                    required
                  >
                    <option value="">All Levels</option>
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="Candidate">Candidate</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={isDuplicating}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDuplicating ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> Duplicating...</>
                  ) : (
                    "Deploy Duplicate Module"
                  )}
                </button>
              </form>
            </Card>
          </div>
        )}

        {showMergeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-5 sm:p-8 relative border-none shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 rounded-t-3xl sm:rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-black tracking-tight">Merge Question Sets</h2>
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-black hover:bg-slate-200 transition"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Merge questions from:</p>
                <p className="font-black text-black mb-4">{sourceQuiz?.title}</p>
                <div className="flex items-center justify-center text-slate-300 my-2">
                  <i className="fas fa-arrow-down text-xl"></i>
                </div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-4 mb-2">Into Destination:</p>
                <p className="font-black text-black italic">
                  {quizzes.find(q => q.id === destQuizId)?.title || "Select a module below..."}
                </p>
              </div>

              <form onSubmit={handleMerge} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Destination Module</label>
                  <select
                    value={destQuizId}
                    onChange={(e) => setDestQuizId(e.target.value)}
                    className="w-full px-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none select-custom-arrow"
                    required
                  >
                    <option value="">Choose target module...</option>
                    {quizzes
                      .filter(q => q.id !== sourceQuiz?.id)
                      .map(q => (
                        <option key={q.id} value={q.id}>{q.title} ({q.institution || 'Global'})</option>
                      ))}
                  </select>
                </div>

                <label className="flex items-center group cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={deleteSourceAfterMerge}
                      onChange={(e) => setDeleteSourceAfterMerge(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${deleteSourceAfterMerge ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${deleteSourceAfterMerge ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-black text-black uppercase tracking-tight group-hover:text-red-600 transition-colors">
                    Delete source module after merging
                  </span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMergeModal(false)}
                    className="flex-1 px-4 py-4 rounded-xl bg-slate-100 text-black font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMerging || !destQuizId}
                    className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMerging ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i> Merging...</>
                    ) : (
                      "Confirm Merge"
                    )}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModalQuiz}
        onClose={() => setDeleteModalQuiz(null)}
        title="Delete Examination"
        variant="danger"
        footer={
          <>
            <button 
              onClick={() => setDeleteModalQuiz(null)}
              className="flex-1 py-4 bg-slate-100 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDelete}
              className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-200 transition-all"
            >
              Delete Permanently
            </button>
          </>
        }
      >
        {deleteModalQuiz && (
          <p>
            PERMANENT DELETION WARNING:<br/><br/>
            This action will remove <span className="font-bold text-black">"{deleteModalQuiz.title}"</span> from the platform. 
            All associated questions and student grades will be <span className="font-bold text-red-600">ERASED PERMANENTLY</span>.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default QuizManagement;

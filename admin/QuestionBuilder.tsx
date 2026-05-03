import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { questionService } from '../services/questionService';
import { quizService } from '../services/quizService';
import { adminService } from '../services/adminService';
import { useAuth } from '../auth/AuthProvider';
import { Quiz, Question } from '../core/types';

const QuestionBuilder: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [stagedQuestions, setStagedQuestions] = useState<Omit<Question, 'id' | 'quizId'>[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  // Form State - Initialized with 4, but will sync with quiz data
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // staged question index
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null); // vault question id
  const [activeTab, setActiveTab] = useState<'compose' | 'sequence' | 'vault'>('compose');
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  useEffect(() => {
    if (quizId) {
      loadData(quizId);

      // Load staged questions from localStorage
      const savedStaged = localStorage.getItem(`vsefa_staged_${quizId}`);
      if (savedStaged) {
        try {
          setStagedQuestions(JSON.parse(savedStaged));
        } catch (e) {
          console.error("Failed to parse saved staged questions", e);
        }
      }

      // Load form draft from localStorage
      const savedDraft = localStorage.getItem(`vsefa_draft_${quizId}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setText(draft.text || '');
          setOptions(draft.options || ['', '', '', '']);
          setCorrect(draft.correct || 0);
        } catch (e) {
          console.error("Failed to parse saved draft", e);
        }
      }
      setIsCacheLoaded(true);
    }
  }, [quizId]);

  // Persistence Effects - Only run after initial load to avoid wiping cache on mount
  useEffect(() => {
    if (isCacheLoaded && quizId) {
      if (stagedQuestions.length > 0) {
        localStorage.setItem(`vsefa_staged_${quizId}`, JSON.stringify(stagedQuestions));
      } else {
        localStorage.removeItem(`vsefa_staged_${quizId}`);
      }
    }
  }, [stagedQuestions, quizId, isCacheLoaded]);

  useEffect(() => {
    if (isCacheLoaded && quizId) {
      if (text || options.some(o => o !== '') || correct !== 0) {
        localStorage.setItem(`vsefa_draft_${quizId}`, JSON.stringify({ text, options, correct }));
      } else {
        localStorage.removeItem(`vsefa_draft_${quizId}`);
      }
    }
  }, [text, options, correct, quizId, isCacheLoaded]);

  // Prevent accidental data loss on navigation/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stagedQuestions.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stagedQuestions]);


  const loadData = async (id: string) => {
    try {
      const [qz, qs] = await Promise.all([
        quizService.getQuiz(id),
        questionService.getQuestionsByQuiz(id)
      ]);
      setQuiz(qz);
      setSavedQuestions(qs);

      // Update options count based on quiz settings
      if (qz) {
        const count = qz.defaultOptionsCount || 4;
        setOptions(new Array(count).fill(''));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setText('');
    const count = quiz?.defaultOptionsCount || 4;
    setOptions(new Array(count).fill(''));
    setCorrect(0);
    setEditingIndex(null);
    setEditingSavedId(null);
  };

  const addToStage = async (e: React.FormEvent) => {
    e.preventDefault();
    const questionData: any = {
      text,
      options: [...options],
      correctOptionIndex: correct,
    };

    if (editingSavedId) {
      // Update an existing vault question in Firestore
      try {
        await questionService.updateQuestion(editingSavedId, questionData);
        await loadData(quizId!);
      } catch (err) {
        console.error('Failed to update vault question:', err);
        alert('Failed to save changes. Please try again.');
        return;
      }
    } else if (editingIndex !== null) {
      // Update a staged question in-place
      const updated = [...stagedQuestions];
      updated[editingIndex] = questionData;
      setStagedQuestions(updated);
    } else {
      // Add new question to staging
      setStagedQuestions([...stagedQuestions, questionData]);
    }

    resetForm();
  };

  const startEditStaged = (index: number) => {
    const q = stagedQuestions[index];
    setText(q.text);
    setOptions([...q.options]);
    setCorrect(q.correctOptionIndex);
    setEditingIndex(index);
    setEditingSavedId(null);
  };

  const startEditSaved = (question: Question) => {
    setText(question.text);
    setOptions([...question.options]);
    setCorrect(question.correctOptionIndex);
    setEditingSavedId(question.id);
    setEditingIndex(null);
  };

  const removeFromStage = (index: number) => {
    const newStage = [...stagedQuestions];
    newStage.splice(index, 1);
    setStagedQuestions(newStage);
  };

  const handleBatchDeploy = async () => {
    if (!quizId || stagedQuestions.length === 0 || isDeploying) return;

    setIsDeploying(true);
    // Snapshot the questions to deploy
    const questionsToDeploy = stagedQuestions.map((q, i) => ({
      ...q,
      order: savedQuestions.length + i + 1
    }));
    const deployCount = questionsToDeploy.length;

    try {
      // Deploy all questions in a single atomic batch
      await questionService.batchAddQuestions(quizId, questionsToDeploy as any);

      // CRITICAL: ONLY clear the cache and staging AFTER a successful deployment
      localStorage.removeItem(`vsefa_staged_${quizId}`);
      setStagedQuestions([]);

      // Refresh saved list from Firestore
      const qs = await questionService.getQuestionsByQuiz(quizId);
      setSavedQuestions(qs);
      alert(`Successfully deployed ${deployCount} questions to the examination vault.`);

    } catch (err) {
      console.error("Batch Deployment Error:", err);
      // Data is NOT cleared from staging/localStorage, so the admin can try again.
      alert("Deployment failed. Your staged questions have been preserved. Please check your connection and try again.");
    } finally {
      setIsDeploying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';


  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Opening Registry...</p>
      </div>
    </div>
  );

  const nextQuestionNumber = savedQuestions.length + stagedQuestions.length + 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex-1">
            <button 
              onClick={() => navigate(-1)}
              className="text-primary-600 text-sm font-bold flex items-center mb-4 lg:mb-2 hover:translate-x-[-4px] transition-transform w-fit"
            >
              <i className="fas fa-arrow-left mr-2"></i> Back to Registry
            </button>
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight mb-1">Curriculum Builder</h1>
            <p className="text-slate-500 font-medium text-sm lg:text-base">{quiz?.title}</p>
          </div>
          <div className="grid grid-cols-2 lg:flex items-center gap-3 w-full lg:w-auto">
            <div className="bg-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border border-slate-200 shadow-sm text-center lg:min-w-[120px]">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vault Registry</p>
              <p className="text-lg sm:text-2xl font-black text-slate-900">{savedQuestions.length} <span className="text-xs font-bold text-slate-400">Items</span></p>
            </div>
            <div className="bg-primary-50 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border border-primary-100 shadow-sm text-center lg:min-w-[120px]">
              <p className="text-[9px] sm:text-[10px] font-black text-primary-400 uppercase tracking-widest mb-1">Format</p>
              <p className="text-lg sm:text-2xl font-black text-primary-700">{quiz?.defaultOptionsCount || 4} <span className="text-xs font-bold text-primary-400">Opts</span></p>
            </div>
          </div>
          {isSuperAdmin && savedQuestions.length > 0 && (
            <button
               onClick={handlePrint}
               className="bg-slate-900 text-white px-6 py-4 sm:py-3 rounded-xl font-black text-xs sm:text-sm hover:shadow-xl transition flex items-center justify-center print:hidden active:scale-95"
            >
               <i className="fas fa-file-pdf mr-2 text-primary-400"></i>
               Export to PDF
            </button>
          )}
        </div>

        <div className="lg:h-[calc(100vh-220px)] lg:overflow-hidden">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden border-b border-slate-200 mb-6 sticky top-0 bg-slate-50 z-20">
            <button 
              onClick={() => setActiveTab('compose')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'compose' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}
            >
              Compose
            </button>
            <button 
              onClick={() => setActiveTab('sequence')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'sequence' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}
            >
              Sequence ({stagedQuestions.length + savedQuestions.length})
            </button>
            <button 
              onClick={() => setActiveTab('vault')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'vault' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}
            >
              Vault ({savedQuestions.length})
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-8 h-full">
            {/* Panel 1: Composer */}
            <div className={`h-full lg:overflow-y-auto lg:pr-2 scrollbar-hide hover:scrollbar-default ${activeTab !== 'compose' ? 'hidden lg:block' : 'block'}`}>
              <div className="pb-24 lg:pb-8">
                <Card className="p-5 sm:p-8 border-none shadow-xl shadow-slate-200/50">
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <h2 className="text-xl font-bold text-slate-900">
                      {editingSavedId ? `Editing Vault Item` : editingIndex !== null ? `Editing Staged #${savedQuestions.length + editingIndex + 1}` : 'Composer'}
                    </h2>
                    {editingIndex === null && !editingSavedId ? (
                      <span className="bg-primary-600 text-white text-[10px] sm:text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                        Item #{nextQuestionNumber}
                      </span>
                    ) : (
                      <span className="bg-amber-500 text-white text-[10px] sm:text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse">
                        Edit Mode
                      </span>
                    )}
                  </div>

                  <form onSubmit={addToStage} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Question Inquiry</label>
                      <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition min-h-[140px] text-slate-700 font-medium text-sm sm:text-base"
                        placeholder="e.g. Identify the primary advantage of utilizing a hash map for lookups."
                        required
                        style={{ minHeight: '120px' }}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Response Options</label>
                        <span className="text-[10px] font-bold text-primary-500 uppercase">Select the correct answer</span>
                      </div>
                      {options.map((opt, i) => (
                        <div key={i} className="flex items-center space-x-3 group w-full">
                          <button
                            type="button"
                            onClick={() => setCorrect(i)}
                            className={`w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-200 flex-shrink-0 shadow-sm ${
                              correct === i 
                                ? 'bg-green-600 text-white ring-4 ring-green-100 scale-105' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                            }`}
                            title={`Mark Option ${String.fromCharCode(65 + i)} as correct`}
                          >
                            {String.fromCharCode(65 + i)}
                          </button>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={opt}
                              onChange={e => {
                                const n = [...options];
                                n[i] = e.target.value;
                                setOptions(n);
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + i)} details...`}
                              className={`w-full p-3 sm:p-4 border-2 rounded-xl text-sm transition-all duration-200 min-h-[48px] ${
                                correct === i 
                                  ? 'border-green-500 bg-green-50/20 text-slate-900 font-bold' 
                                  : 'border-slate-100 bg-white focus:border-primary-500'
                              }`}
                              required
                            />
                            {correct === i && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-green-600 text-white px-2 py-1 rounded-md shadow-sm animate-in fade-in zoom-in duration-300">
                                <i className="fas fa-check-circle text-[10px]"></i>
                                <span className="text-[8px] font-black uppercase tracking-widest">Correct</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 lg:relative lg:p-0 lg:bg-transparent lg:border-none z-30">
                      <div className="flex gap-3 max-w-7xl mx-auto lg:max-w-none">
                        <button
                          type="submit"
                          className={`flex-1 py-4 rounded-xl font-bold transition shadow-xl shadow-slate-100 text-sm sm:text-base ${editingIndex !== null || editingSavedId
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-slate-900 text-white hover:bg-primary-600'
                            }`}
                        >
                          {editingSavedId ? (
                            <><i className="fas fa-save mr-2"></i> Save Changes</>
                          ) : editingIndex !== null ? (
                            <><i className="fas fa-pen mr-2"></i> Update Staged Item</>
                          ) : (
                            <><i className="fas fa-plus mr-2"></i> Add to Sequence</>
                          )}
                        </button>
                        {(editingIndex !== null || editingSavedId) && (
                          <button
                            type="button"
                            onClick={resetForm}
                            className="px-5 py-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-sm sm:text-base"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </Card>
              </div>
            </div>

            {/* Panel 2: Sequence Preview */}
            <div className={`h-full lg:overflow-y-auto lg:px-4 custom-scrollbar ${activeTab !== 'sequence' ? 'hidden lg:block' : 'block'}`}>
              <div className="pb-8">
                {/* Staging Area Header */}
                {stagedQuestions.length > 0 && (
                  <div className="bg-amber-600 rounded-2xl p-5 sm:p-6 text-white shadow-2xl shadow-amber-200/50 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                    <div className="text-center sm:text-left">
                      <h3 className="font-extrabold text-lg mb-1">Staged for Deployment</h3>
                      <p className="text-amber-100 text-[10px] font-medium">Click deploy to sync with vault.</p>
                    </div>
                    <button
                      onClick={handleBatchDeploy}
                      disabled={isDeploying}
                      className="w-full sm:w-auto bg-white text-amber-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition disabled:opacity-50 shadow-lg active:scale-95"
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy to Vault'}
                    </button>
                  </div>
                )}

                <h2 className="text-xl font-bold text-slate-900 flex items-center px-2 print:hidden mb-4">
                  <span className="w-2 h-8 bg-primary-600 rounded-full mr-3"></span>
                  Sequence Preview
                </h2>

                {/* Print Header */}
                <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                  <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter">SmartPrep Examination Registry</h1>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{quiz?.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Level</p>
                        <p className="text-sm font-bold">Level {quiz?.level}</p>
                      </div>
                  </div>
                </div>

                <div className="space-y-4 print:space-y-8">
                  {/* Staged Items */}
                  {stagedQuestions.map((q, idx) => (
                    <Card key={`staged-${idx}`} className={`p-5 shadow-sm relative group overflow-hidden transition-all print:hidden ${editingIndex === idx
                      ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-200'
                      : 'border-amber-200 bg-amber-50/30'
                      }`}>
                      <div className="absolute top-0 right-0 p-2">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${editingIndex === idx
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-amber-100 text-amber-700'
                          }`}>{editingIndex === idx ? 'Editing' : 'Unsaved'}</span>
                      </div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-amber-600 font-black text-sm">#{savedQuestions.length + idx + 1}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEditStaged(idx)}
                            className="text-amber-300 hover:text-primary-500 transition lg:opacity-0 group-hover:opacity-100"
                            title="Edit staged question"
                          >
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={() => removeFromStage(idx)}
                            className="text-amber-300 hover:text-red-500 transition lg:opacity-0 group-hover:opacity-100"
                            title="Remove from staging"
                          >
                            <i className="fas fa-times-circle"></i>
                          </button>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800 mb-4 text-base leading-snug">{q.text}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${i === q.correctOptionIndex ? 'bg-green-100 border-green-200 text-green-700 font-bold' : 'bg-white border-slate-100 text-slate-400'}`}>
                            <div className="flex items-center">
                              <span className="w-5 h-5 flex items-center justify-center rounded bg-white/50 mr-2 text-[10px]">{String.fromCharCode(65 + i)}</span>
                              {opt}
                            </div>
                            {i === q.correctOptionIndex && <i className="fas fa-check-circle text-green-600"></i>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}

                  {/* Saved Items in Sequence */}
                  {savedQuestions.map((q, idx) => (
                    <Card key={q.id} className={`p-5 hover:shadow-md transition-all print:shadow-none print:border-slate-100 print:p-0 ${editingSavedId === q.id
                      ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-200'
                      : 'border-slate-100'
                      }`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-primary-600 font-black text-sm print:text-slate-900 print:text-xs">QUESTION #{idx + 1}</span>
                        <div className="flex items-center space-x-2 print:hidden">
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${editingSavedId === q.id
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-slate-50 text-slate-400'
                              }`}>{editingSavedId === q.id ? 'Editing' : 'In Vault'}</span>
                        </div>
                      </div>
                      <p className="font-bold text-slate-700 mb-4 text-base leading-snug print:text-sm">{q.text}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:gap-4">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`p-3 rounded-xl border text-xs flex items-center justify-between print:border-slate-200 print:p-2 ${i === q.correctOptionIndex ? 'bg-primary-50 border-primary-100 text-primary-700 font-bold print:bg-slate-50 print:text-slate-900' : 'bg-slate-50 border-slate-50 text-slate-500 print:bg-white'}`}>
                            <div className="flex items-center">
                              <span className="w-5 h-5 flex items-center justify-center rounded bg-white/50 mr-2 text-[10px] font-black print:border print:border-slate-300">{String.fromCharCode(65 + i)}</span>
                              {opt}
                            </div>
                            {i === q.correctOptionIndex && <i className="fas fa-check-circle text-primary-600 print:hidden"></i>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                  
                  {savedQuestions.length === 0 && stagedQuestions.length === 0 && (
                    <div className="p-12 text-center border-4 border-dashed rounded-3xl text-slate-300 border-slate-100 print:hidden">
                      <i className="fas fa-layer-group text-4xl mb-4 opacity-10"></i>
                      <p className="text-base font-bold">Sequence Empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel 3: Vault */}
            <div className={`h-full lg:overflow-y-auto lg:pl-4 custom-scrollbar ${activeTab !== 'vault' ? 'hidden lg:block' : 'block'}`}>
              <div className="pb-8">
                <h2 className="text-xl font-bold text-slate-900 flex items-center px-2 mb-4">
                  <span className="w-2 h-8 bg-slate-900 rounded-full mr-3"></span>
                  Examination Vault
                </h2>
                
                <div className="space-y-3">
                  {savedQuestions.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No vault items yet</p>
                    </div>
                  ) : (
                    savedQuestions.map((q) => (
                      <Card key={`vault-${q.id}`} className="p-4 bg-white border-slate-100 hover:border-primary-200 transition-colors group">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">IN VAULT</span>
                            </div>
                            <p className="text-sm font-bold text-slate-700 line-clamp-3">{q.text}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => startEditSaved(q)}
                              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-primary-50 hover:text-primary-600 transition flex items-center justify-center"
                              title="Pull back to composer for editing"
                            >
                              <i className="fas fa-pen-to-square text-sm"></i>
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm("Permanently remove this item from the module vault?")) {
                                  await questionService.deleteQuestion(q.id, quizId!);
                                  loadData(quizId!);
                                }
                              }}
                              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex items-center justify-center"
                              title="Delete from vault"
                            >
                              <i className="fas fa-trash-can text-sm"></i>
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

    </div>
  );
};

export default QuestionBuilder;

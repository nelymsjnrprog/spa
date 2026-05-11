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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    if (quizId) {
      loadData(quizId);
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

      const targetCount = qz?.defaultOptionsCount || 4;

      // 1. Load staged questions
      const savedStaged = localStorage.getItem(`vsefa_staged_${id}`);
      if (savedStaged) {
        try {
          setStagedQuestions(JSON.parse(savedStaged));
        } catch (e) {}
      }

      // 2. Load form draft
      const savedDraft = localStorage.getItem(`vsefa_draft_${id}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setText(draft.text || '');
          setCorrect(draft.correct || 0);
          
          // Only restore options if the count matches the current quiz settings
          if (draft.options && Array.isArray(draft.options) && draft.options.length === targetCount) {
            setOptions(draft.options);
          } else {
            setOptions(new Array(targetCount).fill(''));
          }
        } catch (e) {
          setOptions(new Array(targetCount).fill(''));
        }
      } else {
        setOptions(new Array(targetCount).fill(''));
      }
    } finally {
      setLoading(false);
      setIsCacheLoaded(true);
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
        <p className="text-black font-bold text-xs uppercase tracking-widest">Opening Registry...</p>
      </div>
    </div>
  );

  const nextQuestionNumber = savedQuestions.length + stagedQuestions.length + 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex-1">
            <button 
              onClick={() => navigate(-1)}
              className="text-primary-600 text-[11px] font-black uppercase tracking-widest flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit"
            >
              <i className="fas fa-arrow-left mr-2"></i> Registry
            </button>

            <p className="text-black font-bold text-sm lg:text-base leading-tight">{quiz?.title}</p>
          </div>
          <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
            <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-center lg:min-w-[90px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vault Items</p>
              <p className="text-sm sm:text-base font-black text-black">{savedQuestions.length}</p>
            </div>
            <div className="bg-primary-50 px-3 py-2 rounded-xl border border-primary-100 shadow-sm text-center lg:min-w-[90px]">
              <p className="text-[8px] font-black text-primary-400 uppercase tracking-widest mb-0.5">Options</p>
              <p className="text-sm sm:text-base font-black text-primary-700">{quiz?.defaultOptionsCount || 4}</p>
            </div>
          </div>
          {isSuperAdmin && savedQuestions.length > 0 && (
            <button
               onClick={handlePrint}
               className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl transition flex items-center justify-center print:hidden active:scale-95"
            >
               <i className="fas fa-file-pdf mr-2 text-primary-400"></i>
               PDF Export
            </button>
          )}
        </div>

        <div className="lg:h-[calc(100vh-160px)] lg:overflow-hidden print:h-auto print:overflow-visible">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden border-b border-slate-200 mb-6 sticky top-0 bg-slate-50 z-20">
            <button 
              onClick={() => setActiveTab('compose')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'compose' ? 'border-primary-600 text-primary-600' : 'border-transparent text-black'}`}
            >
              Compose
            </button>
            <button 
              onClick={() => setActiveTab('sequence')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'sequence' ? 'border-primary-600 text-primary-600' : 'border-transparent text-black'}`}
            >
              Sequence ({stagedQuestions.length + savedQuestions.length})
            </button>
            <button 
              onClick={() => setActiveTab('vault')} 
              className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'vault' ? 'border-primary-600 text-primary-600' : 'border-transparent text-black'}`}
            >
              Vault ({savedQuestions.length})
            </button>
          </div>

          <div className={`grid grid-cols-1 ${
            leftCollapsed && rightCollapsed ? 'lg:grid-cols-[60px_1fr_60px]' :
            leftCollapsed ? 'lg:grid-cols-[60px_1fr_300px]' :
            rightCollapsed ? 'lg:grid-cols-[300px_1fr_60px]' :
            'lg:grid-cols-[300px_1fr_300px]'
          } gap-6 h-full transition-all duration-300`}>
            
            {/* Panel 2: Sequence Preview */}
            <div className={`h-full flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/60 transition-all duration-300 overflow-hidden ${activeTab !== 'sequence' ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                {!leftCollapsed ? (
                  <>
                    <h2 className="text-[10px] font-black text-black uppercase tracking-widest flex items-center">
                      <span className="w-1.5 h-4 bg-primary-600 rounded-full mr-2"></span>
                      Sequence Preview
                    </h2>
                    <button onClick={() => setLeftCollapsed(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                      <i className="fas fa-chevron-left text-xs"></i>
                    </button>
                  </>
                ) : (
                  <button onClick={() => setLeftCollapsed(false)} className="w-full py-2 flex flex-col items-center gap-4 text-primary-600" title="Expand Sequence">
                    <i className="fas fa-list-ol text-sm"></i>
                    <span className="text-[9px] font-black">{stagedQuestions.length + savedQuestions.length}</span>
                    <i className="fas fa-chevron-right text-[10px] opacity-40 mt-auto"></i>
                  </button>
                )}
              </div>

              {!leftCollapsed && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                  {/* Staging Area Header */}
                  {stagedQuestions.length > 0 && (
                    <div className="bg-amber-600 rounded-xl p-4 text-white shadow-lg shadow-amber-200/20 mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-amber-100">Pending Deployment</p>
                      <button
                        onClick={handleBatchDeploy}
                        disabled={isDeploying}
                        className="w-full bg-white text-amber-700 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition disabled:opacity-50"
                      >
                        {isDeploying ? 'Syncing...' : 'Deploy to Vault'}
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Staged Items */}
                    {stagedQuestions.map((q, idx) => (
                      <div key={`staged-${idx}`} className={`p-3 rounded-xl border-2 transition-all relative group ${editingIndex === idx
                        ? 'border-primary-400 bg-white ring-2 ring-primary-100'
                        : 'border-amber-200/50 bg-amber-50/20'
                        }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-amber-600 font-black text-[10px]">#{savedQuestions.length + idx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => startEditStaged(idx)} className="text-slate-400 hover:text-primary-600 p-1"><i className="fas fa-pen text-[10px]"></i></button>
                            <button onClick={() => removeFromStage(idx)} className="text-slate-400 hover:text-red-500 p-1"><i className="fas fa-times-circle text-[10px]"></i></button>
                          </div>
                        </div>
                        <p className="font-bold text-black text-xs line-clamp-2 leading-tight">{q.text}</p>
                      </div>
                    ))}

                    {/* Saved Items */}
                    {savedQuestions.map((q, idx) => (
                      <div key={q.id} className={`p-3 rounded-xl border transition-all ${editingSavedId === q.id
                        ? 'border-primary-400 bg-white ring-2 ring-primary-100'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-slate-400 font-black text-[10px]">#{idx + 1}</span>
                          <span className="text-[8px] font-black text-slate-300 uppercase">Vault</span>
                        </div>
                        <p className="font-bold text-black text-xs line-clamp-2 leading-tight">{q.text}</p>
                      </div>
                    ))}
                    
                    {savedQuestions.length === 0 && stagedQuestions.length === 0 && (
                      <div className="py-12 text-center opacity-40">
                        <i className="fas fa-layer-group text-2xl mb-2"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">Sequence Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Panel 1: Composer (Centered & Dominant) */}
            <div className={`h-full flex flex-col transition-all duration-500 ${activeTab !== 'compose' ? 'hidden lg:flex' : 'flex'}`}>
              <div className="flex-1 flex flex-col p-5 sm:p-6 shadow-2xl shadow-slate-200/60 bg-white rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div>
                    <h2 className="text-lg font-black text-black leading-none mb-1">
                      {editingSavedId ? `Vault Edit` : editingIndex !== null ? `Stage Edit` : 'Composer'}
                    </h2>
                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em]">
                      Item Registry #{nextQuestionNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(editingIndex !== null || editingSavedId) && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      form="question-builder-form"
                      className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition shadow-md flex items-center gap-1.5 ${editingIndex !== null || editingSavedId
                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200/50'
                        : 'bg-slate-900 text-white hover:bg-primary-600 shadow-slate-300/50'
                        }`}
                    >
                      {editingSavedId ? (
                        <><i className="fas fa-save text-[8px]"></i> Save to Vault</>
                      ) : editingIndex !== null ? (
                        <><i className="fas fa-check text-[8px]"></i> Update</>
                      ) : (
                        <><i className="fas fa-plus text-[8px]"></i> Add to Sequence</>
                      )}
                    </button>
                  </div>
                </div>

                <form 
                  id="question-builder-form"
                  onSubmit={addToStage} 
                  className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar"
                >
                  <div className="shrink-0">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center">
                      <i className="fas fa-quote-left mr-2 text-primary-500"></i> Question Inquiry
                    </label>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition min-h-[80px] text-black font-bold text-sm leading-relaxed shadow-inner"
                      placeholder="Enter the examination question text..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                        <i className="fas fa-list-ul mr-2 text-primary-500"></i> Response Options
                      </label>
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Select Correct</span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2.5 group">
                          <button
                            type="button"
                            onClick={() => setCorrect(i)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] transition-all flex-shrink-0 shadow-sm ${
                              correct === i 
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
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
                              placeholder={`Response option ${String.fromCharCode(65 + i)}`}
                              className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold transition-all ${
                                correct === i 
                                  ? 'border-emerald-500 bg-emerald-50/30 text-black shadow-inner' 
                                  : 'border-slate-100 bg-white focus:border-primary-500'
                              }`}
                              required
                            />
                            {correct === i && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                                <i className="fas fa-check-circle text-[10px]"></i>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

            </div>

            {/* Panel 3: Vault Registry */}
            <div className={`h-full flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/60 transition-all duration-300 overflow-hidden ${activeTab !== 'vault' ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                {!rightCollapsed ? (
                  <>
                    <h2 className="text-[10px] font-black text-black uppercase tracking-widest flex items-center">
                      <span className="w-1.5 h-4 bg-slate-900 rounded-full mr-2"></span>
                      Examination Vault
                    </h2>
                    <button onClick={() => setRightCollapsed(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                      <i className="fas fa-chevron-right text-xs"></i>
                    </button>
                  </>
                ) : (
                  <button onClick={() => setRightCollapsed(false)} className="w-full py-2 flex flex-col items-center gap-4 text-slate-600" title="Expand Vault">
                    <i className="fas fa-vault text-sm"></i>
                    <span className="text-[9px] font-black">{savedQuestions.length}</span>
                    <i className="fas fa-chevron-left text-[10px] opacity-40 mt-auto"></i>
                  </button>
                )}
              </div>
              
              {!rightCollapsed && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                  {savedQuestions.length === 0 ? (
                    <div className="py-20 text-center opacity-40">
                      <i className="fas fa-lock text-2xl mb-2"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Vault Empty</p>
                    </div>
                  ) : (
                    savedQuestions.map((q) => (
                      <div key={`vault-${q.id}`} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-primary-200 transition-all group shadow-sm">
                        <div className="flex justify-between items-start gap-2 mb-2">
                           <span className="bg-slate-50 text-[8px] font-black px-1.5 py-0.5 rounded text-slate-400 uppercase">Registry Item</span>
                           <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditSaved(q)}
                                className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-primary-600 flex items-center justify-center transition-colors"
                              >
                                <i className="fas fa-edit text-[10px]"></i>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm("Permanently remove this item from the module vault?")) {
                                    await questionService.deleteQuestion(q.id, quizId!);
                                    loadData(quizId!);
                                  }
                                }}
                                className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                              >
                                <i className="fas fa-trash text-[10px]"></i>
                              </button>
                           </div>
                        </div>
                        <p className="text-xs font-bold text-black line-clamp-2 leading-tight">{q.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>

    </div>
  );
};

export default QuestionBuilder;

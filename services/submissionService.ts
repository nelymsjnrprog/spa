import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  limit
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { Submission } from '../core/types';
import { onSnapshot } from 'firebase/firestore';

/**
 * Helper to get the current session ID with legacy support
 */
const getSessionId = () => localStorage.getItem('smartprep_sid') || localStorage.getItem('vsefa_sid');

/**
 * submissionService - Exam Integrity & Results
 */
export const submissionService = {
  /**
   * Identifies if the student has an existing submission for this specific quiz.
   * Fetches up to 100 of the student's recent submissions and filters locally 
   * to avoid requiring complex composite indexes while maintaining accuracy.
   */
  async getSubmission(quizId: string, userId: string): Promise<Submission | null> {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', userId),
      limit(100)
    );
    const snapshot = await getDocs(q);
    const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
    // Find the submission for the specific quiz among the student's records
    return subs.find(s => s.quizId === quizId) || null;
  },

  async getSubmissionById(id: string): Promise<Submission | null> {
    const docSnap = await getDoc(doc(db, 'submissions', id));
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Submission) : null;
  },

  subscribeToSubmission(id: string, callback: (submission: Submission | null) => void) {
    return onSnapshot(doc(db, 'submissions', id), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Submission);
      } else {
        callback(null);
      }
    });
  },

  async createSubmission(data: Omit<Submission, 'id'>): Promise<string> {
    const existing = await this.getSubmission(data.quizId, data.studentId);
    if (existing) {
      throw new Error("You have already started or completed this examination.");
    }

    const docRef = await addDoc(collection(db, 'submissions'), {
      ...data,
      sessionId: getSessionId(),
      status: 'active',
      createdAt: Date.now()
    });
    return docRef.id;
  },

  async submitExam(data: Omit<Submission, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'submissions'), {
      ...data,
      sessionId: getSessionId(),
      status: 'completed',
      createdAt: Date.now()
    });
    return docRef.id;
  },

  async autosaveAnswer(submissionId: string, questionId: string, selectedIndex: number): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, {
      [`answers.${questionId}`]: selectedIndex,
      sessionId: getSessionId()
    });
  },

  async clearAnswer(submissionId: string, questionId: string): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, {
      [`answers.${questionId}`]: deleteField(),
      sessionId: getSessionId()
    });
  },

  async finalSubmit(submissionId: string, score: number, isIncompleteAttempt: boolean = false, correctCount?: number, totalQuestions?: number, stoppedByAdmin: boolean = false): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    const updateData: any = {
      score,
      sessionId: getSessionId(),
      status: 'completed',
      completedAt: Date.now(),
      isIncompleteAttempt
    };
    if (correctCount !== undefined) updateData.correctCount = correctCount;
    if (totalQuestions !== undefined) updateData.totalQuestions = totalQuestions;
    if (stoppedByAdmin) updateData.stoppedByAdmin = true;
    await updateDoc(docRef, updateData);
  },

  async getStudentResults(studentId: string): Promise<Submission[]> {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', studentId),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
    return data.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));
  },

  async getQuizResults(quizId: string): Promise<Submission[]> {
    const q = query(
      collection(db, 'submissions'),
      where('quizId', '==', quizId),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
    return data.sort((a, b) => b.score - a.score);
  },

  async getAllSubmissions(): Promise<Submission[]> {
    const q = query(collection(db, 'submissions'), limit(500));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
    return data.sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeToAllSubmissions(callback: (submissions: Submission[]) => void, onError?: (error: any) => void) {
    const q = query(collection(db, 'submissions'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      callback(data.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Submissions subscription error:", error);
      if (onError) onError(error);
    });
  },

  subscribeToQuizSubmissions(quizId: string, callback: (submissions: Submission[]) => void) {
    const q = query(collection(db, 'submissions'), where('quizId', '==', quizId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      callback(data);
    });
  },

  subscribeToActiveSubmissions(callback: (submissions: Submission[]) => void) {
    const q = query(
      collection(db, 'submissions'),
      where('status', '==', 'active'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      const sorted = data.sort((a, b) => (b.lastActive || b.createdAt) - (a.lastActive || a.createdAt));
      callback(sorted);
    });
  },

  subscribeToStudentResults(studentId: string, callback: (submissions: Submission[]) => void, onError?: (error: any) => void) {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', studentId),
      limit(500)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      const sorted = data.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));
      callback(sorted);
    }, (error) => {
      console.error("Student results subscription error:", error);
      if (onError) onError(error);
    });
  },

  async updatePresence(submissionId: string, currentQuestionIndex: number): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, {
      lastActive: Date.now(),
      currentQuestionIndex,
      sessionId: getSessionId()
    });
  },

  async extendTime(submissionId: string, extraMinutes: number): Promise<void> {
    const docSnap = await getDoc(doc(db, 'submissions', submissionId));
    if (docSnap.exists()) {
      const currentLoc = docSnap.data().timeExtension || 0;
      await updateDoc(doc(db, 'submissions', submissionId), {
        timeExtension: currentLoc + extraMinutes,
        sessionId: getSessionId()
      });
    }
  },

  async overrideGrade(submissionId: string, newScore: number): Promise<void> {
    await updateDoc(doc(db, 'submissions', submissionId), {
      score: newScore,
      scoreOverride: newScore,
      isAdminGraded: true,
      sessionId: getSessionId()
    });
  },

  async deleteSubmission(id: string): Promise<void> {
    await deleteDoc(doc(db, 'submissions', id));
  },

  async logViolation(submissionId: string, violationCount: number): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, {
      violations: violationCount,
      lastViolationAt: Date.now(),
      sessionId: getSessionId()
    });
  }
};

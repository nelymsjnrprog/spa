import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { Question } from '../core/types';
import { quizService } from './quizService';

/**
 * questionService - Quiz Content Management
 * Ensures questions are loaded efficiently per exam.
 */
export const questionService = {
  /**
   * Load all questions for a specific quiz
   */
  async getQuestionsByQuiz(quizId: string): Promise<Question[]> {
    const q = query(
      collection(db, 'questions'),
      where('quizId', '==', quizId),
      limit(200) // Increased limit to ensure all questions in a module are fetched
    );
    const snapshot = await getDocs(q);
    const qs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

    // Stable sort: by order first, then by document ID as tiebreaker
    return qs.sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });
  },

  /**
   * Add a new question and update the parent quiz count
   */
  async addQuestion(quizId: string, data: Partial<Question>): Promise<string> {
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const docRef = await addDoc(collection(db, 'questions'), {
      ...sanitizedData,
      quizId
    });

    // Atomic update of question count in parent quiz
    await quizService.updateQuiz(quizId, { totalQuestions: increment(1) as any });
    
    return docRef.id;
  },

  /**
   * Add multiple questions in a single atomic batch
   */
  async batchAddQuestions(quizId: string, questions: Partial<Question>[]): Promise<void> {
    const batch = writeBatch(db);
    const questionsCol = collection(db, 'questions');

    questions.forEach((q) => {
      // Sanitize: Firestore throws if an object contains 'undefined'
      const sanitizedQ = Object.fromEntries(
        Object.entries(q).filter(([_, v]) => v !== undefined)
      );

      const docRef = doc(questionsCol);
      batch.set(docRef, {
        ...sanitizedQ,
        quizId,
        createdAt: Date.now()
      });
    });

    // Atomic update of question count in parent quiz (batch write)
    batch.update(doc(db, 'quizzes', quizId), { totalQuestions: increment(questions.length) });

    await batch.commit();
  },

  async updateQuestion(id: string, data: Partial<Question>): Promise<void> {
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(doc(db, 'questions', id), sanitizedData);
  },

  async deleteQuestion(id: string, quizId: string): Promise<void> {
    await deleteDoc(doc(db, 'questions', id));
    // Atomic update of question count in parent quiz
    await quizService.updateQuiz(quizId, { totalQuestions: increment(-1) as any });
  }
};
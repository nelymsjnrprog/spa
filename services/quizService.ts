
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { Quiz } from '../core/types';

/**
 * quizService - Exam Availability & Management
 */
export const quizService = {
  async getPublishedQuizzes(): Promise<Quiz[]> {
    const q = query(
      collection(db, 'quizzes'),
      where('published', '==', true),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
    return data.sort((a, b) => b.createdAt - a.createdAt);
  },

  async getAllQuizzes(): Promise<Quiz[]> {
    // Explicit limit added to satisfy security rules for collection listing
    const q = query(collection(db, 'quizzes'), limit(500));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
    return data.sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeToQuizzes(callback: (quizzes: Quiz[]) => void, onError?: (error: any) => void) {
    const q = query(collection(db, 'quizzes'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      callback(data.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Quiz subscription error:", error);
      if (onError) onError(error);
    });
  },

  async getQuiz(id: string): Promise<Quiz | null> {
    const docSnap = await getDoc(doc(db, 'quizzes', id));
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Quiz) : null;
  },

  subscribeToQuiz(id: string, callback: (quiz: Quiz | null) => void) {
    return onSnapshot(doc(db, 'quizzes', id), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Quiz);
      } else {
        callback(null);
      }
    });
  },

  async createQuiz(data: Partial<Quiz>, uid: string): Promise<string> {
    const docRef = await addDoc(collection(db, 'quizzes'), {
      ...data,
      createdBy: uid,
      createdAt: Date.now(),
      published: false,
      totalQuestions: 0
    });
    return docRef.id;
  },

  async updateQuiz(id: string, data: Partial<Quiz>): Promise<void> {
    await updateDoc(doc(db, 'quizzes', id), data);
  },

  async setQuizStatus(id: string, status: Quiz['status']): Promise<void> {
    await updateDoc(doc(db, 'quizzes', id), { status });
  },

  async broadcastAnnouncement(id: string, announcement: string): Promise<void> {
    await updateDoc(doc(db, 'quizzes', id), { announcement });
  },

  /**
   * Performs a permanent "Purge Delete" of the quiz.
   * Removes: The Quiz Doc, All associated Questions, and All Student Submissions.
   */
  async deleteQuiz(id: string): Promise<void> {
    const batch = writeBatch(db);

    // 1. Fetch all questions linked to this quiz
    const questionsQuery = query(collection(db, 'questions'), where('quizId', '==', id));
    const questionsSnapshot = await getDocs(questionsQuery);

    // 2. Fetch all submissions linked to this quiz (to remove from student history)
    const submissionsQuery = query(collection(db, 'submissions'), where('quizId', '==', id));
    const submissionsSnapshot = await getDocs(submissionsQuery);

    // 3. Add questions to deletion batch
    questionsSnapshot.docs.forEach((qDoc) => {
      batch.delete(qDoc.ref);
    });

    // 4. Add submissions to deletion batch
    submissionsSnapshot.docs.forEach((sDoc) => {
      batch.delete(sDoc.ref);
    });

    // 5. Delete the quiz document itself
    batch.delete(doc(db, 'quizzes', id));

    // 6. Commit the full batch
    await batch.commit();
  },

  /**
   * Duplicate a quiz and all its questions to a new institution/level.
   * Super admin only feature.
   */
  async duplicateQuiz(sourceQuizId: string, targetInstitution: string, targetLevel: string, createdBy: string): Promise<string> {
    // 1. Get the source quiz
    const sourceQuiz = await this.getQuiz(sourceQuizId);
    if (!sourceQuiz) throw new Error('Source quiz not found');

    // 2. Get all questions for the source quiz
    const questionsQuery = query(collection(db, 'questions'), where('quizId', '==', sourceQuizId), limit(200));
    const questionsSnapshot = await getDocs(questionsQuery);
    const sourceQuestions = questionsSnapshot.docs.map(d => ({ ...d.data() }));

    // 3. Create the new quiz (copy all settings, override institution/level)
    const { id, ...quizData } = sourceQuiz;
    const newQuizRef = await addDoc(collection(db, 'quizzes'), {
      ...quizData,
      institution: targetInstitution,
      level: targetLevel,
      createdBy,
      createdAt: Date.now(),
      published: false,
      totalQuestions: sourceQuestions.length
    });

    // 4. Batch-copy all questions to the new quiz
    if (sourceQuestions.length > 0) {
      const batch = writeBatch(db);
      sourceQuestions.forEach((qData) => {
        const { quizId, ...questionFields } = qData as any;
        const newDocRef = doc(collection(db, 'questions'));
        batch.set(newDocRef, {
          ...questionFields,
          quizId: newQuizRef.id,
          createdAt: Date.now()
        });
      });
      await batch.commit();
    }

    return newQuizRef.id;
  },

  /**
   * Merges questions from source quiz into destination quiz.
   * Options to delete the source quiz after merge.
   */
  async mergeQuizzes(sourceId: string, destinationId: string, deleteSource: boolean): Promise<{ mergedCount: number, totalCount: number }> {
    // 1. Get source and destination questions
    const sourceQuestionsQuery = query(collection(db, 'questions'), where('quizId', '==', sourceId), limit(1000));
    const destQuestionsQuery = query(collection(db, 'questions'), where('quizId', '==', destinationId), limit(1000));
    
    const [sourceSnap, destSnap] = await Promise.all([
      getDocs(sourceQuestionsQuery),
      getDocs(destQuestionsQuery)
    ]);

    const sourceDocs = sourceSnap.docs;
    const destDocs = destSnap.docs;
    
    // Find highest question order in destination to continue sequence
    let lastOrder = 0;
    destDocs.forEach(d => {
      const o = d.data().order || d.data().number || 0;
      if (o > lastOrder) lastOrder = o;
    });

    const batch = writeBatch(db);
    
    // 2. Add merged questions to batch with new order numbers
    sourceDocs.forEach((qDoc, index) => {
      const data = qDoc.data();
      const newQuestionRef = doc(collection(db, 'questions'));
      batch.set(newQuestionRef, {
        ...data,
        quizId: destinationId,
        order: lastOrder + index + 1,
        createdAt: Date.now()
      });
    });

    // 3. Update destination total count
    const totalCount = destDocs.length + sourceDocs.length;
    batch.update(doc(db, 'quizzes', destinationId), { totalQuestions: totalCount });

    // 4. If deleteSource, add source quiz and its questions to batch (Atomic!)
    if (deleteSource) {
      sourceDocs.forEach(d => batch.delete(d.ref));
      
      // Also delete submissions for source (to keep it clean as per deleteQuiz logic)
      const submissionsQuery = query(collection(db, 'submissions'), where('quizId', '==', sourceId));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      submissionsSnapshot.docs.forEach(sDoc => batch.delete(sDoc.ref));
      
      batch.delete(doc(db, 'quizzes', sourceId));
    }

    await batch.commit();
    return { mergedCount: sourceDocs.length, totalCount };
  }
};

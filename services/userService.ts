import { doc, getDoc, updateDoc, collection, getDocs, query, limit, deleteDoc, where, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../core/firebase";
import { UserProfile } from "../core/types";

/**
 * userService - Identity & Role Management
 */
export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, data);
  },

  async getAllUsers(): Promise<UserProfile[]> {
    // Explicit limit added to satisfy security rules for collection listing
    const q = query(collection(db, "users"), limit(500));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
    return data.sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeToUsers(callback: (users: UserProfile[]) => void) {
    const q = query(collection(db, "users"), limit(500));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      callback(data.sort((a, b) => b.createdAt - a.createdAt));
    });
  },

  /**
   * Soft Delete a user by removing their profile and all exam submissions.
   * Note: This does not delete their Firebase Auth account, but locking them out
   * by removing their profile prevents login.
   */
  async deleteUserData(uid: string): Promise<void> {
    // 1. Delete user profile
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);

    // 2. Query and delete all submissions by this user
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', uid)
    );
    const snapshot = await getDocs(q);

    // Process deletions in bulk locally (or with batched writes, but looping deletes is fine for small limits)
    const deletePromises = snapshot.docs.map(submissionDoc => deleteDoc(submissionDoc.ref));
    await Promise.all(deletePromises);
  },

  async promoteAllStudents(currentLevel: string): Promise<number> {
    let nextLevel = '';
    if (currentLevel === '300') {
      nextLevel = 'Candidate';
    } else {
      const nextLevelNum = parseInt(currentLevel) + 100;
      if (nextLevelNum > 300) throw new Error("Maximum level exceeded.");
      nextLevel = nextLevelNum.toString();
    }

    // Fetch all students to ensure we accurately capture those with missing 'level' fields (defaults to 100)
    const q = query(
      collection(db, "users"),
      where('role', '==', 'student')
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach(userDoc => {
      const data = userDoc.data();
      // Logic consistency: If no level is set, student is Level 100
      const effectiveLevel = data.level || '100';
      
      if (effectiveLevel === currentLevel) {
        batch.update(userDoc.ref, { level: nextLevel });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return count;
  }
};
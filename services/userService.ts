import { doc, getDoc, updateDoc, collection, getDocs, query, limit, deleteDoc, where, onSnapshot, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../core/firebase";
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
   * Permanent Delete: Deletes the Firebase Auth account via Cloud Function.
   * Also performs a manual purge of Firestore data (profile + submissions) 
   * to ensure immediate removal even if extensions are not configured.
   */
  async deleteUserData(uid: string): Promise<void> {
    try {
      // 1. Trigger Auth account deletion
      const deleteAccount = httpsCallable(functions, 'deleteUserAccount');
      await deleteAccount({ uid }).catch(err => {
        console.warn("Auth deletion via Cloud Function failed, proceeding with manual data purge:", err);
      });

      // 2. Manual Data Purge (Immediate cleanup)
      const batch = writeBatch(db);
      
      // Delete user profile
      batch.delete(doc(db, "users", uid));

      // Fetch and delete all student submissions/results
      const submissionsQuery = query(collection(db, "submissions"), where('studentId', '==', uid));
      const submissionsSnap = await getDocs(submissionsQuery);
      submissionsSnap.docs.forEach(sDoc => {
        batch.delete(sDoc.ref);
      });

      // Execute batch deletion
      await batch.commit();
    } catch (err: any) {
      console.error("Critical error during user data purge:", err);
      throw new Error(`Deletion failed: ${err.message}`);
    }
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
        batch.update(userDoc.ref, { 
          level: nextLevel,
          membershipStatus: 'pending',
          paid: false
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return count;
  }
};

import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { storage } from "../core/firebase";

/**
 * storageService - Exam Resource Management
 * Handles binary assets like PDFs and images for quizzes.
 */
export const storageService = {
  /**
   * Upload a file to a specific quiz directory
   */
  async uploadFile(quizId: string, file: File): Promise<string> {
    const fileRef = ref(storage, `exam_files/${quizId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return await getDownloadURL(snapshot.ref);
  },

  /**
   * List all files associated with a specific quiz
   */
  async getFilesByQuiz(quizId: string) {
    const listRef = ref(storage, `exam_files/${quizId}`);
    const res = await listAll(listRef);
    
    const filePromises = res.items.map(async (item) => {
      const url = await getDownloadURL(item);
      return {
        name: item.name,
        fullPath: item.fullPath,
        url
      };
    });

    return Promise.all(filePromises);
  },

  /**
   * Remove a resource
   */
  async deleteFile(fullPath: string): Promise<void> {
    const fileRef = ref(storage, fullPath);
    await deleteObject(fileRef);
  }
};

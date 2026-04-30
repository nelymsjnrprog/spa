
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../core/firebase';
import { LibraryResource } from '../core/types';

export const libraryService = {
  /**
   * Upload PDF and optional thumbnail to Storage, then save metadata to Firestore
   */
  async uploadResource(
    data: Omit<LibraryResource, 'id' | 'fileUrl' | 'thumbnailUrl' | 'uploadedAt'>,
    pdfFile: File,
    thumbnailFile?: File
  ) {
    const timestamp = Date.now();
    
    // 1. Upload PDF
    const pdfPath = `library/${data.level}/${timestamp}_${pdfFile.name}`;
    const pdfRef = ref(storage, pdfPath);
    const pdfSnapshot = await uploadBytes(pdfRef, pdfFile);
    const fileUrl = await getDownloadURL(pdfSnapshot.ref);

    // 2. Upload Thumbnail if exists
    let thumbnailUrl = '';
    if (thumbnailFile) {
      const thumbPath = `library/${data.level}/thumb_${timestamp}_${thumbnailFile.name}`;
      const thumbRef = ref(storage, thumbPath);
      const thumbSnapshot = await uploadBytes(thumbRef, thumbnailFile);
      thumbnailUrl = await getDownloadURL(thumbSnapshot.ref);
    }

    // 3. Save to Firestore
    return await addDoc(collection(db, 'Library'), {
      ...data,
      fileUrl,
      thumbnailUrl,
      fileSize: pdfFile.size,
      uploadedAt: serverTimestamp()
    });
  },

  /**
   * Subscribe to library resources.
   * Admins see all. Students can filter by level and published status.
   */
  subscribeToLibrary(callback: (resources: LibraryResource[]) => void, filters?: { level?: string; onlyPublished?: boolean }) {
    let q = query(collection(db, 'Library'), orderBy('uploadedAt', 'desc'));

    if (filters?.level) {
      q = query(q, where('level', '==', filters.level));
    }

    if (filters?.onlyPublished) {
      q = query(q, where('published', '==', true));
    }

    return onSnapshot(q, (snapshot) => {
      const resources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LibraryResource));
      callback(resources);
    });
  },

  /**
   * Delete resource from Firestore and Storage
   */
  async deleteResource(id: string, fileUrl: string, thumbnailUrl?: string) {
    // Delete from Storage
    const pdfRef = ref(storage, fileUrl);
    await deleteObject(pdfRef).catch(err => console.error("Error deleting PDF from storage:", err));

    if (thumbnailUrl) {
      const thumbRef = ref(storage, thumbnailUrl);
      await deleteObject(thumbRef).catch(err => console.error("Error deleting thumbnail from storage:", err));
    }

    // Delete from Firestore
    return await deleteDoc(doc(db, 'Library', id));
  },

  /**
   * Toggle published status
   */
  async togglePublish(id: string, published: boolean) {
    return await updateDoc(doc(db, 'Library', id), { published });
  }
};

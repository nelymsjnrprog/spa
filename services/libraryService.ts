
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
    // To avoid "Missing or insufficient permissions" and composite index requirements:
    // 1. We must query exactly what the rules allow (published == true)
    // 2. We perform level filtering and sorting client-side
    
    let q = query(collection(db, 'Library'));
    
    if (filters?.onlyPublished) {
      q = query(q, where('published', '==', true));
    }

    return onSnapshot(q, (snapshot) => {
      let resources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LibraryResource));

      // Client-side filtering for level (if specified)
      if (filters?.level) {
        resources = resources.filter(r => String(r.level) === String(filters.level));
      }

      // Client-side sorting by uploadedAt descending
      resources.sort((a, b) => {
        const aTime = a.uploadedAt?.toMillis ? a.uploadedAt.toMillis() : (a.uploadedAt?.seconds ? a.uploadedAt.seconds * 1000 : 0);
        const bTime = b.uploadedAt?.toMillis ? b.uploadedAt.toMillis() : (b.uploadedAt?.seconds ? b.uploadedAt.seconds * 1000 : 0);
        return bTime - aTime;
      });

      callback(resources);
    }, (error) => {
      console.error('Library snapshot error:', error);
      callback([]);
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

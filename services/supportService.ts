
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../core/firebase';

export interface SupportInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
}

export const supportService = {
  async submitInquiry(data: Omit<SupportInquiry, 'id' | 'createdAt'>) {
    return await addDoc(collection(db, 'Support'), {
      ...data,
      createdAt: serverTimestamp()
    });
  },

  subscribeToInquiries(callback: (inquiries: SupportInquiry[]) => void) {
    const q = query(
      collection(db, 'Support'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    return onSnapshot(q, (snapshot) => {
      const inquiries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SupportInquiry));
      callback(inquiries);
    });
  },

  async deleteInquiry(id: string) {
    return await deleteDoc(doc(db, 'Support', id));
  }
};

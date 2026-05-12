import { db } from "../core/firebase";
import {
  doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, getDocs, where, serverTimestamp
} from "firebase/firestore";
import { MembershipSettings, MembershipLevelSettings, PaymentRecord, UserProfile } from "../core/types";

const SETTINGS_DOC_ID = "config";

/**
 * Default settings when none exist in Firestore yet
 */
const DEFAULT_SETTINGS: MembershipSettings = {
  form1: { paymentRequired: false, price: 0 },
  form2: { paymentRequired: false, price: 0 },
  form3: { paymentRequired: false, price: 0 },
  candidate: { paymentRequired: false, price: 0 },
};

/**
 * Map UI level string (100, 200, 300) to Firestore field name (form1, form2, form3)
 */
const levelToFormKey = (level: string): keyof MembershipSettings => {
  switch (level) {
    case '100': return 'form1';
    case '200': return 'form2';
    case '300': return 'form3';
    case 'Candidate': return 'candidate';
    default: return 'form1';
  }
};

/**
 * membershipService — Membership Settings & Payment Records
 */
export const membershipService = {

  /**
   * Get membership settings (one-time fetch)
   */
  async getMembershipSettings(): Promise<MembershipSettings> {
    try {
      const docRef = doc(db, "membership_settings", SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...DEFAULT_SETTINGS, ...docSnap.data() } as MembershipSettings;
      }
      return DEFAULT_SETTINGS;
    } catch (err) {
      console.error("Failed to fetch membership settings:", err);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Subscribe to membership settings (real-time)
   */
  subscribeMembershipSettings(callback: (settings: MembershipSettings) => void) {
    const docRef = doc(db, "membership_settings", SETTINGS_DOC_ID);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_SETTINGS, ...snap.data() } as MembershipSettings);
      } else {
        callback(DEFAULT_SETTINGS);
      }
    }, (error) => {
      console.error("Membership settings listener error:", error);
      callback(DEFAULT_SETTINGS);
    });
  },

  /**
   * Update settings for all levels (super_admin only)
   */
  async updateAllSettings(settings: MembershipSettings): Promise<void> {
    const docRef = doc(db, "membership_settings", SETTINGS_DOC_ID);
    await setDoc(docRef, settings, { merge: true });
  },

  /**
   * Update settings for a single level (super_admin only)
   */
  async updateLevelSettings(level: string, settings: MembershipLevelSettings): Promise<void> {
    const formKey = levelToFormKey(level);
    const docRef = doc(db, "membership_settings", SETTINGS_DOC_ID);
    await setDoc(docRef, { [formKey]: settings }, { merge: true });
  },

  /**
   * Get settings for a specific level
   */
  getFormLevelSettings(settings: MembershipSettings, level: string): MembershipLevelSettings {
    const formKey = levelToFormKey(level);
    return settings[formKey] || { paymentRequired: false, price: 0 };
  },

  /**
   * Record a successful payment
   */
  async recordPayment(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<string> {
    // If not explicitly set, try to infer if it's a renewal based on level > 100
    const isRenewal = payment.isRenewal !== undefined 
      ? payment.isRenewal 
      : (payment.formLevel !== '100' && payment.formLevel !== 'Candidate');

    const docRef = await addDoc(collection(db, "payments"), {
      ...payment,
      isRenewal,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  /**
   * Get recent payments (admin view)
   */
  async getRecentPayments(maxResults: number = 50): Promise<PaymentRecord[]> {
    const q = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc"),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      // Handle both number and Timestamp
      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate().getTime();
      } else if (!createdAt) {
        createdAt = Date.now();
      }

      return { 
        ...data,
        id: d.id, 
        createdAt 
      } as PaymentRecord;
    });
  },

  /**
   * Centralized Access Logic:
   * (settings[levelKey].paymentRequired === false) || (profile.membershipStatus === 'active')
   */
  checkAccess(profile: UserProfile | null, settings: MembershipSettings): boolean {
    if (!profile) return false;
    if (profile.role === 'admin') return true; 
    
    // 1. Manual override
    if (profile.membershipStatus === 'active') return true;

    // 2. We skip strict DB payment check here for performance in AuthProvider, 
    // but the 'pending' status alone will lock the user.
    // Promotion sets status to 'pending', which returns false here.
    return false;
  },

  /**
   * Activate membership for an existing user 
   */
  async activateMembership(userId: string, email: string, level: string, amount: number, reference: string, isRenewal: boolean = false): Promise<void> {
    const userRef = doc(db, "users", userId);
    
    // 1. Update user profile
    await setDoc(userRef, { 
      membershipStatus: 'active',
      paid: true // For backward compatibility with some UI checks
    }, { merge: true });

    // 2. Record the payment
    await this.recordPayment({
      email: email.toLowerCase(),
      formLevel: level,
      amount: amount,
      status: 'success',
      reference: reference,
      userId: userId,
      isRenewal: isRenewal,
      createdAt: Date.now(),
    });
  },

  /**
   * Check if a user has a successful payment record for a specific level
   */
  async hasPaidForLevel(userId: string, level: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, "payments"),
        where("userId", "==", userId),
        where("formLevel", "==", level),
        where("status", "==", "success"),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) {
      console.error("Error checking payment history:", err);
      return false;
    }
  },

  levelToFormKey,
};

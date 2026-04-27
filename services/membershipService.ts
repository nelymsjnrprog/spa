import { db } from "../core/firebase";
import {
  doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, getDocs
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
  async recordPayment(payment: Omit<PaymentRecord, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, "payments"), payment);
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
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
  },

  /**
   * Centralized Access Logic:
   * (settings[levelKey].paymentRequired === false) || (profile.membershipStatus === 'active')
   */
  checkAccess(profile: UserProfile | null, settings: MembershipSettings): boolean {
    if (!profile) return false;
    if (profile.role === 'admin') return true; // Admins always have access
    
    const formKey = levelToFormKey(profile.level || '100');
    const levelSettings = settings[formKey];
    
    // If payment is NOT required for this level, grant access
    if (!levelSettings?.paymentRequired) return true;
    
    // If payment IS required, check student membership status correctly
    // Combine both fields for maximum compatibility
    return profile.membershipStatus === 'active' || profile.paid === true;
  },

  /**
   * Activate membership for an existing user 
   */
  async activateMembership(userId: string, email: string, level: string, amount: number, reference: string): Promise<void> {
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
      createdAt: Date.now(),
    });
  },

  levelToFormKey,
};

import { db, auth } from "../core/firebase";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  doc, updateDoc, setDoc, where, getDocs, Timestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getAuth,
  signOut,
  setPersistence,
  inMemoryPersistence
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { APP_CONFIG } from "../core/config";
import { AdminPermission, AdminLog, UserProfile } from "../core/types";

// Initialize a secondary Firebase instance for administrative user creation
// This prevents the administrator from being signed out during the process.
const secondaryApp = getApps().find(a => a.name === 'Secondary') || initializeApp(APP_CONFIG.firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

// Ensure secondary instance doesn't persist to local storage/interfere with main auth
setPersistence(secondaryAuth, inMemoryPersistence).catch(console.error);

const SYSTEM_OWNER_EMAIL = "nelymsjnr@gmail.com";

/**
 * adminService — Admin Permissions, Action Logging & Presence
 */
export const adminService = {

  /**
   * Check if a user is the system owner (permanent super admin)
   */
  isSystemOwner(email?: string): boolean {
    return email?.toLowerCase() === SYSTEM_OWNER_EMAIL;
  },

  /**
   * Get the effective admin permission for a profile.
   * System owner always gets super_admin.
   * Existing admins without adminPermission default to super_admin.
   */
  getEffectivePermission(profile: UserProfile | null): AdminPermission {
    if (!profile || profile.role !== 'admin') return 'viewer';
    if (this.isSystemOwner(profile.email)) return 'super_admin';
    return profile.adminPermission || 'super_admin'; // Default existing admins to super_admin
  },

  /**
   * Check if admin can manage a specific resource (by institution)
   */
  canManageInstitution(profile: UserProfile | null, institution?: string): boolean {
    if (!profile || profile.role !== 'admin') return false;
    const perm = this.getEffectivePermission(profile);
    if (perm === 'super_admin') return true;
    if (perm === 'viewer') return false;
    
    // institution_admin: check assignedInstitutions
    if (!institution) return false;
    const targetInst = institution.trim().toLowerCase();
    return (profile.assignedInstitutions || []).some(inst => inst.trim().toLowerCase() === targetInst);
  },

  /**
   * Compatibility wrapper for existing level checks
   */
  canManageLevel(profile: UserProfile | null, _level: string): boolean {
    // With new architecture, level access is implicitly granted if you have institution access
    // or if you are a super admin. We don't restrict by level anymore.
    const perm = this.getEffectivePermission(profile);
    return perm === 'super_admin' || perm === 'institution_admin';
  },

  /**
   * Check if admin has write access (not a viewer)
   */
  canWrite(profile: UserProfile | null): boolean {
    if (!profile || profile.role !== 'admin') return false;
    const perm = this.getEffectivePermission(profile);
    return perm !== 'viewer';
  },

  /**
   * Update admin's permissions (super_admin only action)
   */
  async setAdminPermissions(
    uid: string,
    permission: AdminPermission,
    assignedInstitutions: string[]
  ): Promise<void> {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
      adminPermission: permission,
      assignedInstitutions: assignedInstitutions,
    });
  },

  /**
   * Promote a user to admin role
   */
  async promoteToAdmin(uid: string, permission: AdminPermission = 'institution_admin', assignedInstitutions: string[] = []): Promise<void> {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
      role: 'admin',
      adminPermission: permission,
      assignedInstitutions: assignedInstitutions,
    });
  },

  /**
   * Demote an admin back to student
   */
  async demoteToStudent(uid: string): Promise<void> {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
      role: 'student',
      adminPermission: null,
      assignedInstitutions: null,
    });
  },

  /**
   * Create a brand new admin account (superadmin only).
   * Creates Firebase Auth user + Firestore profile, then re-authenticates the calling superadmin.
   */
  async createAdminAccount(
    email: string,
    password: string,
    displayName: string,
    permission: AdminPermission,
    assignedInstitutions: string[]
  ): Promise<void> {
    // 1. Create user using the secondary auth instance (so admin isn't signed out)
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUserUid = credential.user.uid;
    const newUser = credential.user;
    
    // 2. Update display name on the secondary instance
    await updateProfile(newUser, { displayName });

    // 3. Create the Firestore profile using the primary db instance.
    // Since the main 'auth' is still the admin, this write uses admin permissions.
    await setDoc(doc(db, "users", newUserUid), {
      uid: newUserUid,
      displayName,
      email: email.toLowerCase(),
      institution: 'Admin',
      phoneNumber: '',
      level: '100',
      program: '',
      role: 'admin',
      adminPermission: permission,
      assignedInstitutions,
      isBlocked: false,
      membershipStatus: 'active',
      createdAt: Date.now(),
    });

    // 4. Sign out of secondary instance to be clean
    await signOut(secondaryAuth);
  },

  /**
   * Create a brand new student account (superadmin only).
   * Bypasses the public signup and payment gates.
   */
  async createStudentAccount(
    email: string,
    password: string,
    displayName: string,
    phoneNumber: string,
    institution: string,
    level: string,
    program: string,
    membershipStatus: 'active' | 'pending'
  ): Promise<void> {
    // 1. Create student using secondary auth instance
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUserUid = credential.user.uid;
    const newUser = credential.user;
    
    // 2. Set profile name
    await updateProfile(newUser, { displayName });

    // 3. Create Firestore document using primary db (Admin session)
    await setDoc(doc(db, "users", newUserUid), {
      uid: newUserUid,
      displayName: displayName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber?.trim() || '',
      institution: institution || 'Pending',
      level: level || '100',
      program: program?.trim() || '',
      role: 'student',
      isBlocked: false,
      membershipStatus: membershipStatus,
      paid: membershipStatus === 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      currentSessionId: null
    });

    // 4. Cleanup
    await signOut(secondaryAuth);
  },

  // ==================== ACTION LOGGING ====================

  /**
   * Log an admin action 
   */
  async logAction(
    adminUid: string,
    adminName: string,
    action: string,
    details: string,
    level?: string
  ): Promise<void> {
    try {
      await addDoc(collection(db, "admin_logs"), {
        adminUid,
        adminName,
        action,
        details,
        level: level || null,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Failed to log admin action:", err);
    }
  },

  /**
   * Subscribe to action logs (real-time feed)
   */
  subscribeToAdminLogs(callback: (logs: AdminLog[]) => void, maxLogs: number = 50) {
    const q = query(
      collection(db, "admin_logs"),
      orderBy("timestamp", "desc"),
      limit(maxLogs)
    );
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdminLog));
      callback(logs);
    });
  },

  // ==================== ADMIN PRESENCE ====================

  /**
   * Update admin heartbeat (call every 30s)
   */
  async updateHeartbeat(uid: string): Promise<void> {
    try {
      const docRef = doc(db, "users", uid);
      await updateDoc(docRef, { lastActiveAt: Date.now() });
    } catch (err) {
      console.error("Heartbeat update failed:", err);
    }
  },

  /**
   * Subscribe to all admin users
   */
  subscribeToAdmins(callback: (admins: UserProfile[]) => void) {
    const q = query(
      collection(db, "users"),
      where("role", "==", "admin"),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      const admins = snapshot.docs.map(doc => ({
        ...doc.data()
      } as UserProfile));
      callback(admins.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0)));
    });
  },
};

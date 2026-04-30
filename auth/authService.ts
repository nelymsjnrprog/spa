
import { auth, db } from "../core/firebase";
import { membershipService } from "../services/membershipService";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { UserRole } from "../core/types";

/**
 * Translate Firebase Auth errors into user-friendly messages.
 */
const translateError = (code: string): string => {
  switch (code) {
    case "auth/user-not-found":
      return "Account not found. Please check your email or sign up.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "An unexpected error occurred. Please try again later.";
  }
};

// System Owner Configuration
const SYSTEM_OWNER_EMAIL = "nelymsjnr@gmail.com";

export const authService = {
  /**
   * Log in an existing user
   */
  async login(email: string, pass: string) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      const user = credential.user;

      // Check email verification is REMOVED

      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);
      
      // Update session ID in background, don't let rules overhead block the UI
      setDoc(doc(db, "users", user.uid), { currentSessionId: sessionId }, { merge: true })
        .catch(err => console.error("Session sync failed:", err));

      return user;
    } catch (error: any) {
      if (error.message === 'EMAIL_NOT_VERIFIED') throw error;
      throw new Error(translateError(error.code));
    }
  },

  /**
   * Sign up a new user
   * Role is now passed from the UI selection.
   */
  async signup(email: string, pass: string, name: string, institution: string, phoneNumber: string, level: string, program: string, selectedRole: UserRole = "student", paymentReference?: string, paymentAmount?: number) {
    // Pre-check: reject signup immediately if offline
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    let user: any = null;

    try {
      // Step 1: Create the Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      user = credential.user;

      // Step 2: Update display name
      await updateProfile(user, { displayName: name });

      // Step 3: Send verification email - REMOVED

      // Step 4: Determine role
      const finalRole: UserRole = email.toLowerCase() === SYSTEM_OWNER_EMAIL.toLowerCase()
        ? "admin"
        : selectedRole;

      // Step 4b: Determine if user is joining during a free period for their level
      let joinedAsFree = true; // Default to true (free signup)
      try {
        const settings = await membershipService.getMembershipSettings();
        const levelSettings = membershipService.getFormLevelSettings(settings, level);
        joinedAsFree = !levelSettings.paymentRequired;
      } catch { /* If we can't check, default to true */ }

      // Step 5: Create Firestore profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: email.toLowerCase(),
        institution: institution,
        phoneNumber: phoneNumber,
        level: level,
        program: program,
        role: finalRole,
        isBlocked: false,
        membershipStatus: 'active', // Default to active. If payment is required, Login.tsx handles it before signup.
        joinedAsFree,
        createdAt: Date.now(),
      });

      // Step 5b: Record payment if a payment reference exists
      if (paymentReference) {
        try {
          await membershipService.recordPayment({
            email: email.toLowerCase(),
            formLevel: level,
            amount: paymentAmount || 0,
            status: 'success',
            reference: paymentReference,
            userId: user.uid,
            createdAt: Date.now(),
          });
        } catch (payErr) {
          console.error("Payment record failed (non-blocking):", payErr);
        }
      }

      // Step 6: Log the session
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);
      await setDoc(doc(db, "users", user.uid), { currentSessionId: sessionId }, { merge: true });

      return user;
    } catch (error: any) {
      // ROLLBACK: If the auth account was created but a later step failed,
      // delete the account so no half-created users exist.
      if (user) {
        try {
          await deleteUser(user);
        } catch (_) {
          // If delete fails (e.g., already signed out), sign in briefly to delete
          try {
            const reAuth = await signInWithEmailAndPassword(auth, email, pass);
            await deleteUser(reAuth.user);
          } catch (_) {
            // Last resort: sign out whatever state we're in
            await signOut(auth).catch(() => { });
          }
        }
      }

      // Return a user-friendly error
      if (error.code === 'auth/network-request-failed' || !navigator.onLine) {
        throw new Error('Network error. Your account was not created. Please check your connection and try again.');
      }
      throw new Error(translateError(error.code || error.message));
    }
  },

  /**
   * Send a password reset email to the user
   */
  async sendPasswordReset(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(translateError(error.code));
    }
  },

  /**
   * Auto-detect / OAuth Sign in with Google
   */
  async signInWithGoogle(selectedRole: UserRole = "student") {
    try {
      const provider = new GoogleAuthProvider();

      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      // Determine final role: Manual selection OR System Owner override
      const finalRole: UserRole = user.email?.toLowerCase() === SYSTEM_OWNER_EMAIL.toLowerCase()
        ? "admin"
        : selectedRole;

      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);

      if (!docSnap.exists()) {
        // Determine if user is joining during a free period for level 100
        let joinedAsFree = true;
        try {
          const settings = await membershipService.getMembershipSettings();
          const levelSettings = membershipService.getFormLevelSettings(settings, '100');
          joinedAsFree = !levelSettings.paymentRequired;
        } catch { /* Default to true */ }

        await setDoc(docRef, {
          uid: user.uid,
          displayName: user.displayName || "Unknown User",
          email: user.email?.toLowerCase() || "",
          institution: "Pending",
          level: "100",
          role: finalRole,
          isBlocked: false,
          membershipStatus: 'active',
          joinedAsFree,
          currentSessionId: sessionId,
          createdAt: Date.now(),
        });
        return { user, isNewUser: true, sessionId, finalRole };
      } else {
        await setDoc(docRef, { currentSessionId: sessionId }, { merge: true });
        return { user, isNewUser: false, sessionId, finalRole };
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled');
      }
      throw new Error(translateError(error.code));
    }
  },

  /**
   * Update student Profile Details explicitly
   */
  async updateProfileDetails(uid: string, institution: string, phoneNumber: string, level: string, program: string) {
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, {
        institution,
        phoneNumber,
        level,
        program,
      }, { merge: true });
    } catch (error: any) {
      throw new Error("Failed to update profile details");
    }
  },
};

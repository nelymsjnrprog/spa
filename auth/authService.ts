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
import { UserRole, UserProfile } from "../core/types";

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

      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);
      
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
   */
  async signup(email: string, pass: string, name: string, institution: string, phoneNumber: string, level: string, program: string, selectedRole: UserRole = "student", paymentReference?: string, paymentAmount?: number) {
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    let user: any = null;

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      user = credential.user;

      await updateProfile(user, { displayName: name });

      const finalRole: UserRole = email.toLowerCase() === SYSTEM_OWNER_EMAIL.toLowerCase()
        ? "admin"
        : selectedRole;

      const userProfile: UserProfile = {
        uid: user.uid,
        displayName: name,
        email: email.toLowerCase(),
        institution: institution,
        phoneNumber: phoneNumber,
        level: level,
        program: program,
        role: finalRole,
        isBlocked: false,
        membershipStatus: paymentReference ? 'active' : 'pending',
        createdAt: Date.now(),
      };

      await setDoc(doc(db, "users", user.uid), userProfile);

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
          console.error("Payment record failed:", payErr);
        }
      }

      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);
      await setDoc(doc(db, "users", user.uid), { currentSessionId: sessionId }, { merge: true });

      return user;
    } catch (error: any) {
      if (user) {
        try { await deleteUser(user); } catch (_) {
          try {
            const reAuth = await signInWithEmailAndPassword(auth, email, pass);
            await deleteUser(reAuth.user);
          } catch (_) {
            await signOut(auth).catch(() => { });
          }
        }
      }
      throw new Error(translateError(error.code || error.message));
    }
  },

  async sendPasswordReset(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(translateError(error.code));
    }
  },

  async signInWithGoogle(selectedRole: UserRole = "student") {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      const finalRole: UserRole = user.email?.toLowerCase() === SYSTEM_OWNER_EMAIL.toLowerCase()
        ? "admin"
        : selectedRole;

      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('smartprep_sid', sessionId);

      if (!docSnap.exists()) {
        // Block new student account creation if Level 100 enrollment is closed
        if (finalRole === 'student') {
          const settings = await membershipService.getMembershipSettings();
          const levelSettings = membershipService.getFormLevelSettings(settings, '100');
          if (!levelSettings.paymentRequired) {
            throw new Error("Enrollment is currently closed. Please contact your institution.");
          }
        }

        const userProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || "Unknown User",
          email: user.email?.toLowerCase() || "",
          institution: "Pending",
          level: "100",
          role: finalRole,
          isBlocked: false,
          membershipStatus: 'pending',
          currentSessionId: sessionId,
          createdAt: Date.now(),
        };

        await setDoc(docRef, userProfile);
        
        return { user, isNewUser: true, sessionId, finalRole };
      } else {
        await setDoc(docRef, { currentSessionId: sessionId }, { merge: true });
        return { user, isNewUser: false, sessionId, finalRole };
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') throw new Error('Sign-in cancelled');
      throw new Error(translateError(error.code));
    }
  },

  async updateProfileDetails(uid: string, institution: string, phoneNumber: string, level: string, program: string) {
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, { institution, phoneNumber, level, program }, { merge: true });
    } catch (error: any) {
      throw new Error("Failed to update profile details");
    }
  },
};

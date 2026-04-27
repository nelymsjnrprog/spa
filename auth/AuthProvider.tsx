import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../core/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { UserRole, UserProfile, MembershipSettings } from "../core/types";
import { membershipService } from "../services/membershipService";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  membershipSettings: MembershipSettings | null;
  isLocked: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// System Owner Configuration
const SYSTEM_OWNER_EMAIL = "nelymsjnr@gmail.com";
const SYSTEM_OWNER_UID = "lcfFiLMTu3WULPpiXb4joCX1W3s1";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        setLoading(true);
        const docRef = doc(db, "users", firebaseUser.uid);
        const isSystemOwner = firebaseUser.uid === SYSTEM_OWNER_UID ||
          firebaseUser.email?.toLowerCase() === SYSTEM_OWNER_EMAIL;

        // --- Session Migration Logic ---
        const smartSid = localStorage.getItem('smartprep_sid');
        const vsefaSid = localStorage.getItem('vsefa_sid');
        if (!smartSid && vsefaSid) {
          localStorage.setItem('smartprep_sid', vsefaSid);
        }
        // -------------------------------

        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            const initialRole: UserRole = isSystemOwner ? "admin" : "student";
            await setDoc(docRef, {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "Academy Member",
              email: firebaseUser.email?.toLowerCase() || "",
              institution: "Pending",
              level: "100", // Default to level 100 for Ghanaians
              role: initialRole,
              isBlocked: false,
              createdAt: Date.now(),
            });
          }

          unsubscribeProfile = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;

              setProfile(data);
              setRole(isSystemOwner ? "admin" : data.role);

              // --- Self-Healing: Sync 'paid' field with 'membershipStatus' ---
              // If a user has 'paid: true' but 'membershipStatus' is not 'active',
              // we automatically heal their profile in the background.
              if (data.role === 'student' && (data as any).paid === true && data.membershipStatus !== 'active') {
                updateDoc(docRef, { membershipStatus: 'active' }).catch(e => console.error("Self-healing failed:", e));
              }

              // --- Single Session Enforcement ---
              // Only enforce for students to avoid locking out admins
              if (data.role === 'student' && data.currentSessionId) {
                const persistentSid = localStorage.getItem('smartprep_sid');

                if (persistentSid && persistentSid !== data.currentSessionId) {
                  // Session mismatch! Another browser/device logged in.
                  alert("Security Alert: This account was logged in from another device or browser. You have been disconnected for security.");
                  auth.signOut();
                  localStorage.removeItem('smartprep_sid');
                  return;
                }
              }
              // ----------------------------------

              setLoading(false);
            } else {
              // Soft Delete Check:
              // If the user's Auth account still exists but their profile document
              // was deleted by an admin, immediately log them out and reject access.
              setProfile(null);
              setRole(null);
              // Store specific error for Login screen to pick up
              localStorage.setItem('smartprep_login_error', "Denial Access? (Contact Support)");
              auth.signOut();
              localStorage.removeItem('smartprep_sid');
              setLoading(false);
            }
          }, (error) => {
            console.error("Profile sync error:", error);
            if (isSystemOwner) setRole("admin");
            setLoading(false);
          });
        } catch (error) {
          console.error("Auth initialization failure:", error);
          if (isSystemOwner) setRole("admin");
          setLoading(false);
        }
      } else {
        // No firebase user exists (unauthenticated guest)
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    const unsubscribeSettings = membershipService.subscribeMembershipSettings((settings) => {
      setMembershipSettings(settings);
    });

    return () => unsubscribeSettings();
  }, []);

  const isLocked = React.useMemo(() => {
    if (!profile || !membershipSettings) return false;
    return !membershipService.checkAccess(profile, membershipSettings);
  }, [profile, membershipSettings]);

  const logout = async () => {
    localStorage.removeItem('smartprep_sid');
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, membershipSettings, isLocked, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
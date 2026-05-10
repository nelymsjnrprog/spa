
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

import { APP_CONFIG } from './config';

/**
 * VSEFA / Smart Prep
 * Core Firebase Configuration & Initialization
 */

// Initialize Firebase App instance exactly once
console.log("Initializing Firebase for Project:", APP_CONFIG.firebaseConfig.projectId);
const app = initializeApp(APP_CONFIG.firebaseConfig);

// Initialize and export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Safe Analytics initialization (requires browser environment and isSupported check)
let analyticsInstance: any = null;
if (typeof window !== 'undefined') {
  isSupported().then(yes => {
    if (yes) {
      analyticsInstance = getAnalytics(app);
    }
  }).catch(err => {
    console.warn("Firebase Analytics is not supported in this environment:", err);
  });
}

export const analytics = analyticsInstance;

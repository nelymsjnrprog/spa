/// <reference types="vite/client" />

export const ALLOWED_EMAIL_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'live.com',
    'msn.com',
];

export const APP_CONFIG = {
    appId: import.meta.env.VITE_APP_ID || 'smartprep',
    name: import.meta.env.VITE_APP_NAME || 'SmartPrepAca',
    institution: import.meta.env.VITE_INSTITUTION || 'SmartPrepAca Academy',
    firebaseConfig: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    }
};



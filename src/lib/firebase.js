/**
 * Firebase is used for Storage only (listing images) — auth and app data now
 * live in Supabase (see lib/supabase.js, lib/profileService.js, firestoreStore.js).
 */
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
    /** Production: set to moveazy.in so Google OAuth shows your domain; keep *.firebaseapp.com for local dev if easier. */
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000:web:000",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXX",
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "demo-key" &&
  firebaseConfig.authDomain !== "demo.firebaseapp.com" &&
  firebaseConfig.projectId !== "demo-project";

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);
export default app;

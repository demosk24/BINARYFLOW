import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Cast import.meta to any to avoid TS errors about missing 'env' property
const env = (import.meta as any).env;

// Validate Environment Variables for Vercel/Production
const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingKeys = requiredKeys.filter(key => !env[key]);
if (missingKeys.length > 0) {
  console.error(`[FIREBASE ERROR] Missing Environment Variables: ${missingKeys.join(', ')}. Make sure these are set in your Vercel Project Settings.`);
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Function to seed the default admin user if not exists
export const ensureAdminUser = async () => {
  const adminEmail = 'admin@binaryflow.pro';
  const adminPassword = 'admin123'; // Firebase requires min 6 chars. We map 'admin' input to this.

  try {
    // Try to login to see if exists (this is a client-side hack for the requirement)
    // In a real app, you'd do this via Cloud Functions or manually in console.
    // We won't auto-login here to disturb the user flow, we just check existence via a specific logic or
    // we can just rely on the Admin Login component to create it if it fails to login first time.
    // However, to strictly follow "automatically create... upon execution":
    
    // We cannot easily "check" if a user exists without logging in on client SDK.
    // So we will handle the creation lazily in the Login component or App initialization if we are not logged in.
    // For now, we will export this config for the Login component to use.
  } catch (e) {
    console.error("Admin seed check failed", e);
  }
};

export const ADMIN_CREDENTIALS = {
  email: 'admin@binaryflow.pro',
  password: 'admin123', // Internal password for the 'admin' input
  displayPassword: 'admin' // The password the user types
};
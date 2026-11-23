import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase web config for the Stereo.tip project. These values are public
// identifiers (not secrets); access is controlled by firestore.rules.
// Set VITE_DEMO=1 to run without Firebase (data stays in the browser).
const env = import.meta.env
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAgn8cybC_Lo53m7Baq1pvqH7PxIyTSzEY',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'stereotip-59432.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'stereotip-59432',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'stereotip-59432.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '364798284478',
  appId: env.VITE_FIREBASE_APP_ID || '1:364798284478:web:a29a8f840156e1c4cb44ef',
}

export const isFirebaseConfigured = env.VITE_DEMO !== '1' && Boolean(cfg.apiKey && cfg.projectId)

export const app = isFirebaseConfigured ? initializeApp(cfg) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

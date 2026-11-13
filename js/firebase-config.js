// =============================================================
// firebase-config.js  —  Firebase project keys (project: treasure-hunter-cbd8f).
// Firebase console > Project settings > General > Your apps > Web app > Config
// These keys are meant to be public; security comes from firestore.rules.
// Firebase itself is loaded from the CDN in auth.js (loadFirebase), so no
// "import ... from 'firebase/app'" lines here — those only work with a bundler.
// If apiKey starts with "PASTE" the game falls back to DEMO MODE (this browser only).
// =============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyB6a2Q9v53ppiWFXC3R8qN0KEt9yH9949A",
  authDomain: "treasure-hunter-cbd8f.firebaseapp.com",
  projectId: "treasure-hunter-cbd8f",
  storageBucket: "treasure-hunter-cbd8f.firebasestorage.app",
  messagingSenderId: "554147091056",
  appId: "1:554147091056:web:58184a9059e0ab5de8dab5",
  measurementId: "G-9128QK3MT8"
};

export const FIREBASE_ENABLED = !firebaseConfig.apiKey.startsWith("PASTE");

// Node/Express score server (see server/). Saving runs and the leaderboard go through it.
//   ""                         -> same origin (game opened from the server, e.g. http://localhost:3000)
//   "https://your-server.com"  -> a server deployed somewhere else
//   null                       -> no server: talk to Firestore directly
// Default: use the server when the game is opened from it (port 3000); anywhere else
// (e.g. the web.app link on your phone) the game keeps working straight from Firestore.
export const API_URL = location.port === "3000" ? "" : null;

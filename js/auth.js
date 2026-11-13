// =============================================================
// auth.js  —  VIRTUAL IDENTITY (Week 5)
// One job: who is the player?  Sign up, log in, log out, session.
// Real mode  : Firebase Authentication (email + password or Google, token kept by Firebase).
// Demo mode  : passwords are SHA-256 hashed with a salt and stored in localStorage.
// =============================================================
import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
let fb = null; // filled with Firebase functions when enabled

async function loadFirebase() {
  if (fb || !FIREBASE_ENABLED) return fb;
  const app = await import(SDK + "firebase-app.js");
  const a = await import(SDK + "firebase-auth.js");
  const f = await import(SDK + "firebase-firestore.js");
  const appInst = app.initializeApp(firebaseConfig);
  fb = { ...a, ...f, auth: a.getAuth(appInst), db: f.getFirestore(appInst) };
  return fb;
}
export { loadFirebase };

// ---------- helpers ----------
export function validatePassword(pw) {
  if (pw.length < 6) return "Password must be at least 6 characters.";
  if (!/[0-9]/.test(pw)) return "Password needs at least one number.";
  return "";
}
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const readUsers = () => JSON.parse(localStorage.getItem("th_users") || "{}");
const writeUsers = u => localStorage.setItem("th_users", JSON.stringify(u));
const SESSION_KEY = "th_session";

// ---------- public API ----------
export async function signUp(username, email, password) {
  const err = validatePassword(password);
  if (err) throw new Error(err);
  if (username.trim().length < 3) throw new Error("Username must be at least 3 letters.");
  email = email.trim().toLowerCase();

  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    const cred = await f.createUserWithEmailAndPassword(f.auth, email, password);
    await f.updateProfile(cred.user, { displayName: username });
    await f.setDoc(f.doc(f.db, "users", cred.user.uid), {
      username, email, unlockedLevel: 1, createdAt: f.serverTimestamp()
    });
    return { uid: cred.user.uid, username, email };
  }
  const users = readUsers();
  if (users[email]) throw new Error("That email is already registered.");
  const salt = crypto.getRandomValues(new Uint32Array(2)).join("");
  users[email] = { uid: "local-" + Date.now(), username, salt, hash: await sha256(salt + password), unlockedLevel: 1 };
  writeUsers(users);
  return login(email, password, true);
}

export async function login(email, password, remember) {
  email = email.trim().toLowerCase();
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    // "Remember me" = keep login after the browser closes (local) or only for this tab (session)
    await f.setPersistence(f.auth, remember ? f.browserLocalPersistence : f.browserSessionPersistence);
    const cred = await f.signInWithEmailAndPassword(f.auth, email, password);
    return { uid: cred.user.uid, username: cred.user.displayName, email };
  }
  const u = readUsers()[email];
  if (!u || u.hash !== await sha256(u.salt + password)) throw new Error("Wrong email or password.");
  const session = JSON.stringify({ uid: u.uid, username: u.username, email });
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
  return JSON.parse(session);
}

/** Sign in (or sign up) with a Google account. Firebase only — needs the Google
 *  provider enabled in Firebase console > Authentication > Sign-in method. */
export async function signInWithGoogle(remember) {
  if (!FIREBASE_ENABLED) throw new Error("Google sign-in needs Firebase (not available in demo mode).");
  const f = await loadFirebase();
  await f.setPersistence(f.auth, remember ? f.browserLocalPersistence : f.browserSessionPersistence);
  const provider = new f.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" }); // always show the account chooser
  const cred = await f.signInWithPopup(f.auth, provider);
  const user = cred.user;
  const username = (user.displayName || user.email.split("@")[0]).slice(0, 16);

  // First Google login = new player: create their profile doc.
  // Returning player: leave it alone so unlockedLevel is not reset.
  const ref = f.doc(f.db, "users", user.uid);
  const snap = await f.getDoc(ref);
  if (!snap.exists()) {
    await f.setDoc(ref, { username, email: user.email, unlockedLevel: 1, provider: "google", createdAt: f.serverTimestamp() });
  }
  return { uid: user.uid, username, email: user.email };
}

export async function logout() {
  if (FIREBASE_ENABLED) { const f = await loadFirebase(); await f.signOut(f.auth); }
  localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
}

/** Calls back with the logged-in user, or null. Used to guard game.html. */
export async function getCurrentUser() {
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    return new Promise(res => {
      const stop = f.onAuthStateChanged(f.auth, user => {
        stop();
        res(user ? { uid: user.uid, username: user.displayName || user.email, email: user.email } : null);
      });
    });
  }
  const s = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  return s ? JSON.parse(s) : null;
}

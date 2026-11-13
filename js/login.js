// =============================================================
// login.js  —  Controller for index.html (login / sign up page).
// Reacts to form events and calls auth.js.
// =============================================================
import { login, signUp, signInWithGoogle, getCurrentUser } from "./auth.js";
import { FIREBASE_ENABLED } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const msg = (t, ok) => { $("authMsg").textContent = t; $("authMsg").className = "msg " + (ok ? "ok" : "err"); };

// already logged in? go straight to the game
getCurrentUser().then(u => { if (u) location.href = "game.html"; });

function showTab(signup) {
  $("tabLogin").classList.toggle("active", !signup);
  $("tabSignup").classList.toggle("active", signup);
  $("loginForm").classList.toggle("hidden", signup);
  $("signupForm").classList.toggle("hidden", !signup);
  msg("");
}
$("tabLogin").addEventListener("click", () => showTab(false));
$("tabSignup").addEventListener("click", () => showTab(true));

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    msg("Logging in…", true);
    await login($("loginEmail").value, $("loginPassword").value, $("remember").checked);
    location.href = "game.html";
  } catch (err) { msg(friendly(err)); }
});

$("signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("signupPassword").value !== $("signupConfirm").value) return msg("Passwords do not match.");
  try {
    msg("Creating account…", true);
    await signUp($("signupName").value, $("signupEmail").value, $("signupPassword").value);
    location.href = "game.html";
  } catch (err) { msg(friendly(err)); }
});

// Google sign-in: hidden in demo mode because it needs a real Firebase project
if (!FIREBASE_ENABLED) $("googleBox").classList.add("hidden");
$("googleBtn").addEventListener("click", async () => {
  $("googleBtn").disabled = true;
  try {
    msg("Opening Google…", true);
    await signInWithGoogle($("remember").checked);
    location.href = "game.html";
  } catch (err) { msg(friendly(err)); }
  finally { $("googleBtn").disabled = false; }
});

function friendly(err) {
  const code = err.code || "";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "Google sign-in was cancelled.";
  if (code.includes("popup-blocked")) return "Your browser blocked the Google pop-up. Allow pop-ups and try again.";
  if (code.includes("account-exists-with-different-credential")) return "This email already has an account. Log in with email and password.";
  if (code.includes("unauthorized-domain")) {
    if (location.protocol === "file:") return "Google sign-in can't run from a file. Open the game with Live Server or firebase serve.";
    return `Add "${location.hostname}" in Firebase > Authentication > Settings > Authorized domains.`;
  }
  if (code.includes("operation-not-allowed")) return "Google sign-in is not turned on in the Firebase console yet.";
  if (code.includes("email-already-in-use")) return "That email is already registered.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Wrong email or password.";
  if (code.includes("weak-password")) return "Password is too weak.";
  return err.message;
}

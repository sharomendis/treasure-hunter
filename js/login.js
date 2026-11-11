// =============================================================
// login.js  —  Controller for index.html (login / sign up page).
// Reacts to form events and calls auth.js.
// =============================================================
import { login, signUp, getCurrentUser } from "./auth.js";
import { FIREBASE_ENABLED } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const msg = (t, ok) => { $("authMsg").textContent = t; $("authMsg").className = "msg " + (ok ? "ok" : "err"); };

$("modeNote").textContent = FIREBASE_ENABLED ? "Online accounts (Firebase)" : "Demo mode: accounts are saved in this browser only.";

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

function friendly(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email is already registered.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Wrong email or password.";
  if (code.includes("weak-password")) return "Password is too weak.";
  return err.message;
}

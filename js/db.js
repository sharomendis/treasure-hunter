// =============================================================
// db.js  —  Saving runs, unlocking levels, top-3 leaderboard.
// Firestore collections:  users/{uid}   and   scores/{autoId}
// =============================================================
import { FIREBASE_ENABLED } from "./firebase-config.js";
import { loadFirebase } from "./auth.js";

const localScores = () => JSON.parse(localStorage.getItem("th_scores") || "[]");

/** Ranking rule: treasure finders first (fewest lives lost, then fastest, then most coins);
 *  hunters who didn't make it yet are ranked by score. */
export function rankRuns(a, b) {
  if (a.won !== b.won) return b.won - a.won;
  if (a.won) return (a.deaths - b.deaths) || (a.timeSec - b.timeSec) || (b.coins - a.coins);
  return (b.score - a.score) || (b.coins - a.coins);
}

export async function saveRun(user, run) {
  const row = { uid: user.uid, username: user.username, ...run, playedAt: Date.now() };
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    await f.addDoc(f.collection(f.db, "scores"), row);
  } else {
    const all = localScores(); all.push(row);
    localStorage.setItem("th_scores", JSON.stringify(all));
  }
  if (run.won) await unlockLevel(user, run.level + 1);
}

/** Top 3 hunters for a level — each player's best run only, so one person can't fill the board. */
export async function getTop3(level) {
  let rows;
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    const q = f.query(f.collection(f.db, "scores"), f.where("level", "==", level), f.limit(300));
    rows = (await f.getDocs(q)).docs.map(d => d.data());
  } else {
    rows = localScores().filter(r => r.level === level);
  }
  const best = new Map();
  rows.sort(rankRuns).forEach(r => { if (!best.has(r.uid)) best.set(r.uid, r); });
  return [...best.values()].slice(0, 3);
}

/** Every run this player has saved (used by the Treasure Vault). */
export async function getMyRuns(user) {
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    const q = f.query(f.collection(f.db, "scores"), f.where("uid", "==", user.uid));
    return (await f.getDocs(q)).docs.map(d => d.data());
  }
  return localScores().filter(r => r.uid === user.uid);
}

export async function getUnlockedLevel(user) {
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    const snap = await f.getDoc(f.doc(f.db, "users", user.uid));
    return snap.exists() ? (snap.data().unlockedLevel || 1) : 1;
  }
  return Number(localStorage.getItem("th_unlock_" + user.uid) || 1);
}

async function unlockLevel(user, level) {
  level = Math.min(level, 3);
  if (level <= await getUnlockedLevel(user)) return;
  if (FIREBASE_ENABLED) {
    const f = await loadFirebase();
    await f.setDoc(f.doc(f.db, "users", user.uid), { unlockedLevel: level }, { merge: true });
  } else localStorage.setItem("th_unlock_" + user.uid, level);
}

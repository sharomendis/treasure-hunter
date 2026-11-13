// =============================================================
// app.js  —  Treasure Hunter API (Node.js + Express)
//
//   GET  /api/health               -> { ok: true }
//   GET  /api/leaderboard/:level   -> top 3 hunters for level 1-3 (best run per player)
//   POST /api/scores               -> save a run   (needs  Authorization: Bearer <Firebase ID token>)
//
// The server is the only thing trusted to write scores:
//   * who the player is comes from the verified Firebase token, never from the request body
//   * every number is range-checked and the score is recalculated here
//   * level unlocking happens here too
// Used by index.js (Firebase Cloud Function) and server.js (run on your own PC).
// =============================================================
import express from "express";
import cors from "cors";
import { validateRun, rankRuns, LEVELS } from "./scoring.js";

/** Builds the Express app. `admin` is an already-initialised firebase-admin. */
export function createApp(admin) {
  const db = admin.firestore();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  const allowed = (process.env.CORS_ORIGINS ||
    "http://localhost:3000,http://localhost:5000,http://127.0.0.1:5500,http://localhost:5500,https://treasure-hunter-cbd8f.web.app,https://treasure-hunter-cbd8f.firebaseapp.com")
    .split(",").map(s => s.trim()).filter(Boolean);
  app.use("/api", cors({ origin: allowed }));

  /** Rejects the request unless it carries a valid Firebase ID token; puts the user on req.user. */
  async function requireAuth(req, res, next) {
    const m = /^Bearer (.+)$/.exec(req.get("Authorization") || "");
    if (!m) return res.status(401).json({ error: "Please log in first." });
    try {
      req.user = await admin.auth().verifyIdToken(m[1]);
      next();
    } catch {
      res.status(401).json({ error: "Your login has expired. Please log in again." });
    }
  }

  // Tiny in-memory rate limit for saves: one player can't spam the board.
  const lastSave = new Map();
  function rateLimit(req, res, next) {
    const now = Date.now(), prev = lastSave.get(req.user.uid) || 0;
    if (now - prev < 3000) return res.status(429).json({ error: "Slow down — one run every few seconds." });
    lastSave.set(req.user.uid, now);
    next();
  }

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/leaderboard/:level", async (req, res, next) => {
    try {
      const level = Number(req.params.level);
      if (!LEVELS[level]) return res.status(400).json({ error: "Level must be 1, 2 or 3." });
      const snap = await db.collection("scores").where("level", "==", level).limit(500).get();
      const best = new Map();
      snap.docs.map(d => d.data()).sort(rankRuns)
        .forEach(r => { if (!best.has(r.uid)) best.set(r.uid, r); });
      const top = [...best.values()].slice(0, 3).map(r => ({
        username: r.username, won: r.won, score: r.score, coins: r.coins,
        deaths: r.deaths, timeSec: r.timeSec, playedAt: r.playedAt
      }));
      res.set("Cache-Control", "no-store").json(top);
    } catch (e) { next(e); }
  });

  app.post("/api/scores", requireAuth, rateLimit, async (req, res, next) => {
    try {
      const { run, error } = validateRun(req.body);
      if (error) return res.status(400).json({ error });

      const uid = req.user.uid;
      const userRef = db.collection("users").doc(uid);
      const profile = (await userRef.get()).data() || {};
      if (run.level > (profile.unlockedLevel || 1)) return res.status(403).json({ error: "That level is still locked." });

      const username = String(profile.username || req.user.name || (req.user.email || "Hunter").split("@")[0]).slice(0, 24);
      const row = { uid, username, ...run, playedAt: Date.now() };
      const ref = await db.collection("scores").add(row);

      let unlockedLevel = profile.unlockedLevel || 1;
      if (run.won && run.level + 1 > unlockedLevel && run.level < 3) {
        unlockedLevel = run.level + 1;
        await userRef.set({ unlockedLevel }, { merge: true });
      }
      res.status(201).json({ id: ref.id, score: run.score, unlockedLevel });
    } catch (e) { next(e); }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Unknown API route." }));
  return app;
}

/** Last middleware: log the real error, send a friendly one. */
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ error: "Server error — please try again." });
}

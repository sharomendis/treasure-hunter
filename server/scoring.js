// =============================================================
// scoring.js  —  Server-side copy of the game rules used to check a run.
// Keep in sync with js/levels.js (sunsetSec) and World.result() in js/world.js.
// =============================================================
export const LEVELS = { 1: { sunsetSec: 75 }, 2: { sunsetSec: 85 }, 3: { sunsetSec: 110 } };

/** Same ranking as the client: winners first (fewest deaths, fastest, most coins), then by score. */
export function rankRuns(a, b) {
  if (a.won !== b.won) return b.won - a.won;
  if (a.won) return (a.deaths - b.deaths) || (a.timeSec - b.timeSec) || (b.coins - a.coins);
  return (b.score - a.score) || (b.coins - a.coins);
}

const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

/** Checks a run sent by the browser. Returns { run } with only known fields, or { error }. */
export function validateRun(body) {
  const b = body && typeof body === "object" ? body : {};
  const cfg = LEVELS[b.level];
  if (!cfg) return { error: "Level must be 1, 2 or 3." };
  if (typeof b.won !== "boolean") return { error: "Missing win/lose result." };

  const counts = ["coins", "deaths", "lavaJumped", "zombiesDodged", "zombiesKilled", "fishWins", "fishTries"];
  for (const k of counts) if (!int(b[k], 1000)) return { error: `Invalid value for ${k}.` };
  if (b.fishWins > b.fishTries) return { error: "Invalid fish results." };

  const timeSec = Number(b.timeSec);
  if (!Number.isFinite(timeSec) || timeSec < 0 || timeSec > cfg.sunsetSec + 1) return { error: "Invalid time." };
  if (b.won && timeSec < 5) return { error: "That run was impossibly fast." };

  // Recalculate the score the same way World.result() does — the client's number is ignored.
  const timeLeft = Math.max(0, cfg.sunsetSec - timeSec);
  const score = Math.max(0, b.coins * 10 + b.lavaJumped * 20 + b.zombiesDodged * 15 + b.zombiesKilled * 25
    + (b.won ? Math.round(timeLeft * 5) + 500 : 0) - b.deaths * 50);

  return {
    run: {
      level: b.level, won: b.won, score, coins: b.coins, deaths: b.deaths,
      timeSec: Math.round(timeSec * 10) / 10, fishWins: b.fishWins, fishTries: b.fishTries,
      lavaJumped: b.lavaJumped, zombiesDodged: b.zombiesDodged, zombiesKilled: b.zombiesKilled,
      obstacles: b.lavaJumped + b.zombiesDodged + b.zombiesKilled
    }
  };
}

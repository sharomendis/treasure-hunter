// =============================================================
// fishApi.js  —  INTEROPERABILITY (Week 4)
// Talks to the university Fish API over HTTPS (HTTP GET).
//   Docs     : https://marcconrad.com/uob/fish/doc.php
//   Request  : GET https://marcconrad.com/uob/fish/api.php?out=json&base64=no
//   Response : { "question": "<image url>", "fish": 8, "chest": 4 }
// The picture shows fish AND treasure chests mixed together.
// The answer is "fish" — the player must count ONLY the fish.
// With base64=yes "question" holds the PNG as base64 text instead of a link.
// =============================================================
const API_URL = "https://marcconrad.com/uob/fish/api.php";

/** Returns { imageSrc, solution, chests } — one fish-counting puzzle from the API. */
export async function getFishPuzzle(useBase64 = false) {
  const res = await fetch(`${API_URL}?out=json&base64=${useBase64 ? "yes" : "no"}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Fish API error " + res.status);
  // The server labels its JSON as text/html, so read text and parse it ourselves
  // (same as the reference client: JSON.parse(await response.text())).
  const data = JSON.parse(await res.text());
  const q = String(data.question ?? "");
  const solution = Number(data.fish ?? data.solution);   // "fish" = number of fish in the picture
  if (!q || !Number.isFinite(solution)) throw new Error("unexpected API answer");
  const imageSrc = useBase64 && !q.startsWith("data:") ? "data:image/png;base64," + q : q;
  return { imageSrc, solution, chests: Number(data.chest) || 0 };
}

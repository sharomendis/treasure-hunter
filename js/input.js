// =============================================================
// input.js  —  Turns raw browser events (touch, keys, buttons)
// into simple game events on the bus. The game never reads the
// keyboard itself — it only listens for "input:*" events.
// =============================================================
import { bus } from "./eventBus.js";

const SWIPE_MIN = 30; // pixels — small so swipes feel instant

export function setupInput(target, hitButton) {
  let sx = 0, sy = 0, tracking = false;

  // ---- touch / mouse swipes (fires as soon as the finger moves far enough = no lag)
  const start = (x, y) => { sx = x; sy = y; tracking = true; };
  const move = (x, y) => {
    if (!tracking) return;
    const dx = x - sx, dy = y - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    tracking = false;
    if (Math.abs(dx) > Math.abs(dy)) bus.emit(dx > 0 ? "input:right" : "input:left");
    else if (dy < 0) bus.emit("input:jump");
    else bus.emit("input:hit"); // swipe down = hit (also a button)
  };
  target.addEventListener("touchstart", e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  target.addEventListener("touchmove", e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  target.addEventListener("touchend", () => (tracking = false));
  target.addEventListener("mousedown", e => start(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  window.addEventListener("mouseup", () => (tracking = false));

  // ---- keyboard (desktop)
  window.addEventListener("keydown", e => {
    if (e.target.closest?.("input, textarea, select")) return;   // typing an answer is not a game move
    const map = { ArrowLeft: "input:left", a: "input:left", ArrowRight: "input:right", d: "input:right",
                  ArrowUp: "input:jump", w: "input:jump", " ": "input:hit", ArrowDown: "input:hit", s: "input:hit" };
    if (map[e.key]) { e.preventDefault(); bus.emit(map[e.key]); }
  });

  // ---- on-screen HIT button
  hitButton.addEventListener("pointerdown", e => { e.stopPropagation(); bus.emit("input:hit"); });
}

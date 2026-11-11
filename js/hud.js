// =============================================================
// hud.js  —  The on-screen interface (DOM). Only updates text and
// bars; it listens to bus events and never changes game rules.
// =============================================================
import { bus } from "./eventBus.js";

const $ = id => document.getElementById(id);

export function setupHud() {
  bus.on("coin", () => pop($("coinBox")));
}

export function updateHud(w) {
  const p = Math.min(1, w.dist / w.cfg.length);
  $("progressFill").style.width = (p * 100) + "%";
  $("runnerDot").style.left = (p * 100) + "%";
  $("coinCount").textContent = w.coins;
  const left = Math.max(0, w.cfg.sunsetSec - w.time);
  $("timerText").textContent = Math.ceil(left) + "s";
  const t = Math.min(1, w.time / w.cfg.sunsetSec);
  $("hudSun").style.top = (8 + t * 70) + "%";           // the sun sinks toward the horizon
  $("hudSky").style.filter = `brightness(${1 - t * 0.55}) saturate(${1 + t * 0.4})`;
  $("timerBox").classList.toggle("urgent", left < 10);
  $("hearts").textContent = "❤".repeat(w.hearts) + "♡".repeat(Math.max(0, 3 - w.hearts));
}

function pop(el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

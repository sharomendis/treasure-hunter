// =============================================================
// main.js  —  Controller for game.html. Connects the modules:
//   auth (identity)  world (rules)  renderer (drawing)  hud (UI)
//   audio (sound)    fishApi (external API)  db (scores)
// The modules talk through the event bus, so each stays simple.
// =============================================================
import { bus } from "./eventBus.js";
import { getCurrentUser, logout } from "./auth.js";
import { FIREBASE_ENABLED } from "./firebase-config.js";
import { World } from "./world.js";
import { Renderer, loadImages } from "./renderer.js";
import { setupInput } from "./input.js";
import { setupHud, updateHud } from "./hud.js";
import { play, toggleMute, checkSounds, SOUND_FILES, stopMusic } from "./audio.js";
import { getFishPuzzle } from "./fishApi.js";
import { saveRun, getTop3, getUnlockedLevel, getMyRuns } from "./db.js";
import { LEVELS } from "./levels.js";
import { initVault, openVault, closeVault, countUp } from "./vault.js";

const $ = id => document.getElementById(id);
const show = (id, on = true) => $(id).classList.toggle("hidden", !on);
const IMAGES = ["coin.png", "zombie.png", "treasure-charm.png", "avataboyingameplay.png", "lavapit.png",
  "level01sreenlavapits.png", "level02screenzombies.png", "level03screenimagewithboth.jpg", "map.png", "avatar_boy.png"];

let user, world, renderer, unlocked = 1, awaitingStart = false, fishSolution = null, fishChests = 0;
let pendingSave = Promise.resolve();
let countdownTimer = null;

/** Save a run to Firestore / demo storage; if it fails, say so on the result screen instead of hiding it. */
function save(run, statsId) {
  pendingSave = saveRun(user, run).catch(e => {
    console.warn("save failed", e);
    $(statsId).insertAdjacentHTML("beforeend",
      `<p class="msg err">⚠ Score not saved: ${esc(e.message)}</p>`);
  });
  return pendingSave;
}

// ---------------- start-up ----------------
(async function init() {
  user = await getCurrentUser();
  if (!user) { location.href = "index.html"; return; }          // not logged in -> back to login page
  $("playerName").textContent = user.username;
  $("modeText").textContent = FIREBASE_ENABLED ? "Online (Firebase)" : "Demo mode (this browser)";
  await loadImages(IMAGES);
  renderer = new Renderer($("game"));
  setupInput($("stage"), $("hitBtn"));
  setupHud();
  initVault($("vaultCanvas"));
  world = new World(1);                                         // idle scene behind the menu
  await openMenu();
  requestAnimationFrame(loop);
})();

// ---------------- game loop (timer event every frame) ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  world.update(dt);
  renderer.draw(world, dt);
  if (world.state !== "ready") updateHud(world);
  requestAnimationFrame(loop);
}

// ---------------- menu & leaderboard ----------------
async function openMenu() {
  stopMusic(); closeVault(); cancelCountdown();
  ["hud", "hitBtn", "startScreen", "winScreen", "loseScreen", "fishModal", "vaultScreen"].forEach(id => show(id, false));
  show("menu");
  unlocked = await getUnlockedLevel(user).catch(() => 1);
  document.querySelectorAll(".lvl").forEach(b => b.classList.toggle("locked", +b.dataset.level > unlocked));
  showBoard(1);
}

async function showBoard(level) {
  document.querySelectorAll("#boardTabs .tab").forEach(t => t.classList.toggle("active", +t.dataset.level === level));
  $("boardList").innerHTML = "<li>Loading…</li>";
  try {
    await pendingSave;                                            // make sure the run just played is saved first
    const top = await getTop3(level);
    $("boardList").innerHTML = top.length ? top.map((r, i) =>
      `<li><span class="medal">${["🥇", "🥈", "🥉"][i]}</span> <b>${esc(r.username || "Hunter")}</b>
       ${r.won ? "💎 found the treasure" : "⏳ still hunting"}
       <span>${r.timeSec}s · ${r.deaths} lives lost · ${r.coins} coins · ${r.score} pts</span></li>`).join("")
      : "<li>No hunters yet — be the first!</li>";
  } catch (e) { $("boardList").innerHTML = `<li>Could not load scores (${esc(e.message)})</li>`; }
}

document.querySelectorAll("#boardTabs .tab").forEach(t => t.addEventListener("click", () => showBoard(+t.dataset.level)));
document.querySelectorAll(".lvl").forEach(b => b.addEventListener("click", () => {
  play("click");
  if (+b.dataset.level > unlocked) return alertLocked(b);
  startLevel(+b.dataset.level);
}));
$("logoutBtn").addEventListener("click", async () => { await logout(); location.href = "index.html"; });
$("muteBtn").addEventListener("click", () => { $("muteBtn").textContent = toggleMute() ? "🔇" : "🔊"; });
document.querySelectorAll(".toMenu").forEach(b => b.addEventListener("click", () => { play("click"); openMenu(); }));
$("retryBtn").addEventListener("click", () => { play("click"); startLevel(world.levelNo); });
$("nextBtn").addEventListener("click", () => { play("click"); startLevel(Math.min(3, world.levelNo + 1)); });

function alertLocked(b) { b.classList.add("shake"); setTimeout(() => b.classList.remove("shake"), 500); }

// ---------------- level start: "Swipe to run" ----------------
function startLevel(n) {
  cancelCountdown();
  world.destroy();
  world = new World(n);
  const c = LEVELS[n];
  show("menu", false); show("winScreen", false); show("loseScreen", false);
  show("hud"); show("hitBtn", c.zombies); show("startScreen");
  $("startTitle").textContent = `Level ${n}: ${c.name}`;
  $("startGoal").textContent = `Reach the ${c.treasure} before the sun sets (${c.sunsetSec}s).`;
  $("controlsText").innerHTML = "Swipe ← → to change lane" + (c.lava ? " · ↑ to jump lava" : "") +
    (c.zombies ? " · HIT button / Space to strike zombies" : "") + "<br>Desktop: arrow keys";
  updateHud(world);
  awaitingStart = true;
}
function cancelCountdown() {
  awaitingStart = false;
  clearInterval(countdownTimer); countdownTimer = null; show("countdown", false);
}
function begin() {
  // only the visible "Swipe to run" screen of a fresh level may start the countdown —
  // never a key pressed after death, on the lose/win screen, in the menu or in the fish popup
  if (!awaitingStart || world.state !== "ready" || $("startScreen").classList.contains("hidden")) return;
  awaitingStart = false; show("startScreen", false);
  const w = world;                                              // the run this countdown belongs to
  let n = 3; show("countdown"); $("countdown").textContent = n; play("beep");
  countdownTimer = setInterval(() => {                          // timeout events drive the countdown
    if (world !== w || w.state !== "ready") return cancelCountdown();
    n--;
    if (n > 0) { $("countdown").textContent = n; play("beep"); }
    else { clearInterval(countdownTimer); countdownTimer = null;
           $("countdown").textContent = "GO!"; play("go"); play("music");
           w.state = "run"; setTimeout(() => show("countdown", false), 500); }
  }, 700);
}
["input:left", "input:right", "input:jump", "input:hit"].forEach(e => bus.on(e, begin));
$("startScreen").addEventListener("click", begin);

// ---------------- death -> Fish API revive ----------------
bus.on("died", () => stopMusic());
bus.on("needRevive", () => { show("fishModal"); $("fishMsg").textContent = ""; $("fishMsg").className = "msg"; loadPuzzle(); });

async function loadPuzzle() {
  $("fishHearts").textContent = "❤".repeat(world.hearts);
  $("fishImg").style.visibility = "hidden"; show("fishLoading"); $("fishAnswer").value = "";
  try {
    const { imageSrc, solution, chests } = await getFishPuzzle();
    fishSolution = solution; fishChests = chests;
    $("fishImg").onload = () => { show("fishLoading", false); $("fishImg").style.visibility = "visible"; $("fishAnswer").focus(); };
    $("fishImg").src = imageSrc;
  } catch (e) {
    show("fishLoading", false);
    $("fishMsg").className = "msg err";
    $("fishMsg").innerHTML = `Could not reach the Fish API (${esc(e.message)}).<br>
      <button type="button" class="btn small" id="retryFish">Retry</button>
      <button type="button" class="btn small ghost" id="giveUpFish">Give up</button>
      <button type="button" class="btn small ghost" id="mapFish">Map</button>`;
    $("retryFish").onclick = () => { play("click"); $("fishMsg").textContent = ""; loadPuzzle(); };
    $("giveUpFish").onclick = () => {                              // ends the run normally: lose screen + score saved
      play("click"); fishSolution = null;
      if (world.state === "puzzle") world.lose("You gave up — the Fish API was unreachable.");
    };
    $("mapFish").onclick = () => { play("click"); fishSolution = null; openMenu(); };
  }
}

$("fishForm").addEventListener("submit", e => {
  e.preventDefault();
  if (fishSolution === null) return;
  world.fishTries++;
  if (Number($("fishAnswer").value) === fishSolution) {
    show("fishModal", false); fishSolution = null; world.revive();
  } else {
    world.wrongAnswer();
    if (world.state === "lost") { show("fishModal", false); return; }
    $("fishMsg").textContent = `Not quite — there were ${fishSolution} fish` +
      (fishChests ? ` (and ${fishChests} chests, which don't count)` : "") + `. You lost a heart. Try a new one!`;
    $("fishMsg").className = "msg err"; fishSolution = null; loadPuzzle();
  }
});

// ---------------- win / lose ----------------
bus.on("gameWon", async r => {
  show("hitBtn", false);
  $("winTitle").textContent = r.level === 3 ? "GRAND diamond treasure!" : "Treasure found!";
  $("winTreasure").classList.toggle("grand", r.level === 3);
  $("winStats").innerHTML = statsHtml(r);
  show("nextBtn", r.level < 3);
  setTimeout(() => show("winScreen"), 700);
  await save(r, "winStats");
});
bus.on("gameLost", async r => {
  show("hitBtn", false); show("fishModal", false);
  $("loseTitle").textContent = r.reason;
  $("loseStats").innerHTML = statsHtml(r);
  setTimeout(() => show("loseScreen"), 500);
  const { reason, ...run } = r;                                  // Firestore does not accept undefined fields
  await save(run, "loseStats");
});

function statsHtml(r) {
  const row = (icon, label, v) => `<div><span>${icon} ${label}</span><b>${v}</b></div>`;
  return row("⭐", "Score", r.score) + row("🪙", "Coins", r.coins) + row("⏱", "Time", r.timeSec + "s") +
    row("🚧", "Obstacles passed", r.obstacles) + row("🔥", "Lava pits jumped", r.lavaJumped) +
    row("🧟", "Zombies dodged / hit", `${r.zombiesDodged} / ${r.zombiesKilled}`) +
    row("💀", "Lives lost", r.deaths) + row("🐟", "Fish API wins", `${r.fishWins} of ${r.fishTries}`);
}

// ---------------- treasure vault: everything this player has hoarded ----------------
let vaultCoins = 0;
async function showVault() {
  play("click"); stopMusic();
  ["menu", "winScreen", "loseScreen", "hud", "hitBtn"].forEach(id => show(id, false));
  show("vaultScreen");
  await pendingSave;
  const runs = await getMyRuns(user).catch(() => []);
  const sum = key => runs.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const wins = lvl => runs.filter(r => r.won && r.level === lvl);
  vaultCoins = sum("coins");
  countUp($("vCoins"), vaultCoins);
  $("vRuns").textContent = runs.length;
  $("vChests").textContent = wins(1).length + wins(2).length;   // levels 1 & 2 end in a chest
  $("vGrand").textContent = wins(3).length;                     // level 3 = grand diamond treasure
  $("vFish").textContent = sum("fishWins");
  $("vBest").innerHTML = [1, 2, 3].map(l => {
    const best = Math.max(0, ...wins(l).map(r => r.score || 0));
    return `<div><b>${best || "–"}</b>${esc(LEVELS[l].name)}</div>`;
  }).join("");
  openVault(vaultCoins);
}
$("vaultBtn").addEventListener("click", showVault);
document.querySelectorAll(".toVault").forEach(b => b.addEventListener("click", showVault));
$("vaultAgain").addEventListener("click", () => { play("click"); openVault(vaultCoins); });

// ---------------- asset check (images + sounds really load) ----------------
$("assetBtn").addEventListener("click", async () => {
  show("assetScreen");
  $("imgList").innerHTML = "<li>Checking images…</li>"; $("sndList").innerHTML = "<li>Checking sounds…</li>";
  const imgs = await loadImages([...IMAGES, "wallpaper_tall.jpg", "grasspit.png", "avatar_zombie.png"]);
  $("imgList").innerHTML = imgs.map(i => `<li class="${i.ok ? "ok" : "err"}">${i.ok ? "✔" : "✘"}
     <img src="assets/img/${i.name}" alt=""> ${i.name}</li>`).join("");
  const snds = await checkSounds();
  $("sndList").innerHTML = snds.map(s => `<li class="${s.ok ? "ok" : "err"}">${s.ok ? "✔" : "✘"}
     <button class="btn tiny" data-snd="${s.key}">▶</button> ${s.name}</li>`).join("");
  $("sndList").querySelectorAll("[data-snd]").forEach(b => b.addEventListener("click", () => {
    b.dataset.snd === "music" ? (play("music"), setTimeout(stopMusic, 4000)) : play(b.dataset.snd);
  }));
});
$("closeAssets").addEventListener("click", () => { stopMusic(); show("assetScreen", false); });

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

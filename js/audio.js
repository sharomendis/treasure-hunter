// =============================================================
// audio.js  —  All music & sound effects. Listens to bus events,
// so the game logic never has to "know" about sounds.
// =============================================================
import { bus } from "./eventBus.js";

const PATH = "assets/sounds/";
export const SOUND_FILES = {
  music: "background_music.mp3", step: "footstep.mp3", whoosh: "jump_whoosh.mp3",
  coin: "coin_collect.mp3", land: "landing.mp3", growl: "monster_growl.mp3",
  groan: "player_groan.mp3", revive: "revive.mp3", bell: "victory_bell.mp3",
  over: "game_over.mp3", beep: "countdown_beep.mp3", go: "go_beep.mp3", click: "button_click.mp3"
};
const VOLUME = { music: 0.35, step: 0.25, coin: 0.7, growl: 0.8 };

const sounds = {};
let muted = false;

for (const [k, file] of Object.entries(SOUND_FILES)) {
  const a = new Audio(PATH + file);
  a.preload = "auto";
  a.volume = VOLUME[k] ?? 0.8;
  if (k === "music") a.loop = true;
  sounds[k] = a;
}

export function play(name) {
  if (muted || !sounds[name]) return;
  const a = name === "music" ? sounds[name] : sounds[name].cloneNode(); // clone = overlapping sounds
  a.volume = sounds[name].volume;
  a.play().catch(() => {});
}
export function stopMusic() { sounds.music.pause(); sounds.music.currentTime = 0; }
export function toggleMute() { muted = !muted; muted ? sounds.music.pause() : null; return muted; }

/** "Oh nooo!" voice using the browser's speech engine (plus the groan sound file). */
function sayOhNo() {
  play("groan");
  if (muted || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance("Ohhh nooo!");
  u.rate = 0.8; u.pitch = 1.3;
  speechSynthesis.speak(u);
}

/** Asset check: does every sound file load? (used on the start screen) */
export function checkSounds() {
  return Promise.all(Object.entries(SOUND_FILES).map(([k, file]) => new Promise(res => {
    const a = new Audio();
    a.oncanplaythrough = () => res({ name: file, ok: true, key: k });
    a.onerror = () => res({ name: file, ok: false, key: k });
    a.src = PATH + file; a.load();
    setTimeout(() => res({ name: file, ok: a.readyState >= 2, key: k }), 4000);
  })));
}

// ---- wire sounds to game events (event-driven, low coupling)
let lastStep = 0;
bus.on("input:left", () => play("whoosh"));
bus.on("input:right", () => play("whoosh"));
bus.on("jump", () => play("whoosh"));
bus.on("land", () => play("land"));
bus.on("coin", () => play("coin"));
bus.on("zombieNear", () => play("growl"));
bus.on("zombieKilled", () => play("land"));
bus.on("died", sayOhNo);
bus.on("revived", () => { play("revive"); play("music"); });
bus.on("gameWon", () => { stopMusic(); play("bell"); setTimeout(() => play("bell"), 1200); });
bus.on("gameLost", () => { stopMusic(); play("over"); });
bus.on("tick", s => { // footsteps while running on the ground
  if (s.running && !s.airborne && s.time - lastStep > 0.32 - s.speed * 0.004) { lastStep = s.time; play("step"); }
});

// =============================================================
// world.js  —  GAME LOGIC ONLY (no drawing, no sound, no DOM).
// Builds the track, moves the hunter, runs zombie AI, checks
// collisions and emits events on the bus.
// =============================================================
import { bus } from "./eventBus.js";
import { LEVELS, START_SPEED, MAX_SPEED, SPEED_GAIN, MAX_HEARTS } from "./levels.js";

export const JUMP_TIME = 0.75;   // seconds in the air
const PIT_LEN = 3.2;             // length of a lava pit (world units)
const HIT_RANGE = 7;             // how far ahead the HIT reaches
const HIT_COOLDOWN = 0.5;

export class World {
  constructor(levelNo) {
    this.levelNo = levelNo;
    this.cfg = LEVELS[levelNo];
    this.dist = 0;               // how far the hunter has run
    this.speed = START_SPEED;
    this.time = 0;               // seconds since start (the sun uses this)
    this.lane = 0;               // target lane -1, 0, 1
    this.x = 0;                  // smooth lane position for animation
    this.jumpT = -1;             // -1 = on the ground
    this.hitT = 99;              // seconds since last HIT
    this.safeT = 0;              // invulnerable after a revive
    this.state = "ready";        // ready | run | dying | puzzle | won | lost
    this.deathCause = null;
    this.coins = 0;
    this.deaths = 0;
    this.hearts = MAX_HEARTS;
    this.fishWins = 0; this.fishTries = 0;
    this.stats = { lavaJumped: 0, zombiesDodged: 0, zombiesKilled: 0 };
    this.objects = this.buildTrack();

    // listen for player input (event driven)
    this.handlers = {
      "input:left": () => this.changeLane(-1),
      "input:right": () => this.changeLane(1),
      "input:jump": () => this.jump(),
      "input:hit": () => this.hit()
    };
    for (const [e, fn] of Object.entries(this.handlers)) bus.on(e, fn);
  }

  destroy() { for (const [e, fn] of Object.entries(this.handlers)) bus.off(e, fn); }

  // ---------- track generation ----------
  buildTrack() {
    const objs = [], c = this.cfg;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    for (let z = 35; z < c.length - 25; z += rnd(16, 24) - Math.min(6, z / 250)) {
      const kinds = [];
      if (c.lava) kinds.push("lava");
      if (c.zombies) kinds.push("zombie");
      const kind = pick(kinds);
      let blocked = [];
      if (kind === "lava") {
        const pattern = pick([[-1], [0], [1], [-1, 0], [0, 1], [-1, 0, 1]]); // full-width pits must be jumped
        pattern.forEach(l => objs.push({ type: "lava", lane: l, z, len: PIT_LEN }));
        blocked = pattern;
      } else {
        const pair = Math.random() < (this.levelNo === 3 ? 0.45 : 0.4) && z > 60;
        const lanes = pair ? pick([[-1, 0], [0, 1], [-1, 1]]) : [pick([-1, 0, 1])];
        lanes.forEach(l => objs.push({ type: "zombie", lane: l, x: l, z, alive: true, pair, decided: false, dead: 0 }));
        blocked = lanes;
      }
      // a line of glowing coins in a free lane, just before the obstacle
      const free = [-1, 0, 1].filter(l => !blocked.includes(l));
      const coinLane = free.length ? pick(free) : 0;
      for (let i = 0; i < 5; i++) objs.push({ type: "coin", lane: coinLane, z: z - 12 + i * 2, taken: false, air: free.length ? 0 : 1.2 });
    }
    objs.push({ type: "treasure", lane: 0, z: c.length + 4 });
    return objs;
  }

  // ---------- controls ----------
  changeLane(dir) { if (this.state === "run") this.lane = Math.max(-1, Math.min(1, this.lane + dir)); }
  jump() { if (this.state === "run" && this.jumpT < 0) { this.jumpT = 0; bus.emit("jump"); } }
  hit() {
    if (this.state !== "run" || this.hitT < HIT_COOLDOWN) return;
    this.hitT = 0;
    bus.emit("hitSwing");
    for (const o of this.objects) {
      const rel = o.z - this.dist;
      if (o.type === "zombie" && o.alive && rel > -0.5 && rel < HIT_RANGE && Math.abs(o.x - this.x) < 1.6) {
        o.alive = false; o.dead = 0.001; this.stats.zombiesKilled++;
        bus.emit("zombieKilled", o);
      }
    }
  }
  get height() { // jump arc
    if (this.jumpT < 0) return 0;
    const t = this.jumpT / JUMP_TIME;
    return 4 * t * (1 - t) * 1.7;
  }

  // ---------- main update, called every frame ----------
  update(dt) {
    if (this.state === "run") {
      this.time += dt;
      this.speed = Math.min(MAX_SPEED, this.speed + SPEED_GAIN * dt);
      this.dist += this.speed * dt;
      this.hitT += dt;
      this.safeT = Math.max(0, this.safeT - dt);
      if (this.jumpT >= 0) {
        this.jumpT += dt;
        if (this.jumpT >= JUMP_TIME) { this.jumpT = -1; bus.emit("land"); }
      }
      this.updateZombieAI(dt);
      this.checkCollisions();
      if (this.dist >= this.cfg.length) { this.state = "won"; bus.emit("gameWon", this.result(true)); }
      else if (this.time >= this.cfg.sunsetSec) this.lose("The sun has set!");
    }
    if (this.state === "dying") {
      this.dyingT += dt;
      if (this.dyingT > 1.8) { this.state = "puzzle"; bus.emit("needRevive", this.deathCause); }
    }
    // smooth lane movement (fast = responsive swipes)
    this.x += (this.lane - this.x) * Math.min(1, dt * 14);
    for (const o of this.objects) if (o.dead) o.dead += dt;
    bus.emit("tick", { running: this.state === "run", airborne: this.height > 0.1, time: this.time, speed: this.speed });
  }

  // "Smart" zombies: they look at the hunter and step into his lane.
  updateZombieAI(dt) {
    for (const z of this.objects) {
      if (z.type !== "zombie" || !z.alive) continue;
      const rel = z.z - this.dist;
      if (rel < 40 && rel > 0) z.z -= 2.2 * dt; // shamble toward the hunter
      if (!z.growled && rel < 22 && rel > 0) { z.growled = true; bus.emit("zombieNear", z); }
      // decide ONCE (fair): singles chase your lane, pairs close the gap you are hiding in
      if (!z.decided && rel < 17 && rel > 9) {
        z.decided = true;
        const mates = this.objects.filter(o => o !== z && o.type === "zombie" && o.alive && Math.abs(o.z - z.z) < 1);
        const taken = mates.map(m => m.lane);
        if (!z.pair) z.lane = this.lane;
        else if (!taken.includes(this.lane) && Math.abs(this.lane - z.lane) === 1) z.lane = this.lane;
      }
      z.x += (z.lane - z.x) * Math.min(1, dt * 3);
    }
  }

  checkCollisions() {
    const h = this.height;
    for (const o of this.objects) {
      const rel = o.z - this.dist;
      if (rel > 3 || rel < -4) continue;
      const sameLane = Math.abs((o.x ?? o.lane) - this.x) < 0.55;
      if (o.type === "coin" && !o.taken && sameLane && Math.abs(rel) < 0.8 && Math.abs(h - o.air) < 1.1) {
        o.taken = true; this.coins++; bus.emit("coin", o);
      }
      if (o.type === "lava") {
        const over = rel <= 0 && rel + o.len >= 0;
        if (over && sameLane && h < 0.25 && !this.safeT) return this.die("lava", o);
        if (!o.counted && rel + o.len < -0.3) {
          o.counted = true;
          if (Math.abs(o.lane - this.lane) < 0.5) { this.stats.lavaJumped++; bus.emit("lavaJumped"); }
        }
      }
      if (o.type === "zombie" && o.alive) {
        if (sameLane && rel < 0.9 && rel > -0.6 && h < 1.0 && !this.safeT) return this.die("zombie", o);
        if (!o.passed && rel < -1) { o.passed = true; this.stats.zombiesDodged++; bus.emit("zombieDodged"); }
      }
    }
  }

  die(cause, obj) {
    this.state = "dying"; this.dyingT = 0; this.deathCause = cause; this.deaths++;
    this.jumpT = -1;
    bus.emit("died", { cause, obj });
  }

  /** Called after a correct Fish API answer. */
  revive() {
    // clear the danger right in front so the hunter can get going again
    this.objects = this.objects.filter(o => o.type === "coin" || o.type === "treasure" || o.z - this.dist > 14 || o.z - this.dist < -2);
    this.speed = Math.max(START_SPEED, this.speed * 0.85);
    this.safeT = 1.5; this.state = "run"; this.fishWins++;
    bus.emit("revived");
  }
  wrongAnswer() {
    this.hearts--;
    if (this.hearts <= 0) this.lose("Out of hearts!");
  }
  lose(reason) { this.state = "lost"; bus.emit("gameLost", { reason, ...this.result(false) }); }

  result(won) {
    const timeLeft = Math.max(0, this.cfg.sunsetSec - this.time);
    const s = this.stats;
    const score = Math.max(0, this.coins * 10 + s.lavaJumped * 20 + s.zombiesDodged * 15 + s.zombiesKilled * 25
      + (won ? Math.round(timeLeft * 5) + 500 : 0) - this.deaths * 50);
    return {
      level: this.levelNo, won, score, coins: this.coins, deaths: this.deaths,
      timeSec: Math.round(this.time * 10) / 10, fishWins: this.fishWins, fishTries: this.fishTries,
      obstacles: s.lavaJumped + s.zombiesDodged + s.zombiesKilled, ...s
    };
  }
}

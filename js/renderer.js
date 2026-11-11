// =============================================================
// renderer.js  —  DRAWING ONLY. Reads the World and paints a
// pseudo-3D (perspective) scene on a <canvas>. No game rules here.
// =============================================================
import { bus } from "./eventBus.js";

const LANE = 1.6;      // lane width in world units
const CAM_BACK = 6;    // chase camera: this far behind ...
const CAM_H = 3.6;     // ... and this high above the hunter
const VIEW = 85;       // how far we can see

const IMG = {};
export function loadImages(names) {
  return Promise.all(names.map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; res({ name: n, ok: true }); };
    im.onerror = () => res({ name: n, ok: false });
    im.src = "assets/img/" + n;
  })));
}

export class Renderer {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.particles = []; this.swing = 0; this.flash = 0;
    this.resize(); window.addEventListener("resize", () => this.resize());
    // visual reactions to game events
    bus.on("died", d => this.onDied(d));
    bus.on("coin", o => this.burst(o.lane * LANE, 0.6 + o.air, o.z, "#ffd84a", 10, 3));
    bus.on("zombieKilled", z => this.burst(z.x * LANE, 1, z.z, "#8fd16a", 14, 4));
    bus.on("hitSwing", () => (this.swing = 0.25));
    bus.on("land", () => this.world && this.burst(this.world.x * LANE, 0.05, this.world.dist, "#e8c48a", 8, 2));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.c.clientWidth; this.H = this.c.clientHeight;
    this.c.width = this.W * dpr; this.c.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.horizon = this.H * 0.4;
    this.focal = Math.min(this.H * 0.62, this.W * 1.15);
  }

  // world (x, y, z) -> screen {x, y, s}  (s = pixels per world unit)
  project(x, y, z) {
    const rel = z - (this.world.dist - CAM_BACK);
    if (rel < 0.6) return null;
    const s = this.focal / rel;
    return { x: this.W / 2 - this.world.x * LANE * s * 0.35 + x * s, y: this.horizon + (CAM_H - y) * s, s };
  }

  burst(x, y, z, color, n, power) {
    for (let i = 0; i < n; i++) this.particles.push({
      x, y, z, vx: (Math.random() - 0.5) * power, vy: Math.random() * power * 1.4, vz: (Math.random() - 0.3) * power,
      life: 0.7 + Math.random() * 0.5, color, size: 0.06 + Math.random() * 0.08
    });
  }

  onDied({ cause, obj }) {
    const w = this.world;
    if (cause === "lava") { // lava splashes up like drops all around the pit
      for (let k = 0; k < 3; k++) setTimeout(() => this.burst(w.x * LANE, 0.1, w.dist + 0.3, k % 2 ? "#ffb21a" : "#ff4d00", 26, 5), k * 220);
    } else { this.flash = 0.6; this.burst(w.x * LANE, 1, w.dist, "#b02020", 12, 3); }
  }

  // ---------------------------------------------------------
  draw(world, dt) {
    this.world = world;
    const { ctx, W, H } = this;
    const p = Math.min(1, world.time / world.cfg.sunsetSec); // 0 = afternoon, 1 = sunset over
    ctx.clearRect(0, 0, W, H);
    this.drawSky(p);
    this.drawGround(p);
    this.drawScenery();
    this.drawObjects(world);
    this.drawHunter(world);
    this.drawParticles(dt);
    this.drawEffects(world, p, dt);
  }

  drawSky(p) {
    const { ctx, W, horizon } = this;
    const bg = IMG[this.world.cfg.backdrop];
    // base sky: golden -> deep orange -> dusk purple
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, mix("#f6b24a", "#3b2350", p)); g.addColorStop(1, mix("#ffe6a0", "#d9572b", p));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon + 2);
    if (bg) { // skyline image, bottom-aligned on the horizon, slowly parallax-scrolling
      const sh = bg.height * (this.world.cfg.crop || 1);          // skip the image's own ground strip
      const h = horizon * 1.05, w = Math.max(W, h * bg.width / sh);
      ctx.globalAlpha = 0.85; ctx.drawImage(bg, 0, 0, bg.width, sh, (W - w) / 2, horizon - h, w, h); ctx.globalAlpha = 1;
    }
    // warm golden-hour wash over the image
    ctx.fillStyle = `rgba(255,${150 - p * 70},40,${0.28 + p * 0.1})`; ctx.fillRect(0, 0, W, horizon);
    // the sun sinks toward the horizon, with a soft bloom
    const sx = W * 0.72, sy = horizon * (0.25 + p * 0.85), r = Math.max(18, W * 0.05);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const bloom = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 6);
    bloom.addColorStop(0, `rgba(255,220,120,${0.55 - p * 0.2})`); bloom.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, horizon + r * 2);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
    ctx.fillStyle = mix("#fff3c4", "#ff7a2a", p); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    ctx.restore();
  }

  drawGround(p) {
    const { ctx, W, H, horizon } = this, w = this.world;
    ctx.fillStyle = mix(shade(w.cfg.ground, -25), "#2a1a24", p * 0.6);
    ctx.fillRect(0, horizon, W, H - horizon);
    // road bands (alternate colours scroll past = feeling of speed)
    const step = 4, start = Math.floor((w.dist - CAM_BACK) / step) * step;
    const half = LANE * 1.5 + 0.4;
    for (let z = start + VIEW; z >= start; z -= step) {
      const a = this.project(-half, 0, z + step), b = this.project(-half, 0, Math.max(z, w.dist - CAM_BACK + 0.7));
      if (!a || !b) continue;
      const a2 = this.project(half, 0, z + step), b2 = this.project(half, 0, Math.max(z, w.dist - CAM_BACK + 0.7));
      ctx.fillStyle = mix((Math.floor(z / step) % 2 ? shade(w.cfg.ground, 12) : w.cfg.ground), "#3a2030", p * 0.5);
      quad(ctx, a, a2, b2, b);
    }
    // lane dividers + road edges
    ctx.strokeStyle = "rgba(255,230,180,0.35)"; ctx.lineWidth = 2;
    for (const lx of [-half, -LANE / 2, LANE / 2, half]) {
      const f = this.project(lx, 0, w.dist + VIEW), n = this.project(lx, 0, w.dist - CAM_BACK + 0.7);
      if (f && n) { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(n.x, n.y); ctx.stroke(); }
    }
    // fade the far road into haze
    const haze = ctx.createLinearGradient(0, horizon, 0, horizon + H * 0.12);
    haze.addColorStop(0, `rgba(255,190,110,${0.7 - p * 0.3})`); haze.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, horizon, W, H * 0.12);
  }

  // rocks / dead trees / gravestones along both sides (3D depth cue)
  drawScenery() {
    const w = this.world, ctx = this.ctx, step = 7;
    const first = Math.ceil((w.dist - 2) / step);
    for (let i = first + Math.floor(VIEW / step); i >= first; i--) {
      for (const side of [-1, 1]) {
        const seed = hash(i * 2 + (side > 0 ? 1 : 0));
        const pr = this.project(side * (LANE * 1.5 + 1.2 + seed * 2.5), 0, i * step);
        if (!pr) continue;
        const kind = w.cfg.zombies && (!w.cfg.lava || seed > 0.5) ? (seed > 0.7 ? "grave" : "tree") : "rock";
        drawProp(ctx, kind, pr.x, pr.y, pr.s, seed);
      }
    }
  }

  drawObjects(w) {
    const ctx = this.ctx, t = w.time;
    const list = w.objects.filter(o => o.z - w.dist > (o.type === "lava" ? -CAM_BACK + 1 : -2) && o.z - w.dist < VIEW)
      .sort((a, b) => b.z - a.z);
    for (const o of list) {
      if (o.type === "lava") {
        const l = o.lane * LANE;
        const a = this.project(l - LANE / 2, 0, o.z + o.len), b = this.project(l + LANE / 2, 0, o.z + o.len);
        const c = this.project(l + LANE / 2, 0, Math.max(o.z, w.dist - CAM_BACK + 0.7)), d = this.project(l - LANE / 2, 0, Math.max(o.z, w.dist - CAM_BACK + 0.7));
        if (!a || !c) continue;
        ctx.fillStyle = "#3b1f14"; quad(ctx, a, b, c, d); // rocky rim
        const g = ctx.createLinearGradient(0, a.y, 0, d.y);
        g.addColorStop(0, "#ff9a1f"); g.addColorStop(0.5 + Math.sin(t * 3 + o.z) * 0.1, "#ff5a00"); g.addColorStop(1, "#ffcf3a");
        ctx.fillStyle = g; ctx.save(); ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 25;
        const k = 0.12; quad(ctx, lerpP(a, b, k), lerpP(b, a, k), lerpP(c, d, k), lerpP(d, c, k)); ctx.restore();
        for (let i = 0; i < 3; i++) { // bubbles
          const bp = this.project(l + Math.sin(o.z * 7 + i * 2) * 0.4, 0.02, o.z + 0.6 + i * 0.9);
          if (!bp) continue;
          const r = bp.s * (0.08 + 0.05 * Math.sin(t * 5 + i * 3 + o.z));
          ctx.fillStyle = "rgba(255,240,160,0.85)"; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(1, r), 0, 7); ctx.fill();
        }
      } else if (o.type === "coin" && !o.taken) {
        const pr = this.project(o.lane * LANE, 0.6 + o.air + Math.sin(t * 4 + o.z) * 0.08, o.z);
        if (!pr) continue;
        const size = pr.s * 0.6, spin = Math.abs(Math.cos(t * 4 + o.z));
        const glow = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, size * 1.3);
        glow.addColorStop(0, "rgba(255,220,80,0.6)"); glow.addColorStop(1, "rgba(255,220,80,0)");
        ctx.fillStyle = glow; ctx.fillRect(pr.x - size * 1.3, pr.y - size * 1.3, size * 2.6, size * 2.6);
        if (IMG["coin.png"]) ctx.drawImage(IMG["coin.png"], pr.x - size * spin / 2, pr.y - size / 2, size * Math.max(0.15, spin), size);
      } else if (o.type === "zombie") {
        if (o.dead > 1.2) continue;
        const pr = this.project(o.x * LANE, 0, o.z);
        if (!pr || !IMG["zombie.png"]) continue;
        const h = pr.s * 1.75, wd = h * 217 / 382, bob = Math.sin(t * 6 + o.z) * h * 0.02;
        shadow(ctx, pr.x, pr.y, wd * 0.5);
        ctx.save(); ctx.translate(pr.x, pr.y);
        if (o.dead) { ctx.rotate(Math.min(1.4, o.dead * 4) * (o.lane >= 0 ? 1 : -1)); ctx.globalAlpha = Math.max(0, 1 - o.dead); }
        else ctx.rotate(Math.sin(t * 3 + o.z) * 0.06);
        ctx.drawImage(IMG["zombie.png"], -wd / 2, -h + bob, wd, h);
        ctx.restore();
      } else if (o.type === "treasure") {
        const pr = this.project(0, 0, o.z);
        if (!pr) continue;
        const big = w.cfg.treasureScale, h = pr.s * 1.6 * big, wd = h * 278 / 237;
        const glow = ctx.createRadialGradient(pr.x, pr.y - h / 2, 0, pr.x, pr.y - h / 2, h * 1.4);
        glow.addColorStop(0, "rgba(255,230,120,0.75)"); glow.addColorStop(1, "rgba(255,230,120,0)");
        ctx.fillStyle = glow; ctx.fillRect(pr.x - h * 1.5, pr.y - h * 2, h * 3, h * 2.5);
        if (IMG["treasure-charm.png"]) ctx.drawImage(IMG["treasure-charm.png"], pr.x - wd / 2, pr.y - h, wd, h);
        if (big > 1) for (let i = 0; i < 6; i++) { // diamonds sparkle on the grand treasure
          const a = t * 2 + i; diamond(ctx, pr.x + Math.cos(a) * wd * 0.6, pr.y - h * 0.6 + Math.sin(a * 1.3) * h * 0.4, pr.s * 0.18);
        }
        const tw = this.project(LANE * 2.6, 0, o.z + 4); // the clock tower beside the treasure
        if (tw) drawTower(ctx, tw.x, tw.y, tw.s);
      }
    }
  }

  drawHunter(w) {
    const ctx = this.ctx;
    let y = w.height, sink = 0, tilt = 0;
    if (w.state === "dying" || w.state === "puzzle") {
      const k = Math.min(1, (w.dyingT || 2) / 1.2);
      if (w.deathCause === "lava") sink = k * 1.1; else tilt = k * 1.4;
    }
    const pr = this.project(w.x * LANE, y - sink, w.dist);
    const ground = this.project(w.x * LANE, 0, w.dist);
    if (!pr) return;
    if (!sink) shadow(ctx, ground.x, ground.y, pr.s * 0.45 * (1 - Math.min(0.5, y / 3)));
    const blink = w.safeT > 0 && Math.floor(w.safeT * 10) % 2;
    if (blink) ctx.globalAlpha = 0.4;
    ctx.save();
    if (sink) { ctx.beginPath(); ctx.rect(0, 0, this.W, ground.y + 2); ctx.clip(); } // hide the part under the lava
    ctx.translate(pr.x, pr.y); ctx.rotate(tilt);
    drawBoy(ctx, pr.s / 100, w.state === "run" ? w.dist * 1.25 : 0, w.height > 0.1);
    ctx.restore(); ctx.globalAlpha = 1;
    if (sink) { // lava surface glow over the sinking hunter
      const g = ctx.createRadialGradient(ground.x, ground.y, 0, ground.x, ground.y, pr.s * 1.2);
      g.addColorStop(0, "rgba(255,140,0,0.8)"); g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g; ctx.fillRect(ground.x - pr.s * 1.2, ground.y - pr.s * 1.2, pr.s * 2.4, pr.s * 2.4);
    }
    if (this.swing > 0) { // HIT swing arc
      ctx.strokeStyle = `rgba(255,255,255,${this.swing * 4})`; ctx.lineWidth = pr.s * 0.12;
      ctx.beginPath(); ctx.arc(pr.x, pr.y - pr.s * 1.0, pr.s * 1.1, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    if ((w.state === "dying" || w.state === "puzzle") && w.deathCause) speech(ctx, pr.x, pr.y - pr.s * 2.1, "Ohhh nooo!", pr.s);
  }

  drawParticles(dt) {
    const ctx = this.ctx;
    this.particles = this.particles.filter(q => (q.life -= dt) > 0);
    for (const q of this.particles) {
      q.vy -= 9 * dt; q.x += q.vx * dt; q.y = Math.max(0, q.y + q.vy * dt); q.z += q.vz * dt;
      const pr = this.project(q.x, q.y, q.z);
      if (!pr) continue;
      ctx.fillStyle = q.color; ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.beginPath(); ctx.arc(pr.x, pr.y, Math.min(9, Math.max(1.5, pr.s * q.size)), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawEffects(w, p, dt) {
    const { ctx, W, H, horizon } = this;
    this.swing = Math.max(0, this.swing - dt);
    // speed lines at high speed (thin streaks at the screen edges)
    const fast = (w.speed - 16) / 8;
    if (fast > 0 && w.state === "run") {
      ctx.strokeStyle = `rgba(255,245,220,${Math.min(0.45, fast * 0.45)})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const a = hash(i + Math.floor(w.time * 12)) * Math.PI * 2;
        const r1 = Math.max(W, H) * (0.45 + hash(i * 7) * 0.2), r2 = r1 + 60 + fast * 80;
        const cx = W / 2, cy = horizon;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.8); ctx.stroke();
      }
    }
    // dusk darkening + warm vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(40,10,30,${0.25 + p * 0.35})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (this.flash > 0) { ctx.fillStyle = `rgba(180,0,0,${this.flash * 0.5})`; ctx.fillRect(0, 0, W, H); this.flash -= dt; }
  }
}

// ================= drawing helpers =================
/** The hunter seen from behind. Same outfit in every frame:
    tan hat, orange windbreaker, khaki cargo shorts, white sneakers, brown parcel on his back. */
function drawBoy(ctx, k, phase, air) {
  ctx.save(); ctx.scale(k, k); // 100 units = 1 world unit; feet at (0,0)
  const sw = air ? 0.6 : Math.sin(phase), lw = 13;
  const leg = (x, s) => {
    const lift = Math.max(0, s) * 22;
    ctx.fillStyle = "#e0a27a"; ctx.fillRect(x - lw / 2, -72 + 0, lw, 52 - lift); // skin
    ctx.fillStyle = "#ffffff"; roundRect(ctx, x - 11, -24 - lift, 22, 18, 6); // sneaker
    ctx.fillStyle = "#e23c2c"; ctx.fillRect(x - 11, -10 - lift, 22, 4);       // sneaker sole stripe
  };
  leg(-14, sw); leg(14, -sw);
  ctx.fillStyle = "#b9a46a"; roundRect(ctx, -30, -98, 60, 34, 8);            // cargo shorts
  ctx.fillStyle = "#9c8852"; ctx.fillRect(-28, -84, 12, 12); ctx.fillRect(16, -84, 12, 12); // pockets
  const arm = (x, s) => { ctx.save(); ctx.translate(x, -140); ctx.rotate(s * 0.6);
    ctx.fillStyle = "#f07a1a"; roundRect(ctx, -8, 0, 16, 40, 7); ctx.fillStyle = "#e0a27a"; roundRect(ctx, -6, 38, 12, 12, 6); ctx.restore(); };
  arm(-34, -sw); arm(34, sw);
  ctx.fillStyle = "#f58220"; roundRect(ctx, -32, -150, 64, 60, 14);          // orange windbreaker
  ctx.fillStyle = "#d9661a"; ctx.fillRect(-32, -100, 64, 6);                 // jacket hem
  ctx.fillStyle = "#8a5a2b"; roundRect(ctx, -22, -146, 44, 42, 5);           // parcel
  ctx.fillStyle = "#d8b37a"; ctx.fillRect(-2, -146, 4, 42); ctx.fillRect(-22, -127, 44, 4); // tape
  ctx.fillStyle = "#4a2e17"; ctx.fillRect(-30, -150, 6, 50); ctx.fillRect(24, -150, 6, 50); // straps
  ctx.fillStyle = "#e0a27a"; ctx.fillRect(-7, -160, 14, 12);                 // neck
  ctx.fillStyle = "#5a3418"; ctx.beginPath(); ctx.arc(0, -176, 20, 0, 7); ctx.fill(); // hair (back of head)
  ctx.fillStyle = "#c9a36a"; ctx.beginPath(); ctx.ellipse(0, -186, 34, 9, 0, 0, 7); ctx.fill(); // hat brim
  ctx.fillStyle = "#b48d52"; roundRect(ctx, -18, -210, 36, 26, 8);          // hat crown
  ctx.fillStyle = "#6b4a24"; ctx.fillRect(-18, -192, 36, 5);                 // hat band
  ctx.restore();
}

function drawProp(ctx, kind, x, y, s, seed) {
  ctx.save(); ctx.translate(x, y);
  if (kind === "rock") {
    ctx.fillStyle = "#3a2420"; ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0); ctx.lineTo(-s * 0.4, -s * (0.5 + seed * 0.5)); ctx.lineTo(s * 0.2, -s * (0.7 + seed * 0.4)); ctx.lineTo(s * 0.6, 0); ctx.fill();
    ctx.strokeStyle = "rgba(255,110,20,0.8)"; ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.1); ctx.lineTo(0, -s * 0.4); ctx.lineTo(s * 0.15, -s * 0.2); ctx.stroke();
  } else if (kind === "tree") { // bare dead tree — abandoned place
    ctx.strokeStyle = "#2b1e1a"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, s * 0.12);
    const h = s * (1.8 + seed);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h);
    ctx.moveTo(0, -h * 0.6); ctx.lineTo(-s * 0.5, -h * 0.9); ctx.moveTo(0, -h * 0.75); ctx.lineTo(s * 0.45, -h * 1.05); ctx.stroke();
  } else { // gravestone
    ctx.fillStyle = "#6d6a72"; roundRect(ctx, -s * 0.3, -s * 0.8, s * 0.6, s * 0.8, s * 0.25);
    ctx.fillStyle = "#4b4850"; ctx.fillRect(-s * 0.15, -s * 0.55, s * 0.3, s * 0.06);
  }
  ctx.restore();
}

function drawTower(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#7b5a43"; ctx.fillRect(-s * 0.7, -s * 6, s * 1.4, s * 6);
  ctx.fillStyle = "#4e3426"; ctx.beginPath(); ctx.moveTo(-s, -s * 6); ctx.lineTo(0, -s * 7.6); ctx.lineTo(s, -s * 6); ctx.fill();
  ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(0, -s * 4.8, s * 0.5, 0, 7); ctx.fill();
  ctx.strokeStyle = "#333"; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath(); ctx.moveTo(0, -s * 4.8); ctx.lineTo(0, -s * 5.15); ctx.moveTo(0, -s * 4.8); ctx.lineTo(s * 0.25, -s * 4.8); ctx.stroke();
  ctx.fillStyle = "#e3b23c"; ctx.beginPath(); ctx.arc(0, -s * 5.7, s * 0.25, Math.PI, 0); ctx.fill(); // bell
  ctx.restore();
}

function diamond(ctx, x, y, r) {
  ctx.fillStyle = "#9ff3ff"; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y); ctx.fill();
}
function speech(ctx, x, y, text, s) {
  const fs = Math.max(14, Math.min(28, s * 0.4));
  ctx.font = `800 ${fs}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + fs;
  ctx.fillStyle = "#fff"; roundRect(ctx, x - w / 2, y - fs * 1.6, w, fs * 1.6, fs * 0.5);
  ctx.fillStyle = "#c62828"; ctx.textAlign = "center"; ctx.fillText(text, x, y - fs * 0.5);
}
function shadow(ctx, x, y, r) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, 7); ctx.fill(); }
function quad(ctx, a, b, c, d) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); }
function lerpP(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; }
function shade(c, amt) { const A = hex(c).map(v => Math.max(0, Math.min(255, v + amt))); return "#" + A.map(v => v.toString(16).padStart(2, "0")).join(""); }

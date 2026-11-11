// =============================================================
// vault.js  —  TREASURE VAULT scene (drawing only).
// A chest on a stone pedestal bursts open and gold coins rain out.
// Pseudo-3D: every object has world coords (x, y, z) and project()
// turns them into screen pixels, like renderer.js does for the road.
//   x = left/right   y = up   z = depth (positive = further away)
// =============================================================
import { play } from "./audio.js";

const K = 0.42, SKEW = 0.2;               // how far depth moves things up / left on screen
const R = 170, PH = 55;                   // pedestal radius and height
const CW = 130, CH = 72, CD = 86;         // chest width, height, depth
const GRAV = 950, LID_OPEN = 1.95;        // gravity (units/s²), lid open angle (rad)

let cv, ctx, raf = 0, last = 0, t = 0;
let W = 0, H = 0, S = 1, cx = 0, gy = 0;
let coins = [], sparks = [], stars = [], lid = 0, toSpawn = 0, spawnRate = 0, nextChime = 0;

export function initVault(canvas) {
  cv = canvas; ctx = canvas.getContext("2d");
  addEventListener("resize", () => { if (raf) resize(); });
}

/** Show the burst. coinTotal decides how many coins fly out (more riches = bigger pile). */
export function openVault(coinTotal = 0) {
  resize();
  stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.8 + .6,
    p: Math.random() * 6, v: Math.random() * 6 + 3 }));
  coins = []; sparks = []; lid = 0; t = 0; nextChime = 0;
  toSpawn = Math.max(70, Math.min(240, 70 + Math.round(coinTotal / 3)));
  spawnRate = toSpawn / 2.4;
  cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame);
}

export function closeVault() { cancelAnimationFrame(raf); raf = 0; }

/** Animated count-up for the stat numbers. */
export function countUp(el, value, ms = 1400) {
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(value * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------- layout ----------------
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (W > 780) {                           // desktop: panel on the right, scene on the left
    cx = (W - 420) / 2 + 10; gy = H * 0.6; S = Math.min((W - 420) / 620, H / 520);
  } else {                                 // phone: panel at the bottom, scene on top
    cx = W / 2; gy = H * 0.3; S = Math.min(W / 560, H * 0.42 / 330);
  }
}
const P = (x, y, z) => [cx + (x - z * SKEW) * S, gy - (y + z * K) * S];

// ---------------- update ----------------
function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000); last = now; t += dt;
  // chest wobbles, then the lid swings open (ease-out with a little bounce)
  if (t > 0.7) { const k = Math.min(1, (t - 0.7) / 0.5); lid = LID_OPEN * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)); }
  if (t > 0.7 && t - dt <= 0.7) play("bell");
  if (t > 0.85 && toSpawn > 0) {
    let n = spawnRate * dt + Math.random();
    while (n-- >= 1 && toSpawn > 0) { coins.push(newCoin()); toSpawn--; }
    if (t > nextChime) { play("coin"); nextChime = t + 0.35; }
  }
  if (lid > 0.5 && Math.random() < 0.6) sparks.push({ x: (Math.random() - .5) * CW * .8, y: CH, z: (Math.random() - .5) * CD * .6,
    vy: 40 + Math.random() * 60, life: 1 + Math.random() });
  coins.forEach(c => moveCoin(c, dt));
  sparks.forEach(s => { s.y += s.vy * dt; s.life -= dt * .7; });
  sparks = sparks.filter(s => s.life > 0);
  draw();
  raf = requestAnimationFrame(frame);
}

function newCoin() {
  const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 250;
  return { x: (Math.random() - .5) * 60, y: CH + 4, z: (Math.random() - .5) * 30,
    vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * .8, vy: 380 + Math.random() * 300,
    spin: Math.random() * 6, vs: 6 + Math.random() * 10, r: 13 + Math.random() * 4,
    rest: false, tilt: Math.random() * .55, floor: false };
}

function moveCoin(c, dt) {
  if (c.rest) return;
  c.vy -= GRAV * dt;
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.spin += c.vs * dt;
  const onTop = Math.hypot(c.x, c.z) < R - 8;
  const surf = onTop ? 0 : -PH;
  if (c.vy < 0 && c.y <= surf) {
    c.y = surf;
    if (c.vy < -170) { c.vy *= -0.32; c.vx *= .55; c.vz *= .55; c.vs *= .6; }
    else { c.rest = true; c.floor = !onTop; }
  }
}

// ---------------- draw ----------------
function draw() {
  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2b1736"); sky.addColorStop(1, "#1a0d22");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // floor: a huge soft-lit disc around the pedestal
  const [fx, fy] = P(0, -PH, 0);
  const floor = ctx.createRadialGradient(fx, fy, 10, fx, fy, 900 * S);
  floor.addColorStop(0, "#9a6380"); floor.addColorStop(.45, "#6b3c5c"); floor.addColorStop(1, "rgba(40,20,48,0)");
  ctx.fillStyle = floor;
  ctx.beginPath(); ctx.ellipse(fx, fy, 1300 * S, 1300 * K * S, 0, 0, Math.PI * 2); ctx.fill();

  // stars / dust drifting upward
  stars.forEach(s => {
    const y = ((s.y * H - t * s.v) % H + H) % H;
    ctx.globalAlpha = .35 + .45 * Math.abs(Math.sin(t * 1.5 + s.p));
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x * W, y, s.s, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  coins.filter(c => c.floor && c.z > 0).forEach(drawCoin);   // floor coins behind the pedestal
  drawPedestal();
  drawBeam();
  const air = coins.filter(c => !(c.floor && c.z > 0)).sort((a, b) => b.z - a.z);
  const behind = air.filter(c => c.z > 0 && c.y < CH + 10), front = air.filter(c => !behind.includes(c));
  air.filter(c => !c.rest).forEach(drawShadow);
  behind.forEach(drawCoin);
  drawChest();
  front.forEach(drawCoin);
  drawSparks();
}

function poly(pts, fill) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

function drawPedestal() {
  const v = Array.from({ length: 8 }, (_, i) => { const a = (i + .5) * Math.PI / 4; return [R * Math.cos(a), R * Math.sin(a)]; });
  // side faces facing the viewer (front half), lit from the upper left
  for (let i = 0; i < 8; i++) {
    const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % 8], m = Math.atan2(z1 + z2, x1 + x2);
    if (Math.sin(m) > 0.15) continue;                                // back faces are hidden
    const light = 34 + 14 * Math.max(-.6, -Math.cos(m) * .8 - Math.sin(m) * .3);
    poly([P(x1, 0, z1), P(x2, 0, z2), P(x2, -PH, z2), P(x1, -PH, z1)], `hsl(330 10% ${light}%)`);
  }
  // top face with a warm glow under the beam
  const [tx, ty] = P(0, 0, 0);
  const top = ctx.createRadialGradient(tx, ty, 5, tx, ty, R * S * 1.1);
  top.addColorStop(0, "#f4dcd6"); top.addColorStop(1, "#bfa3b2");
  poly(v.map(([x, z]) => P(x, 0, z)), top);
}

function drawBeam() {
  const [bx, by] = P(0, CH + 120, 0);
  const g = ctx.createLinearGradient(0, 0, 0, by);
  g.addColorStop(0, "rgba(255,225,240,.55)"); g.addColorStop(1, "rgba(255,225,240,.25)");
  poly([[bx - 50 * S, 0], [bx + 50 * S, 0], [bx + 58 * S, by], [bx - 58 * S, by]], g);
  ctx.fillStyle = "rgba(255,230,245,.35)";
  ctx.beginPath(); ctx.ellipse(bx, by, 58 * S, 14 * S, 0, 0, Math.PI * 2); ctx.fill();
}

function drawChest() {
  const shake = t < 0.7 ? Math.sin(t * 55) * 3 * Math.min(1, t * 2) : 0;
  const Q = (x, y, z) => { const p = P(x, y, z); p[0] += shake * S; return p; };
  const x0 = -CW / 2, x1 = CW / 2, z0 = -CD / 2, z1 = CD / 2;
  // soft shadow on the pedestal
  const [sx, sy] = P(0, 0, 0);
  ctx.fillStyle = "rgba(60,20,40,.18)"; ctx.beginPath(); ctx.ellipse(sx - 6 * S, sy, CW * .62 * S, CD * .32 * S, 0, 0, Math.PI * 2); ctx.fill();

  poly([Q(x0, 0, z0), Q(x0, 0, z1), Q(x0, CH, z1), Q(x0, CH, z0)], "#b8740f");      // left side
  const fg = ctx.createLinearGradient(0, Q(0, CH, z0)[1], 0, Q(0, 0, z0)[1]);
  fg.addColorStop(0, "#f2b32c"); fg.addColorStop(1, "#d98a12");
  poly([Q(x0, 0, z0), Q(x1, 0, z0), Q(x1, CH, z0), Q(x0, CH, z0)], fg);            // front
  [[x0 + 14, x0 + 22], [x1 - 22, x1 - 14]].forEach(([a, b]) =>                      // metal straps
    poly([Q(a, 0, z0), Q(b, 0, z0), Q(b, CH, z0), Q(a, CH, z0)], "#c47a10"));
  poly([Q(-9, CH - 30, z0), Q(9, CH - 30, z0), Q(9, CH - 8, z0), Q(-9, CH - 8, z0)], "#8a520c"); // lock

  // open top: dark inside, glowing heap of gold
  poly([Q(x0, CH, z0), Q(x1, CH, z0), Q(x1, CH, z1), Q(x0, CH, z1)], lid > .2 ? "#6a3a0c" : "#f0b030");
  if (lid > .2) {
    const [hx, hy] = Q(0, CH + 4, 0);
    const heap = ctx.createRadialGradient(hx, hy, 2, hx, hy, CW * .5 * S);
    heap.addColorStop(0, "#fff4b0"); heap.addColorStop(.5, "#f6c93c"); heap.addColorStop(1, "rgba(246,180,40,0)");
    ctx.fillStyle = heap; ctx.beginPath(); ctx.ellipse(hx, hy, CW * .46 * S, CD * K * .5 * S, 0, 0, Math.PI * 2); ctx.fill();
  }

  // lid: a slab hinged at the back edge
  const T = 16, c = Math.cos(lid), s = Math.sin(lid);
  const edge = x => [x, CH + CD * s, z1 - CD * c], hinge = x => [x, CH, z1];
  const off = ([x, y, z]) => [x, y + T * c, z + T * s];                             // push along the lid's normal
  const L = (...pts) => pts.map(p => Q(...p));
  poly(L(hinge(x0), edge(x0), off(edge(x0)), off(hinge(x0))), "#b8740f");          // lid left side
  if (lid > 0.38) {
    const g = ctx.createLinearGradient(...Q(...hinge(0)), ...Q(...edge(0)));
    g.addColorStop(0, "#d98a12"); g.addColorStop(1, "#f6b84a");
    poly(L(hinge(x0), hinge(x1), edge(x1), edge(x0)), g);                           // inner face
  } else poly(L(off(hinge(x0)), off(hinge(x1)), off(edge(x1)), off(edge(x0))), "#f4bd3a"); // outer face
  if (lid < 1.95) poly(L(edge(x0), edge(x1), off(edge(x1)), off(edge(x0))), "#e09a1c");    // lid front strip
}

function drawCoin(c) {
  const [x, y] = P(c.x, c.y, c.z), r = c.r * S;
  let rx, ry;
  if (c.rest) { rx = r; ry = r * (K + c.tilt); }
  else { rx = r * Math.max(.12, Math.abs(Math.cos(c.spin))); ry = r; }
  ctx.fillStyle = "#b0850f";
  ctx.beginPath(); ctx.ellipse(x + (c.rest ? 0 : 2.5 * S), y + (c.rest ? 3 * S : 0), rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - rx * .3, y - ry * .35, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, "#fff1a0"); g.addColorStop(.55, "#f2cf3c"); g.addColorStop(1, "#d6a91c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawShadow(c) {
  const surf = Math.hypot(c.x, c.z) < R - 8 ? 0 : -PH;
  const [x, y] = P(c.x, surf, c.z), k = Math.max(.15, 1 - (c.y - surf) / 500);
  ctx.fillStyle = `rgba(40,10,30,${.25 * k})`;
  ctx.beginPath(); ctx.ellipse(x, y, c.r * S * k, c.r * K * S * k, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSparks() {
  ctx.globalCompositeOperation = "lighter";
  sparks.forEach(s => {
    const [x, y] = P(s.x, s.y, s.z);
    ctx.fillStyle = `rgba(255,230,150,${Math.min(1, s.life) * .8})`;
    ctx.beginPath(); ctx.arc(x, y, 2.2 * S, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalCompositeOperation = "source-over";
}

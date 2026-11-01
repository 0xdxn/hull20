// ============================================================================================================
// UFO-25 SHOW (v2). Pure functions: this file is the part that ports to the firmware ShowEngine.
//
//   makeState(seed)            -> st      the whole show state (plain numbers, no objects that need a heap)
//   stepState(st, dt, inp)                advance the clock, state machine, turbine physics, eye/look, events
//   px(seg, i, st, out)                   pixel colour, 0..255 per channel, before the brightness cap
//   beamLevel(st), fogRelay(st)           white spot (MOSFET PWM 0..1) and fog-machine relay (0|1)
//   limitFrame(...)                       brightness cap + supply limiter, as the firmware applies it
//
// Segments (index conventions):
//   rim     500  around the 8 rim faces; i/500 = perimeter fraction from the AFT flat, running
//                clockwise seen from above: 0.25 port (+x), 0.5 fore (street), 0.75 starboard (-x)
//   cockpit 100  ring at the dome base, lights the alien         eyes 2   pixels in the alien's eyes
//   spokes  448  8 x 56 along the belly battens; j = i % 56, j 0 at the rim, 55 at the iris (wired serpentine,
//                the firmware maps physical order to (spoke, j))
//   iris    241  9 rings 1+8+12+16+24+32+40+48+60, centre first (the disc itself is wired outer-first,
//                bench 2026-10-10: the firmware reverses ring order, see iris-test phys()); ring pixel k sits at angle 2*pi*k/n in the
//                saucer's x/z plane (x = cos, z = sin)
//   lineA   440  2026 rim: diffused line on the 1.5" rim edge (the outer 2x4 laid flat), WS2812B 60/m in a slim
//                opal-covered aluminium channel, 8 straight 36" runs; i/440 = perimeter fraction (same convention
//                as rim). Carries the turbine, the nav-light sections and the anti-collision strobes.
//   lineB   428  2026 rim: second diffused line under the rim, just inside the outer edge, facing down/out (a halo
//                under the saucer that edges the belly); 8 runs of ~35"; counter-rotates with lineA
//   ports   256  2026 rim: 16 portholes on the top facets x 16-LED rings; w = i>>4 (window 0..15, 2 per facet,
//                WIN_A[w] = the perimeter fraction it faces), k = i & 15 (ring pixel, angle 2*pi*k/16 in the
//                window plane, k 0 along +perimeter, 4 pointing up-slope toward the hub)
// Inputs (inp): look [x, z] person direction in the saucer frame, -1..1 (hardware: coarse left/centre/right
//   from the camera), personA 0..1 the same bearing as a rim perimeter fraction, plus UI commands (mode,
//   event).
// Rim variants: 2025 = the single 500-px strip ("rim"); 2026 = lineA + lineB + ports. SEGS[v]
// lists what each variant drives on the 5 V saucer supply.
// Same state + same inputs = same pixels. Randomness comes from st.rng (xorshift32), never Math.random.
// ============================================================================================================

export const SPOKE_N = 60;   // per belly spoke: a full metre of 60/m strip, as built (was 56 for a 935 mm channel)
export const COUNTS = { rim: 500, lineA: 440, lineB: 428, ports: 256, cockpit: 100, eyes: 2, spokes: 8 * SPOKE_N, iris: 241 };
export const SEGS = { 2025: ["rim", "cockpit", "eyes", "spokes", "iris"], 2026: ["lineA", "lineB", "ports", "cockpit", "eyes", "spokes", "iris"] };
export const SAUCER_SEGS = SEGS[2025];
export const WIN_A = Array.from({ length: 16 }, (_, w) => (((w >> 1) + (w & 1 ? 0.25 : -0.25)) / 8 + 1) % 1);
export const CREW = [2, 7, 9, 14];                 // windows with a crew silhouette cut-out behind the frosted glass
export const IRIS_RINGS = [1, 8, 12, 16, 24, 32, 40, 48, 60];
export const IRIS_POS = (() => { const o = []; IRIS_RINGS.forEach((n, r) => { for (let k = 0; k < n; k++) o.push([r, k / n]); }); return o; })();

// abduction phase boundaries, seconds into the abduction
export const PH = { charge: 2.0, beam: 4.5, lift: 8.0, flash: 9.6, black: 9.75, release: 10.05, end: 11.2 };
export const DUR = { approach: 3.5, cooldown: 3.0 };
export const EV_DUR = { sputter: 6.6, comms: 4.6, search: 6.0 };

const C = {
  tealDeep: [0, 34, 44], teal: [0, 165, 160], cyan: [40, 225, 255], hot: [215, 250, 255], violet: [100, 36, 255],
  pink: [255, 62, 181], yel: [255, 233, 0], red: [255, 0, 0], green: [0, 255, 40], white: [255, 255, 255],
  alien: [40, 255, 80],
};

// ---------- small maths
// Every flicker steps on one shared clock of at most FLICK changes a second (<= 2 flashes/s), under the
// <= 3 flashes/s rule for road-facing lights (photosensitive safety); the old 7-30 Hz values were over it (2026-10-27).
export const FLICK = 4;
export const SPIN_MAX = 2.0;   // turbine top speed, rev/s
// Spokes at rest read ~2 % on the real strip (not very bright to the eye); this sim's bloom hid it.
// Stronger base and flow wave, then this gain on the resting layer only; abduction phases are unchanged.
export const SPOKE_GAIN = 2.5;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const frac = (x) => x - Math.floor(x);
const sstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const circ = (a, b) => { const d = Math.abs(a - b) % 1; return d > 0.5 ? 1 - d : d; };
export function hash(n) {
  n = (n | 0) ^ 61 ^ ((n | 0) >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (x, y) => hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
export function vnoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// colour helpers write into o (length 3) so the hot loop doesn't allocate
const set = (o, c, k = 1) => { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; };
const add = (o, c, k = 1) => { o[0] += c[0] * k; o[1] += c[1] * k; o[2] += c[2] * k; };
const mixTo = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };
const mul = (o, k) => { o[0] *= k; o[1] *= k; o[2] *= k; };
const lerpC = (a, b, k, out) => { out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k; out[2] = a[2] + (b[2] - a[2]) * k; return out; };
const T1 = [0, 0, 0], T2 = [0, 0, 0];

// ---------- state
export function makeState(seed = 25) {
  return {
    mode: "idle", ts: 0, t: 0, seq: false,
    spin: 0.07, rimPh: 0,                    // turbine: rev/s with inertia, phase in revolutions
    look: [0, 0], pupil: 0.24,               // iris gaze (saucer x/z, -1..1) and pupil radius (0..1 of disc)
    blink: 0, blinkT: -1, blinkNext: 4,      // iris blink, rings close outside-in
    eyeBlink: 0, eyeT: -1, eyeNext: 2.5,     // alien eye blink
    ev: "", evT: 0, evNext: 18, evEnd: -10,  // idle event: "" | sputter | comms | search; evEnd: when the last one ended
    rng: (seed >>> 0) || 1, passengers: 0, personA: 0.5,
  };
}
function rnd(st) { let x = st.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; st.rng = x >>> 0; return st.rng / 4294967296; }

export function phaseName(st) {
  if (st.mode !== "abduction") return st.mode === "idle" && st.ev ? st.ev : st.mode;
  const s = st.ts;
  return s < PH.charge ? "lock-on" : s < PH.beam ? "charge" : s < PH.lift ? "beam" : s < PH.flash ? "lift" : s < PH.release ? "flash" : "release";
}

function turbineTarget(st) {
  if (st.mode === "approach") return 0.45;
  if (st.mode === "abduction") {
    const s = st.ts;
    return s < PH.charge ? 1.33 : s < PH.beam ? 1.58 : s < PH.release ? SPIN_MAX : 0.5;   // top 2.0 rev/s (was 2.4): one comet passes a point at most 2x a second
  }
  if (st.mode === "idle" && st.ev === "sputter") return st.evT < 2.6 ? 0 : st.evT < 5.4 ? 0.02 : 0.07;
  return 0.07;
}
function pupilTarget(st) {
  if (st.mode === "approach") return 0.15;
  if (st.mode === "abduction") { const s = st.ts; return s < PH.charge ? 0.07 : s < PH.beam ? 0.1 : s < PH.release ? 0.32 : 0.36; }
  return 0.24 + 0.05 * Math.sin(st.t * 0.9);
}

export function stepState(st, dt, inp = {}) {
  st.t += dt; st.ts += dt;
  // a mode change ends any event and puts the next one at least 20 s out (else an event cut short was followed at
  // once by a fresh one, e.g. a sputter dropping the craft dark)
  if (inp.mode) { if (st.ev) st.evEnd = st.t; st.mode = inp.mode; st.ts = 0; st.seq = !!inp.seq; st.ev = ""; st.evNext = Math.max(st.evNext, st.t + 20); }
  if (inp.event) { if (st.mode !== "idle") { st.mode = "idle"; st.ts = 0; st.seq = false; } st.ev = inp.event; st.evT = 0; }
  if (inp.personA !== undefined) st.personA = inp.personA;

  // state machine
  if (st.mode === "approach" && st.seq && st.ts >= DUR.approach) { st.mode = "abduction"; st.ts = 0; }
  else if (st.mode === "abduction") {
    if (st.ts - dt < PH.flash && st.ts >= PH.flash) st.passengers++;
    if (st.ts >= PH.end) { st.mode = "cooldown"; st.ts = 0; }
  } else if (st.mode === "cooldown" && st.ts >= DUR.cooldown) { st.mode = "idle"; st.ts = 0; st.seq = false; }

  // idle events: never the same evening twice
  if (st.mode === "idle") {
    if (st.ev) { st.evT += dt; if (st.evT >= EV_DUR[st.ev]) { st.ev = ""; st.evEnd = st.t; st.evNext = st.t + 20 + 40 * rnd(st); } }
    // wait for a calm turbine: comets plus an event went over 3/s
    else if (st.t >= st.evNext && st.spin < 0.2) { const r = rnd(st); st.ev = r < 0.34 ? "comms" : r < 0.67 ? "search" : "sputter"; st.evT = 0; }
  } else st.ev = "";

  // turbine with inertia: quick to spin up, slow to spin down
  const tgt = turbineTarget(st), tau = tgt > st.spin ? 0.9 : 2.2;
  st.spin += (tgt - st.spin) * (1 - Math.exp(-dt / tau));
  st.rimPh = frac(st.rimPh + st.spin * dt);

  // gaze
  let lx, lz;
  if (st.mode === "idle" && st.ev === "search") { lx = Math.cos(st.evT * 1.4) * 0.9; lz = Math.sin(st.evT * 1.4) * 0.75; }
  else if ((st.mode === "approach" || st.mode === "abduction") && inp.look) { lx = inp.look[0]; lz = inp.look[1]; }
  else { lx = (vnoise2(st.t * 0.13, 1.7) - 0.5) * 0.9; lz = (vnoise2(st.t * 0.13, 8.3) - 0.5) * 0.9; }
  const gk = 1 - Math.exp(-dt / (st.mode === "abduction" ? (st.ts < PH.charge ? 0.07 : 0.18) : 0.4));   // lock-on: the eye snaps to the person
  st.look[0] += (lx - st.look[0]) * gk; st.look[1] += (lz - st.look[1]) * gk;
  st.pupil += (pupilTarget(st) - st.pupil) * (1 - Math.exp(-dt / 0.3));

  // blinks (not while busy)
  const calm = (st.mode === "idle" && st.ev !== "sputter") || st.mode === "approach" || st.mode === "cooldown";
  if (calm && st.blinkT < 0 && st.t >= st.blinkNext) st.blinkT = 0;
  if (st.blinkT >= 0) {
    st.blinkT += dt; st.blink = Math.sin(Math.PI * Math.min(1, st.blinkT / 0.38));
    if (st.blinkT >= 0.38) { st.blinkT = -1; st.blink = 0; st.blinkNext = st.t + 5 + 9 * rnd(st); }
  }
  if (st.eyeT < 0 && st.t >= st.eyeNext) st.eyeT = 0;
  if (st.eyeT >= 0) {
    st.eyeT += dt; st.eyeBlink = Math.sin(Math.PI * Math.min(1, st.eyeT / 0.16));
    if (st.eyeT >= 0.16) { st.eyeT = -1; st.eyeBlink = 0; st.eyeNext = st.t + 2 + 5 * rnd(st); }
  }
  return st;
}

export function beamLevel(st) {
  if (st.mode !== "abduction") return 0;
  const s = st.ts;
  if (s < PH.beam) return 0;
  if (s < PH.lift) return sstep(PH.beam, PH.beam + 0.25, s);
  if (s < PH.flash) return hash2(Math.floor(st.t * FLICK), 5) > 0.3 ? 1 : 0.25;
  if (s < PH.black) return 1;
  return 0;
}
export function fogRelay(st) { return st.mode === "abduction" && st.ts >= 4.0 && st.ts < 7.0 ? 1 : 0; }

const GLYPHS = "⟟⏃⌰⟒⏁⍜⋔⌇⊬⟊⏚⎍⟒⌿⍀⋏⊑";
export function wallText(st) {
  if (st.mode === "approach") return { k: "LED WALL", v: "GATE 20 · STAND BY" };
  if (st.mode === "abduction") return st.ts < PH.flash ? { k: "LED WALL", v: "HUMAN DETECTED" } : { k: "LED WALL", v: `PASSENGERS ABOARD: ${st.passengers}` };
  if (st.mode === "cooldown") return { k: "LED WALL", v: `PASSENGERS ABOARD: ${st.passengers}` };
  if (st.mode === "idle" && st.ev === "comms") {
    let s = ""; const seed = Math.floor(st.t - st.evT);
    for (let k = 0; k < 14; k++) s += k % 5 === 4 ? " " : GLYPHS[Math.floor(hash2(seed, k) * GLYPHS.length)];
    return { k: "LED WALL · INCOMING", v: s.slice(0, 1 + Math.floor(Math.min(1, st.evT / 1.5) * 13)) };
  }
  return null;
}

// ---------- per-segment pixel functions
// The turbine on a perimeter line: 4 comets with exponential tails; dir +1 runs with the perimeter, -1 against.
function perimPx(a, st, o, dir) {
  const t = st.t, sp = clamp01(st.spin / SPIN_MAX);
  set(o, C.tealDeep, 0.07 + 1.0 * sp);
  const tail = 0.05 + 0.16 * sp, head = lerpC(C.teal, C.hot, sp, T1), ph = dir > 0 ? st.rimPh : -st.rimPh;
  let b = 0;
  // comet k fades out once (k+1) comets would pass a point more than ~2 times a second: at full spin one
  // comet remains, so no part of the rim flashes faster than the road-facing limit (<= 3/s)
  for (let k = 0; k < 4; k++) {
    const wk = k === 0 ? 1 : clamp01(1 - ((k + 1) * st.spin - 2.0) / 0.4);
    if (wk <= 0) continue;
    const h = frac(ph + k / 4), d = dir > 0 ? frac(h - a) : frac(a - h); if (d < 0.6) b = Math.max(b, wk * Math.exp(-d / tail));
  }
  b = Math.pow(b, 1.6 - 0.6 * sp);                                // tight comet at idle, long trail at speed
  const shimmer = 0.96 + 0.08 * hash2(Math.floor(a * 500), Math.floor(t * FLICK));
  add(o, lerpC(C.teal, head, b * b, T2), b * shimmer);

  if (st.mode === "abduction") {
    const s = st.ts;
    if (s >= PH.charge && s < PH.beam) add(o, C.cyan, 0.3 * sstep(PH.charge, PH.beam, s));
    if (s >= PH.beam && s < PH.flash) add(o, C.violet, 0.3);
    // lift: white patches swell and fade smoothly (was on/off sparkle per face; with the comet it went over 3/s)
    if (s >= PH.lift && s < PH.flash) add(o, C.white, 0.7 * sstep(PH.lift, PH.lift + 0.4, s) * sstep(0.45, 0.85, vnoise2(a * 8 + (dir > 0 ? 0 : 50), t * 1.5)));
    if (s >= PH.release) {
      const w = (s - PH.release) / 0.8 * 0.5, d = circ(a, 0.5);
      set(o, C.tealDeep, 0.5);
      const e = Math.exp(-(((d - w) / 0.03) ** 2)) * (1 - sstep(PH.release, PH.end, s) * 0.6);
      add(o, lerpC(C.white, C.cyan, clamp01((s - PH.release) * 1.5), T1), e);
    }
  }
  if (st.mode === "idle" && st.ev === "comms") {
    const env = sstep(0, 0.3, st.evT) * (1 - sstep(4.2, 4.6, st.evT)), cell = Math.floor(a * 72) + (dir > 0 ? 0 : 1000);
    // half the shared flicker clock: at 4 changes/s, on top of the comets, a face went over 3 flashes/s
    if (hash2(cell, Math.floor(st.evT * FLICK * 0.5)) > 0.6) mixTo(o, cell % 3 === 0 ? C.pink : C.yel, 0.9 * env);
  }
}
function rimPx(i, st, o) { const a = i / 500; perimPx(a, st, o, 1); navOverlay(a, st, o); }
function lineAPx(i, st, o) { const a = i / 440; perimPx(a, st, o, 1); navOverlay(a, st, o); }   // nav + strobes live here
function lineBPx(i, st, o) { perimPx(i / 428, st, o, -1); }                                         // counter-rotating halo line

// Portholes: cabin life. Each window has a warm or cool cabin colour, its own flicker, switches on and off on
// its own clock, and now and then something walks past it (a shadow sweeping across the ring).
const WARM = [255, 150, 60], COOL = [120, 205, 255];
function portsPx(i, st, o) {
  const w = i >> 4, k = i & 15, t = st.t, aw = WIN_A[w];
  const th = (k / 16) * Math.PI * 2, kx = Math.cos(th);
  const cabin = hash(w + 300) > 0.45 ? WARM : COOL;
  const idleWin = () => {
    const P = 7 + 9 * hash(w + 40), u = t / P + hash(w + 41), cell = Math.floor(u), into = frac(u) * P;
    const on = hash2(w, cell) > 0.3, was = hash2(w, cell - 1) > 0.3;
    let lv = on ? 0.42 + 0.16 * vnoise2(t * 2.7, w * 3.1) : 0.015;
    if (on && !was && into < 0.45) lv *= hash2(w, Math.floor(t * FLICK)) > 0.45 ? 1 : 0.05;       // fluorescent strike
    set(o, cabin, lv);
    add(o, cabin, 0.06 * lv * (hash2(i, Math.floor(t * FLICK)) - 0.5));
    // someone walks past
    const Q = 9 + 6 * hash(w + 70), v = t / Q + hash(w + 71), pc = Math.floor(v), pin = frac(v) * Q;
    if (on && hash2(w + 7, pc) > 0.55 && pin > 2 && pin < 3.7) {
      const cx = (-1.4 + 2.8 * ((pin - 2) / 1.7)) * (hash2(w, pc) > 0.5 ? 1 : -1);   // left-to-right or back
      if (Math.abs(kx - cx) < 0.5) mul(o, 0.1);
    }
  };
  if (st.mode === "idle" || st.mode === "cooldown") {
    idleWin();
    // comms: windows blend toward yellow / pink on half the flicker clock, fading in and out with the event (it set the
    // colour outright, so a window dropped to black as comms began and snapped back as it ended)
    if (st.mode === "idle" && st.ev === "comms" && hash2(w, Math.floor(st.evT * FLICK * 0.5)) > 0.55)
      mixTo(o, w % 3 ? C.yel : C.pink, 0.8 * sstep(0, 0.3, st.evT) * (1 - sstep(4.2, 4.6, st.evT)));
  } else if (st.mode === "approach") {
    // crew rushing to look: windows light in sequence from the person's side, shadows moving fast
    const d = circ(aw, st.personA), at = d * 3.4;
    if (d < 0.32 && st.ts > at) {
      const e = st.ts - at;
      set(o, lerpC(COOL, C.white, 0.35, T1), 0.85 * sstep(0, 0.25, e));   // fades on (it flickered on; with the shadows a window went over 3/s)
      const cx = Math.sin(t * (2.5 + 2 * hash(w)) + w) * 1.1;   // 0.4-0.7 Hz: faster, a window dimmed over 3 times a second
      mul(o, 0.35 + 0.65 * sstep(0.35, 0.55, Math.abs(kx - cx)));   // soft-edged, lighter shadow: a hard edge stepped one LED at a time
    } else idleWin(), mul(o, 0.5);
  } else {
    const s = st.ts, sp = clamp01(st.spin / SPIN_MAX);
    if (s < PH.charge) {                                           // lock-on: windows on the person's side lock on in sequence
      const d = circ(aw, st.personA), at = 0.15 + d * 2.6;
      set(o, C.cyan, 0.05);
      if (d < 0.3 && s > at) set(o, s < at + 0.08 ? C.white : lerpC(C.hot, C.cyan, d / 0.3, T1), s < at + 0.08 ? 1 : 0.95 - d);
    } else if (s < PH.beam) {                                      // charge: chase with the turbine
      // one sweep at 1.5 a second (not the turbine's 4 comets, which lit each window up to 8 times a second)
      // A sharp comet lit the 8 windows one after another, so the ring as one area pulsed 12 times a second. A cos^4
      // lobe has no harmonic above the 4th, so over 8 evenly spaced windows the ring's total stays constant.
      const b = (0.5 + 0.5 * Math.cos(2 * Math.PI * (frac(st.t * 1.5) - aw))) ** 4;
      set(o, C.cyan, s < PH.charge ? 0.08 : 0.08 + 0.4 * sstep(PH.charge, PH.beam, s));
      add(o, lerpC(C.cyan, C.hot, sp, T1), b);
    } else if (s < PH.flash) {
      set(o, C.violet, 0.4 + 0.25 * Math.sin(t * 9 + w * 0.8));
      add(o, C.cyan, 0.25 * Math.exp(-frac(t * 1.6 - k / 16) * 4));
      if (s >= PH.lift && hash2(w, Math.floor(t * FLICK)) > 0.6) set(o, C.white);
    } else if (s >= PH.release) {                                  // windows reboot one by one
      const on = PH.release + 0.12 + w * 0.06;
      if (s < on) set(o, C.white, 0); else if (s < on + 0.09) set(o, C.white, 0.9); else set(o, C.cyan, 0.3);
    }
  }
}
function navOverlay(a, st, o) {
  // aviation lights: red port, green starboard (steady); white double-flash anti-collision strobes fore and aft
  if (circ(a, 0.25) < 0.013) set(o, C.red);
  else if (circ(a, 0.75) < 0.013) set(o, C.green);
  // strobes only while the craft idles calm (no event for a second, turbine slow): on top of the comets, the comms cells or the
  // sputter's reboot they took a face over
  // 3 flashes/s (the turbine is still fast right after an abduction is cut short). Fore and aft flash
  // together: half a cycle apart, the rim as a whole saw two double flashes in one second.
  else if (st.mode === "idle" && !st.ev && st.t - st.evEnd > 1 && st.spin < 0.2 && (circ(a, 0.5) < 0.009 || circ(a, 0) < 0.009)) {
    const p = frac(st.t / 1.5);
    if (p < 0.035 || (p > 0.1 && p < 0.135)) set(o, C.white);
  }
}

function irisPx(i, st, o) {
  const [r, pos] = IRIS_POS[i], t = st.t, rho = r / 8, phi = pos * Math.PI * 2;
  const x = rho * Math.cos(phi), z = rho * Math.sin(phi);
  const lx = st.look[0] * 0.34, lz = st.look[1] * 0.34;
  const d = Math.hypot(x - lx, z - lz), p = st.pupil;
  const sp = clamp01(st.spin / SPIN_MAX), ang = phi + 0.9 * rho + t * (0.25 + 0.8 * sp);
  const n = vnoise2(rho * Math.cos(ang) * 2.6 + 10, rho * Math.sin(ang) * 2.6 + t * 0.3);
  set(o, lerpC(C.teal, C.violet, n, T1), 0.16 + 0.6 * n * n);
  add(o, C.pink, 0.75 * Math.exp(-(((d - p) / 0.06) ** 2)));         // limbal ring
  if (d < p) mul(o, 0.03 + 0.97 * sstep(p - 0.06, p, d));            // pupil

  if (st.mode === "abduction") {
    const s = st.ts;
    if (s >= PH.charge && s < PH.beam) {                               // core goes white as the spokes fill
      const k = sstep(PH.charge, PH.beam, s);
      add(o, C.hot, k * Math.exp(-d / (0.08 + 0.35 * k)) * 1.2);
    } else if (s >= PH.beam && s < PH.flash) {
      set(o, lerpC(C.teal, C.violet, n, T1), 0.35);
      add(o, C.hot, Math.exp(-rho / 0.5) * (s >= PH.lift ? 0.6 + 0.4 * hash2(Math.floor(t * FLICK), 9) : 1));
    } else if (s >= PH.release) {
      const w = (s - PH.release) / 0.45;
      set(o, C.tealDeep, 0.4);
      add(o, C.white, Math.exp(-(((rho - w) / 0.12) ** 2)));
    }
  }
  if (st.mode === "idle" && st.ev === "comms" && hash2(r, Math.floor(st.evT * FLICK)) > 0.55) add(o, C.pink, 0.5);
  if (st.blink > 0 && rho > 1.02 - st.blink * 1.1) mul(o, 0.02);          // blink: rings close outside-in
  // anti-collision beacon, belly side: centre pixel pulses red when the eye is calm
  if (r === 0 && st.mode !== "abduction") { const b = Math.exp(-frac(t * 0.9) * 7); if (b > 0.05) mixTo(o, C.red, b); }
}

function spokesPx(i, st, o) {
  const s = Math.floor(i / SPOKE_N), j = i % SPOKE_N, u = j / (SPOKE_N - 1), t = st.t;
  const busy = st.mode === "approach" ? 1 : 0;
  set(o, C.tealDeep, 0.6);
  add(o, C.teal, (0.12 + 0.08 * busy) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (u * 5 - t * (0.6 + 1.6 * busy)))));
  const P = (3.4 + 3 * hash(s + 1)) / (1 + 2.5 * busy), hd = frac(t / P + hash(s + 11)) * 1.4 - 0.2;
  const dd = hd - u;
  add(o, C.cyan, (0.7 + 0.3 * busy) * (dd >= 0 ? Math.exp(-dd / 0.07) : Math.exp(dd / 0.012)));
  mul(o, SPOKE_GAIN);

  if (st.mode === "abduction") {
    const s2 = st.ts;
    if (s2 < PH.charge) add(o, C.cyan, 0.4 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (u * 4 - t * 2.5))));
    else if (s2 < PH.beam) {                                           // fill toward the core
      const L = sstep(PH.charge, PH.beam - 0.3, s2);
      if (u <= L) set(o, lerpC(C.teal, C.hot, L, T1), 0.35 + 0.65 * u);
      add(o, C.white, Math.exp(-(((u - L) / 0.03) ** 2)));
    } else if (s2 < PH.flash) {
      const ph = frac(u * 4 - t * 3.2);
      set(o, C.violet, 0.25); add(o, lerpC(C.cyan, C.white, 0.6, T1), Math.exp(-ph * 5));
      if (s2 >= PH.lift && hash2(Math.floor(t * FLICK), s) < 0.3) mul(o, 0.1);
    } else if (s2 >= PH.release) {                                      // shockwave outward
      const w = 1 - (s2 - PH.release) / 0.5;
      set(o, C.tealDeep, 0.3);
      add(o, C.white, Math.exp(-(((u - w) / 0.06) ** 2)));
    }
  }
}

function cockpitPx(i, st, o) {
  const t = st.t;
  set(o, C.alien, st.mode === "approach" ? 0.7 : 0.38 + 0.1 * Math.sin(t * 1.1));
  if (st.mode === "abduction") {
    const s = st.ts;
    if (s < PH.beam) set(o, C.alien, 0.6 + 0.4 * sstep(0, PH.beam, s));
    else if (s < PH.flash) { set(o, C.red, 0.55 + 0.45 * (hash2(Math.floor(t * FLICK), 3) > 0.4 ? 1 : 0)); }
    else set(o, C.alien, 0.5);
  }
}
function eyesPx(i, st, o) {
  set(o, C.alien, st.mode === "approach" ? 1 : 0.32);
  if (st.mode === "abduction") {
    if (st.ts < PH.charge) set(o, C.alien, 1);
    else if (st.ts < PH.flash) set(o, C.red, 0.6 + 0.4 * (Math.floor(st.t * FLICK * 0.5) % 2));   // once a second: with a lid blink on top it went over 3/s
  }
  if (!(st.mode === "abduction" && st.ts >= PH.charge && st.ts < PH.flash)) mul(o, 1 - st.eyeBlink);   // no lid blink while blinking red
}

const FN = { rim: rimPx, lineA: lineAPx, lineB: lineBPx, ports: portsPx, iris: irisPx, spokes: spokesPx, cockpit: cockpitPx, eyes: eyesPx };

export function px(seg, i, st, o) {
  FN[seg](i, st, o);
  // cooldown: idle comes back up from dim
  if (st.mode === "cooldown") mul(o, 0.3 + 0.7 * sstep(0, DUR.cooldown, st.ts));
  // flash: whole craft white, then black
  if (st.mode === "abduction" && st.ts >= PH.flash && st.ts < PH.release) set(o, C.white, st.ts < PH.black ? 1 : 0);
  // power sputter: brownout flicker, then a reboot that re-initialises the craft face by face
  if (st.mode === "idle" && st.ev === "sputter") {
    const e = st.evT;
    // windows go dark, and later come back, in 4 groups of opposite windows 0.4 s apart: the ring is one area
    // from the street, so it may change at most 3 times a second (it was 6 at 0.13 s steps)
    if (seg === "ports" && e < 2.6 && e > 0.25 + ((i >> 4) & 3) * 0.4) mul(o, 0);
    else if (e < 2.6) {
      const f = Math.floor(e * FLICK), on = hash2(f, 3) > 0.45;
      mul(o, on ? (0.15 + 0.6 * hash2(f, 7)) * (1 - (e / 2.6) * 0.7) : 0.02);
    } else if (seg === "rim" || seg === "lineA" || seg === "lineB") {
      const face = Math.floor((i / COUNTS[seg]) * 8), tf = 2.8 + (face & 3) * 0.4 + (seg === "lineB" ? 0.15 : 0);   // 4 groups of opposite faces 0.4 s apart: the rim as one area <= 3/s
      if (e < tf) mul(o, 0); else if (e < tf + 0.18) set(o, C.white, 0.9);
    } else if (seg === "ports") { const tw = 3.0 + ((i >> 4) & 3) * 0.4; if (e < tw) mul(o, 0); else if (e < tw + 0.1) set(o, C.white, 0.8); } else if (seg === "spokes") { if (e < 5.3 + Math.floor(i / SPOKE_N) * 0.08) mul(o, 0); }
    else if (seg === "iris") { if (e < 5.6 + IRIS_POS[i][0] * 0.08) mul(o, 0); }
    else if (e < 6.0) mul(o, 0);
    else if (seg === "eyes") mul(o, Math.floor(e * FLICK) % 3 === 0 ? 0 : 1);
  }
  return o;
}

// Brightness cap + supply limiter, exactly as the firmware does it: scale the whole saucer frame so the 5 V
// draw stays under limitA (60 mA per LED at full white, ~20 mA per channel at 255).
export function frameAmps(buf) { let s = 0; for (let k = 0; k < buf.length; k++) s += buf[k]; return (s / 255) * 0.020; }
export function limitFrame(saucerBuf, cap, limitA) {
  const raw = frameAmps(saucerBuf) * cap;
  const k = raw > limitA ? (cap * limitA) / raw : cap;
  return { scale: k, rawAmps: raw, amps: Math.min(raw, limitA) };
}

#pragma once
// UFO-25 show, ported line for line from ufo-sim/src/show.js (v2) so the saucer looks like the sim.
// Kept in a header so the Arduino prototype generator sees the types first.
//
// Logical segments, as in the sim:
//   lineA   440  top rim, a = i/440 perimeter fraction from the AFT flat, clockwise seen from above
//   cockpit 115  dome lip ring (the sim had 100; the colour is uniform, so the count doesn't matter)
//   spokes  480  8 x 60 (a full metre each, as built), j = 0 at the rim, 59 at the iris
//   iris    241  9 rings, centre first
//   ports   128  8 portholes x 16-LED rings (the sim had 16 windows; the 2026 build has 8)
//   eyes      2  the alien's eyes
// Same state + same inputs = same pixels: randomness only from st.rng (xorshift32).
#include <math.h>
#include <stdint.h>

struct Col { float r, g, b; };

namespace ufo {

static const int SPOKE_N = 60;   // a full metre of 60/m strip per spoke, as built (the plan had 56)
static const int N_LINEA = 440, N_COCKPIT = 115, N_SPOKES = 8 * SPOKE_N, N_IRIS = 241, N_PORTS = 8 * 16, N_EYES = 2;
static const uint8_t IRIS_RINGS[9] = { 1, 8, 12, 16, 24, 32, 40, 48, 60 };

// abduction phase boundaries, seconds into the abduction
static const float PH_CHARGE = 2.0f, PH_BEAM = 4.5f, PH_LIFT = 8.0f, PH_FLASH = 9.6f, PH_BLACK = 9.75f, PH_RELEASE = 10.05f, PH_END = 11.2f;
static const float DUR_APPROACH = 3.5f, DUR_COOLDOWN = 3.0f;
static const float EVD_SPUTTER = 6.6f, EVD_COMMS = 4.6f, EVD_SEARCH = 6.0f;

static const Col TEAL_DEEP = { 0, 34, 44 }, TEAL = { 0, 165, 160 }, CYAN = { 40, 225, 255 }, HOT = { 215, 250, 255 },
                 VIOLET = { 100, 36, 255 }, PINK = { 255, 62, 181 }, YEL = { 255, 233, 0 }, RED = { 255, 0, 0 },
                 GREEN = { 0, 255, 40 }, WHITE = { 255, 255, 255 }, ALIEN = { 40, 255, 80 },
                 WARM = { 255, 150, 60 }, COOL = { 120, 205, 255 };

enum Mode : uint8_t { IDLE, APPROACH, ABDUCTION, COOLDOWN };
enum Ev : uint8_t { EV_NONE, EV_SPUTTER, EV_COMMS, EV_SEARCH };
enum Seg : uint8_t { S_LINEA, S_COCKPIT, S_SPOKES, S_IRIS, S_PORTS, S_EYES };

struct State {
  Mode mode; float ts, t; bool seq;
  float spin, rimPh;
  float lookX, lookZ, pupil;
  float blink, blinkT, blinkNext;
  float eyeBlink, eyeT, eyeNext;
  Ev ev; float evT, evNext, evEnd;   // evEnd: when the last event ended (strobes wait a second after it)
  uint32_t rng; int passengers; float personA;
};

struct Input { bool hasMode; Mode mode; bool seq; Ev event; bool hasLook; float lookX, lookZ; };

// ---------- small maths
static inline float clamp01(float x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
static inline float frac(float x) { return x - floorf(x); }
static inline float sstep(float a, float b, float x) { float u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
static inline float circ(float a, float b) { float d = fmodf(fabsf(a - b), 1.0f); return d > 0.5f ? 1 - d : d; }
static inline float sqr(float x) { return x * x; }
static inline float hash1(int32_t n) {
  uint32_t v = (uint32_t)n ^ 61u ^ ((uint32_t)n >> 16);
  v *= 9u; v ^= v >> 4; v *= 0x27d4eb2du; v ^= v >> 15;
  return v / 4294967296.0f;
}
static inline float hash2(int32_t x, int32_t y) { return hash1((int32_t)(((uint32_t)x * 73856093u) ^ ((uint32_t)y * 19349663u))); }
static inline float vnoise2(float x, float y) {
  float xi = floorf(x), yi = floorf(y), xf = x - xi, yf = y - yi;
  float u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  int ix = (int)xi, iy = (int)yi;
  float a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
static inline int fl(float x) { return (int)floorf(x); }
// Every flicker in the show steps on one shared clock of at most FLICK changes a second (<= 2 flashes/s),
// under the <= 3 flashes/s rule for road-facing lights (photosensitive safety). The sim's 7-30 Hz values were
// over it (2026-10-27).
static const float FLICK = 4.0f;
static const float SPIN_MAX = 2.0f;   // turbine top speed, rev/s
// Spokes at rest read ~2 % on the real strip (not very bright to the eye); the sim's bloom hid it.
// Stronger base and flow wave, then this gain on the resting layer only; abduction phases are unchanged.
static const float SPOKE_GAIN = 2.5f;

// colour helpers
static inline void set(Col& o, const Col& c, float k = 1) { o.r = c.r * k; o.g = c.g * k; o.b = c.b * k; }
static inline void add(Col& o, const Col& c, float k = 1) { o.r += c.r * k; o.g += c.g * k; o.b += c.b * k; }
static inline void mixTo(Col& o, const Col& c, float k) { o.r += (c.r - o.r) * k; o.g += (c.g - o.g) * k; o.b += (c.b - o.b) * k; }
static inline void mul(Col& o, float k) { o.r *= k; o.g *= k; o.b *= k; }
static inline Col lerpC(const Col& a, const Col& b, float k) { return { a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k }; }

// iris geometry: logical pixel -> ring and fraction around it
static uint8_t irisRing[N_IRIS];
static float irisPos[N_IRIS];
static void initIris() {
  int i = 0;
  for (int r = 0; r < 9; r++) for (int k = 0; k < IRIS_RINGS[r]; k++, i++) { irisRing[i] = r; irisPos[i] = (float)k / IRIS_RINGS[r]; }
}
// porthole w faces perimeter fraction WIN_A(w). P1 assumed on the aft face, then clockwise (only steers the
// approach / lock-on direction, which needs the camera; adjust PORT_A0 once the portholes are placed).
static const float PORT_A0 = 0.0f;
static inline float winA(int w) { return frac(w / 8.0f + PORT_A0); }

// ---------- state
static void makeState(State& st, uint32_t seed = 25) {
  st = State{};
  st.mode = IDLE; st.ts = 0; st.t = 0; st.seq = false;
  st.spin = 0.07f; st.rimPh = 0;
  st.lookX = 0; st.lookZ = 0; st.pupil = 0.24f;
  st.blink = 0; st.blinkT = -1; st.blinkNext = 4;
  st.eyeBlink = 0; st.eyeT = -1; st.eyeNext = 2.5f;
  st.ev = EV_NONE; st.evT = 0; st.evNext = 18; st.evEnd = -10;
  st.rng = seed ? seed : 1; st.passengers = 0; st.personA = 0.5f;
}
static inline float rnd(State& st) { uint32_t x = st.rng; x ^= x << 13; x ^= x >> 17; x ^= x << 5; st.rng = x; return x / 4294967296.0f; }

static const char* phaseName(const State& st) {
  if (st.mode != ABDUCTION) {
    if (st.mode == IDLE) return st.ev == EV_SPUTTER ? "sputter" : st.ev == EV_COMMS ? "comms" : st.ev == EV_SEARCH ? "search" : "idle";
    return st.mode == APPROACH ? "approach" : "cooldown";
  }
  float s = st.ts;
  return s < PH_CHARGE ? "lock-on" : s < PH_BEAM ? "charge" : s < PH_LIFT ? "beam" : s < PH_FLASH ? "lift" : s < PH_RELEASE ? "flash" : "release";
}

static float turbineTarget(const State& st) {
  if (st.mode == APPROACH) return 0.45f;
  if (st.mode == ABDUCTION) { float s = st.ts; return s < PH_CHARGE ? 1.33f : s < PH_BEAM ? 1.58f : s < PH_RELEASE ? SPIN_MAX : 0.5f; }   // top 2.0 rev/s (was 2.4): one comet passes a point at most 2x a second
  if (st.mode == IDLE && st.ev == EV_SPUTTER) return st.evT < 2.6f ? 0 : st.evT < 5.4f ? 0.02f : 0.07f;
  return 0.07f;
}
static float pupilTarget(const State& st) {
  if (st.mode == APPROACH) return 0.15f;
  if (st.mode == ABDUCTION) { float s = st.ts; return s < PH_CHARGE ? 0.07f : s < PH_BEAM ? 0.1f : s < PH_RELEASE ? 0.32f : 0.36f; }
  return 0.24f + 0.05f * sinf(st.t * 0.9f);
}
static float evDur(Ev e) { return e == EV_SPUTTER ? EVD_SPUTTER : e == EV_COMMS ? EVD_COMMS : EVD_SEARCH; }

static void stepState(State& st, float dt, const Input& inp) {
  st.t += dt; st.ts += dt;
  // a mode change ends any event and puts the next one at least 20 s out (else an event cut short was followed at
  // once by a fresh one, e.g. a sputter dropping the craft dark)
  if (inp.hasMode) { if (st.ev != EV_NONE) st.evEnd = st.t; st.mode = inp.mode; st.ts = 0; st.seq = inp.seq; st.ev = EV_NONE; st.evNext = fmaxf(st.evNext, st.t + 20); }
  if (inp.event != EV_NONE) { if (st.mode != IDLE) { st.mode = IDLE; st.ts = 0; st.seq = false; } st.ev = inp.event; st.evT = 0; }

  // state machine
  if (st.mode == APPROACH && st.seq && st.ts >= DUR_APPROACH) { st.mode = ABDUCTION; st.ts = 0; }
  else if (st.mode == ABDUCTION) {
    if (st.ts - dt < PH_FLASH && st.ts >= PH_FLASH) st.passengers++;
    if (st.ts >= PH_END) { st.mode = COOLDOWN; st.ts = 0; }
  } else if (st.mode == COOLDOWN && st.ts >= DUR_COOLDOWN) { st.mode = IDLE; st.ts = 0; st.seq = false; }

  // idle events: never the same evening twice
  if (st.mode == IDLE) {
    if (st.ev != EV_NONE) { st.evT += dt; if (st.evT >= evDur(st.ev)) { st.ev = EV_NONE; st.evEnd = st.t; st.evNext = st.t + 20 + 40 * rnd(st); } }
    // wait for a calm turbine: comets plus an event went over 3/s
    else if (st.t >= st.evNext && st.spin < 0.2f) { float r = rnd(st); st.ev = r < 0.34f ? EV_COMMS : r < 0.67f ? EV_SEARCH : EV_SPUTTER; st.evT = 0; }
  } else st.ev = EV_NONE;

  // turbine with inertia: quick to spin up, slow to spin down
  float tgt = turbineTarget(st), tau = tgt > st.spin ? 0.9f : 2.2f;
  st.spin += (tgt - st.spin) * (1 - expf(-dt / tau));
  st.rimPh = frac(st.rimPh + st.spin * dt);

  // gaze
  float lx, lz;
  if (st.mode == IDLE && st.ev == EV_SEARCH) { lx = cosf(st.evT * 1.4f) * 0.9f; lz = sinf(st.evT * 1.4f) * 0.75f; }
  else if ((st.mode == APPROACH || st.mode == ABDUCTION) && inp.hasLook) { lx = inp.lookX; lz = inp.lookZ; }
  else { lx = (vnoise2(st.t * 0.13f, 1.7f) - 0.5f) * 0.9f; lz = (vnoise2(st.t * 0.13f, 8.3f) - 0.5f) * 0.9f; }
  float gk = 1 - expf(-dt / (st.mode == ABDUCTION ? (st.ts < PH_CHARGE ? 0.07f : 0.18f) : 0.4f));
  st.lookX += (lx - st.lookX) * gk; st.lookZ += (lz - st.lookZ) * gk;
  st.pupil += (pupilTarget(st) - st.pupil) * (1 - expf(-dt / 0.3f));

  // blinks (not while busy)
  bool calm = (st.mode == IDLE && st.ev != EV_SPUTTER) || st.mode == APPROACH || st.mode == COOLDOWN;
  if (calm && st.blinkT < 0 && st.t >= st.blinkNext) st.blinkT = 0;
  if (st.blinkT >= 0) {
    st.blinkT += dt; st.blink = sinf((float)M_PI * fminf(1, st.blinkT / 0.38f));
    if (st.blinkT >= 0.38f) { st.blinkT = -1; st.blink = 0; st.blinkNext = st.t + 5 + 9 * rnd(st); }
  }
  if (st.eyeT < 0 && st.t >= st.eyeNext) st.eyeT = 0;
  if (st.eyeT >= 0) {
    st.eyeT += dt; st.eyeBlink = sinf((float)M_PI * fminf(1, st.eyeT / 0.16f));
    if (st.eyeT >= 0.16f) { st.eyeT = -1; st.eyeBlink = 0; st.eyeNext = st.t + 2 + 5 * rnd(st); }
  }

  // keep float time precise over a whole season: fold the clock back while the craft is quiet
  const float WRAP = 4096.0f;
  if (st.t > WRAP && st.mode == IDLE && st.ev == EV_NONE && st.blinkT < 0 && st.eyeT < 0) {
    st.t -= WRAP; st.evNext -= WRAP; st.evEnd -= WRAP; st.blinkNext -= WRAP; st.eyeNext -= WRAP;
  }
}

// ---------- per-segment pixel functions
static void navOverlay(float a, const State& st, Col& o) {
  // aviation lights: red port, green starboard (steady); white double-flash anti-collision strobes fore and aft
  if (circ(a, 0.25f) < 0.013f) set(o, RED);
  else if (circ(a, 0.75f) < 0.013f) set(o, GREEN);
  // strobes only while the craft idles calm (no event for a second, turbine slow): on top of the comets, the comms cells or the
  // sputter's reboot they took a face over
  // 3 flashes/s (the turbine is still fast right after an abduction is cut short). Fore and aft flash
  // together: half a cycle apart, the rim as a whole saw two double flashes in one second.
  else if (st.mode == IDLE && st.ev == EV_NONE && st.t - st.evEnd > 1.0f && st.spin < 0.2f && (circ(a, 0.5f) < 0.009f || circ(a, 0) < 0.009f)) {
    float p = frac(st.t / 1.5f);
    if (p < 0.035f || (p > 0.1f && p < 0.135f)) set(o, WHITE);
  }
}
// the turbine on the rim: 4 comets with exponential tails
static void lineAPx(float a, const State& st, Col& o) {
  float t = st.t, sp = clamp01(st.spin / SPIN_MAX);
  set(o, TEAL_DEEP, 0.07f + 1.0f * sp);
  float tail = 0.05f + 0.16f * sp, ph = st.rimPh;
  Col head = lerpC(TEAL, HOT, sp);
  float b = 0;
  // comet k fades out once (k+1) comets would pass a point more than ~2 times a second: at full spin one
  // comet remains, so no part of the rim flashes faster than the road-facing limit (<= 3/s)
  for (int k = 0; k < 4; k++) {
    float wk = k == 0 ? 1 : clamp01(1 - ((k + 1) * st.spin - 2.0f) / 0.4f);
    if (wk <= 0) continue;
    float h = frac(ph + k / 4.0f), d = frac(h - a); if (d < 0.6f) b = fmaxf(b, wk * expf(-d / tail));
  }
  b = powf(b, 1.6f - 0.6f * sp);                                  // tight comet at idle, long trail at speed
  float shimmer = 0.96f + 0.08f * hash2(fl(a * 500), fl(t * FLICK));
  add(o, lerpC(TEAL, head, b * b), b * shimmer);

  if (st.mode == ABDUCTION) {
    float s = st.ts;
    if (s >= PH_CHARGE && s < PH_BEAM) add(o, CYAN, 0.3f * sstep(PH_CHARGE, PH_BEAM, s));
    if (s >= PH_BEAM && s < PH_FLASH) add(o, VIOLET, 0.3f);
    // lift: white patches swell and fade smoothly (was on/off sparkle per face; with the comet it went over 3/s)
    if (s >= PH_LIFT && s < PH_FLASH) add(o, WHITE, 0.7f * sstep(PH_LIFT, PH_LIFT + 0.4f, s) * sstep(0.45f, 0.85f, vnoise2(a * 8, t * 1.5f)));
    if (s >= PH_RELEASE) {
      float w = (s - PH_RELEASE) / 0.8f * 0.5f, d = circ(a, 0.5f);
      set(o, TEAL_DEEP, 0.5f);
      float e = expf(-sqr((d - w) / 0.03f)) * (1 - sstep(PH_RELEASE, PH_END, s) * 0.6f);
      add(o, lerpC(WHITE, CYAN, clamp01((s - PH_RELEASE) * 1.5f)), e);
    }
  }
  if (st.mode == IDLE && st.ev == EV_COMMS) {
    float env = sstep(0, 0.3f, st.evT) * (1 - sstep(4.2f, 4.6f, st.evT));
    int cell = fl(a * 72);
    // half the shared flicker clock: at 4 changes/s, on top of the comets, a face went over 3 flashes/s
    if (hash2(cell, fl(st.evT * FLICK * 0.5f)) > 0.6f) mixTo(o, cell % 3 == 0 ? PINK : YEL, 0.9f * env);
  }
  navOverlay(a, st, o);
}

// portholes: cabin life
static void idleWin(int w, int i, float kx, const State& st, Col& o) {
  float t = st.t;
  const Col& cabin = hash1(w + 300) > 0.45f ? WARM : COOL;
  float P = 7 + 9 * hash1(w + 40), u = t / P + hash1(w + 41); int cell = fl(u); float into = frac(u) * P;
  bool on = hash2(w, cell) > 0.3f, was = hash2(w, cell - 1) > 0.3f;
  float lv = on ? 0.42f + 0.16f * vnoise2(t * 2.7f, w * 3.1f) : 0.015f;
  if (on && !was && into < 0.45f) lv *= hash2(w, fl(t * FLICK)) > 0.45f ? 1 : 0.05f;   // fluorescent strike
  set(o, cabin, lv);
  add(o, cabin, 0.06f * lv * (hash2(i, fl(t * FLICK)) - 0.5f));
  // someone walks past
  float Q = 9 + 6 * hash1(w + 70), v = t / Q + hash1(w + 71); int pc = fl(v); float pin = frac(v) * Q;
  if (on && hash2(w + 7, pc) > 0.55f && pin > 2 && pin < 3.7f) {
    float cx = (-1.4f + 2.8f * ((pin - 2) / 1.7f)) * (hash2(w, pc) > 0.5f ? 1 : -1);
    if (fabsf(kx - cx) < 0.5f) mul(o, 0.1f);
  }
}
static void portsPx(int i, const State& st, Col& o) {
  int w = i >> 4, k = i & 15; float t = st.t, aw = winA(w);
  float th = (k / 16.0f) * 2 * (float)M_PI, kx = cosf(th);
  set(o, WHITE, 0);
  if (st.mode == IDLE || st.mode == COOLDOWN) {
    idleWin(w, i, kx, st, o);
    // comms: windows blend toward yellow / pink on half the flicker clock, fading in and out with the event (it set the
    // colour outright, so a window dropped to black as comms began and snapped back as it ended)
    if (st.mode == IDLE && st.ev == EV_COMMS && hash2(w, fl(st.evT * FLICK * 0.5f)) > 0.55f)
      mixTo(o, (w % 3) ? YEL : PINK, 0.8f * sstep(0, 0.3f, st.evT) * (1 - sstep(4.2f, 4.6f, st.evT)));
  } else if (st.mode == APPROACH) {
    // crew rushing to look: windows light in sequence from the person's side, shadows moving fast
    float d = circ(aw, st.personA), at = d * 3.4f;
    if (d < 0.32f && st.ts > at) {
      float e = st.ts - at;
      set(o, lerpC(COOL, WHITE, 0.35f), 0.85f * sstep(0, 0.25f, e));   // fades on (it flickered on; with the shadows a window went over 3/s)
      float cx = sinf(t * (2.5f + 2 * hash1(w)) + w) * 1.1f;   // 0.4-0.7 Hz: faster, a window dimmed over 3 times a second
      mul(o, 0.35f + 0.65f * sstep(0.35f, 0.55f, fabsf(kx - cx)));   // soft-edged, lighter shadow: a hard edge stepped one LED at a time
    } else { idleWin(w, i, kx, st, o); mul(o, 0.5f); }
  } else {
    float s = st.ts, sp = clamp01(st.spin / SPIN_MAX);
    if (s < PH_CHARGE) {                                          // lock-on: windows on the person's side lock on in sequence
      float d = circ(aw, st.personA), at = 0.15f + d * 2.6f;
      set(o, CYAN, 0.05f);
      if (d < 0.3f && s > at) { if (s < at + 0.08f) set(o, WHITE, 1); else set(o, lerpC(HOT, CYAN, d / 0.3f), 0.95f - d); }
    } else if (s < PH_BEAM) {                                     // charge: chase with the turbine
      // one sweep at 1.5 a second (not the turbine's 4 comets, which lit each window up to 8 times a second). A sharp
      // comet lit the 8 windows one after another, so the ring as one area pulsed 12 times a second. A cos^4 lobe has
      // no harmonic above the 4th, so over 8 evenly spaced windows the ring's total stays constant while the lobe turns.
      float b = powf(0.5f + 0.5f * cosf(2 * (float)M_PI * (frac(st.t * 1.5f) - aw)), 4);
      set(o, CYAN, 0.08f + 0.4f * sstep(PH_CHARGE, PH_BEAM, s));
      add(o, lerpC(CYAN, HOT, sp), b);
    } else if (s < PH_FLASH) {
      set(o, VIOLET, 0.4f + 0.25f * sinf(t * 9 + w * 0.8f));
      add(o, CYAN, 0.25f * expf(-frac(t * 1.6f - k / 16.0f) * 4));
      if (s >= PH_LIFT && hash2(w, fl(t * FLICK)) > 0.6f) set(o, WHITE);
    } else if (s >= PH_RELEASE) {                                 // windows reboot one by one
      float on = PH_RELEASE + 0.12f + w * 0.06f;
      if (s < on) set(o, WHITE, 0); else if (s < on + 0.09f) set(o, WHITE, 0.9f); else set(o, CYAN, 0.3f);
    }
  }
}

static void irisPx(int i, const State& st, Col& o) {
  int r = irisRing[i]; float t = st.t, rho = r / 8.0f, phi = irisPos[i] * 2 * (float)M_PI;
  float x = rho * cosf(phi), z = rho * sinf(phi);
  float lx = st.lookX * 0.34f, lz = st.lookZ * 0.34f;
  float d = hypotf(x - lx, z - lz), p = st.pupil;
  float sp = clamp01(st.spin / SPIN_MAX), ang = phi + 0.9f * rho + t * (0.25f + 0.8f * sp);
  float n = vnoise2(rho * cosf(ang) * 2.6f + 10, rho * sinf(ang) * 2.6f + t * 0.3f);
  set(o, lerpC(TEAL, VIOLET, n), 0.16f + 0.6f * n * n);
  add(o, PINK, 0.75f * expf(-sqr((d - p) / 0.06f)));               // limbal ring
  if (d < p) mul(o, 0.03f + 0.97f * sstep(p - 0.06f, p, d));         // pupil

  if (st.mode == ABDUCTION) {
    float s = st.ts;
    if (s >= PH_CHARGE && s < PH_BEAM) {                              // core goes white as the spokes fill
      float k = sstep(PH_CHARGE, PH_BEAM, s);
      add(o, HOT, k * expf(-d / (0.08f + 0.35f * k)) * 1.2f);
    } else if (s >= PH_BEAM && s < PH_FLASH) {
      set(o, lerpC(TEAL, VIOLET, n), 0.35f);
      add(o, HOT, expf(-rho / 0.5f) * (s >= PH_LIFT ? 0.6f + 0.4f * hash2(fl(t * FLICK), 9) : 1));
    } else if (s >= PH_RELEASE) {
      float w = (s - PH_RELEASE) / 0.45f;
      set(o, TEAL_DEEP, 0.4f);
      add(o, WHITE, expf(-sqr((rho - w) / 0.12f)));
    }
  }
  if (st.mode == IDLE && st.ev == EV_COMMS && hash2(r, fl(st.evT * FLICK)) > 0.55f) add(o, PINK, 0.5f);
  if (st.blink > 0 && rho > 1.02f - st.blink * 1.1f) mul(o, 0.02f);   // blink: rings close outside-in
  // anti-collision beacon, belly side: centre pixel pulses red when the eye is calm
  if (r == 0 && st.mode != ABDUCTION) { float b = expf(-frac(t * 0.9f) * 7); if (b > 0.05f) mixTo(o, RED, b); }
}

static void spokesPx(int i, const State& st, Col& o) {
  int s = i / SPOKE_N, j = i % SPOKE_N; float u = j / (float)(SPOKE_N - 1), t = st.t;
  float busy = st.mode == APPROACH ? 1 : 0;
  set(o, TEAL_DEEP, 0.6f);
  add(o, TEAL, (0.12f + 0.08f * busy) * (0.5f + 0.5f * sinf(2 * (float)M_PI * (u * 5 - t * (0.6f + 1.6f * busy)))));
  float P = (3.4f + 3 * hash1(s + 1)) / (1 + 2.5f * busy), hd = frac(t / P + hash1(s + 11)) * 1.4f - 0.2f;
  float dd = hd - u;
  add(o, CYAN, (0.7f + 0.3f * busy) * (dd >= 0 ? expf(-dd / 0.07f) : expf(dd / 0.012f)));
  mul(o, SPOKE_GAIN);

  if (st.mode == ABDUCTION) {
    float s2 = st.ts;
    if (s2 < PH_CHARGE) add(o, CYAN, 0.4f * (0.5f + 0.5f * sinf(2 * (float)M_PI * (u * 4 - t * 2.5f))));
    else if (s2 < PH_BEAM) {                                          // fill toward the core
      float L = sstep(PH_CHARGE, PH_BEAM - 0.3f, s2);
      if (u <= L) set(o, lerpC(TEAL, HOT, L), 0.35f + 0.65f * u);
      add(o, WHITE, expf(-sqr((u - L) / 0.03f)));
    } else if (s2 < PH_FLASH) {
      float ph = frac(u * 4 - t * 3.2f);
      set(o, VIOLET, 0.25f); add(o, lerpC(CYAN, WHITE, 0.6f), expf(-ph * 5));
      if (s2 >= PH_LIFT && hash2(fl(t * FLICK), s) < 0.3f) mul(o, 0.1f);
    } else if (s2 >= PH_RELEASE) {                                     // shockwave outward
      float w = 1 - (s2 - PH_RELEASE) / 0.5f;
      set(o, TEAL_DEEP, 0.3f);
      add(o, WHITE, expf(-sqr((u - w) / 0.06f)));
    }
  }
}

static void cockpitPx(const State& st, Col& o) {
  float t = st.t;
  set(o, ALIEN, st.mode == APPROACH ? 0.7f : 0.38f + 0.1f * sinf(t * 1.1f));
  if (st.mode == ABDUCTION) {
    float s = st.ts;
    if (s < PH_BEAM) set(o, ALIEN, 0.6f + 0.4f * sstep(0, PH_BEAM, s));
    else if (s < PH_FLASH) set(o, RED, 0.55f + 0.45f * (hash2(fl(t * FLICK), 3) > 0.4f ? 1 : 0));
    else set(o, ALIEN, 0.5f);
  }
}
static void eyesPx(const State& st, Col& o) {
  set(o, ALIEN, st.mode == APPROACH ? 1 : 0.32f);
  if (st.mode == ABDUCTION) {
    if (st.ts < PH_CHARGE) set(o, ALIEN, 1);
    else if (st.ts < PH_FLASH) set(o, RED, 0.6f + 0.4f * (fl(st.t * FLICK * 0.5f) % 2));   // once a second: with a lid blink on top it went over 3/s
  }
  if (!(st.mode == ABDUCTION && st.ts >= PH_CHARGE && st.ts < PH_FLASH)) mul(o, 1 - st.eyeBlink);   // no lid blink while blinking red
}

// One pixel, with the craft-wide overlays (cooldown fade, flash, power sputter). For S_LINEA, a is the
// perimeter fraction; for the others i is the logical index in its segment.
static void px(Seg seg, int i, float a, const State& st, Col& o) {
  switch (seg) {
    case S_LINEA: lineAPx(a, st, o); break;
    case S_COCKPIT: cockpitPx(st, o); break;
    case S_SPOKES: spokesPx(i, st, o); break;
    case S_IRIS: irisPx(i, st, o); break;
    case S_PORTS: portsPx(i, st, o); break;
    case S_EYES: eyesPx(st, o); break;
  }
  if (st.mode == COOLDOWN) mul(o, 0.3f + 0.7f * sstep(0, DUR_COOLDOWN, st.ts));
  if (st.mode == ABDUCTION && st.ts >= PH_FLASH && st.ts < PH_RELEASE) set(o, WHITE, st.ts < PH_BLACK ? 1 : 0);
  if (st.mode == IDLE && st.ev == EV_SPUTTER) {
    float e = st.evT;
    // windows go dark, and later come back, in 4 groups of opposite windows 0.4 s apart: the ring is one area
    // from the street, so it may change at most 3 times a second (it was 6 at 0.13 s steps)
    if (seg == S_PORTS && e < 2.6f && e > 0.25f + ((i >> 4) & 3) * 0.4f) mul(o, 0);
    else if (e < 2.6f) {
      int f = fl(e * FLICK); bool on = hash2(f, 3) > 0.45f;
      mul(o, on ? (0.15f + 0.6f * hash2(f, 7)) * (1 - (e / 2.6f) * 0.7f) : 0.02f);
    } else if (seg == S_LINEA) {
      int face = fl(a * 8); float tf = 2.8f + (face & 3) * 0.4f;   // 4 groups of opposite faces 0.4 s apart: the rim as one area <= 3/s
      if (e < tf) mul(o, 0); else if (e < tf + 0.18f) set(o, WHITE, 0.9f);
    } else if (seg == S_PORTS) { float tw = 3.0f + ((i >> 4) & 3) * 0.4f; if (e < tw) mul(o, 0); else if (e < tw + 0.1f) set(o, WHITE, 0.8f); }
    else if (seg == S_SPOKES) { if (e < 5.3f + (i / SPOKE_N) * 0.08f) mul(o, 0); }
    else if (seg == S_IRIS) { if (e < 5.6f + irisRing[i] * 0.08f) mul(o, 0); }
    else if (e < 6.0f) mul(o, 0);
    else if (seg == S_EYES) mul(o, fl(e * FLICK) % 3 == 0 ? 0 : 1);
  }
}

}  // namespace ufo

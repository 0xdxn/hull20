// UfoCmd.h: the gate in front of every command that arrives over the network (portal control, reviewed
// against conditions P1-P4; contract docs/MQTT.md).
// Pure C++, no Arduino: ufo-show/test/ compiles it on the host with mutants, and tools/flash-count.cpp drives
// the show through it.
//
//  - mqttAccept(): exact topic, length 1-8 checked before any copy, char[9] + NUL, printable ASCII only,
//    then a full match against the allowlist (ufoParse).
//  - Allowlist: i a b e1-e3 m0 m1 g0 g120..g900 c5..c60 s0 s1 ?. T, + and - stay on USB serial only;
//    nothing here reaches Wi-Fi, OTA or test mode.
//  - TokenBucket: about 5 commands/s sustained, burst 8; the excess is dropped.
//  - UfoGate: mode and event starts at most once every 2 s, and a/b/e* only from a calm idle (no event, turbine slow);
//    strips on/off at most once every 2 s; the cap latest-wins, applied at most every 334 ms.
//  - UfoControl: cap ramps and strips fade (0.5 s full scale), so no command steps the brightness.
// Together they keep any command stream under the road-facing 3 flashes/s line (ufo-show/FLASHES.md).
#ifndef UFO_CMD_H
#define UFO_CMD_H

#include <stdint.h>
#include <string.h>
#include "UfoShow.h"

#define UFO_CMD_TOPIC "fence/ufo/cmd"
#define UFO_CMD_MAX 8

namespace ufo {

static const int NET_CAP_MAX = 60;                 // percent; the network never sets the cap above this
static const uint32_t MODE_COOLDOWN_MS = 2000, STRIPS_COOLDOWN_MS = 2000, CAP_WINDOW_MS = 334;
static const float RAMP_PER_S = 1.2f;              // cap and strips move at most 1.2 per second (0.6 in 0.5 s)

enum UfoKind : uint8_t { UK_IDLE, UK_APPROACH, UK_ABDUCT, UK_EVENT, UK_AUTO, UK_GAP, UK_CAP, UK_STRIPS, UK_STATUS };
struct UfoCmd { UfoKind kind; int arg; };

static inline bool ufoDigit(char c) { return c >= '0' && c <= '9'; }

// decimal digits only, no sign, no leading zero (a lone "0" only if lo == 0), lo <= v <= hi
static inline bool ufoNum(const char* d, int lo, int hi, int& v) {
  if (d[0] == 0) return false;
  if (d[0] == '0' && d[1] != 0) return false;
  int n = 0; v = 0;
  for (const char* p = d; *p; p++) { if (!ufoDigit(*p) || ++n > 3) return false; v = v * 10 + (*p - '0'); }
  return v >= lo && v <= hi;
}

// the network allowlist; full match only
static inline bool ufoParse(const char* c, UfoCmd& o) {
  size_t n = strlen(c);
  if (n == 0 || n > UFO_CMD_MAX) return false;
  int v = 0;
  if (n == 1) {
    switch (c[0]) {
      case 'i': o = {UK_IDLE, 0}; return true;
      case 'a': o = {UK_APPROACH, 0}; return true;
      case 'b': o = {UK_ABDUCT, 0}; return true;
      case '?': o = {UK_STATUS, 0}; return true;
      default: return false;
    }
  }
  const char* d = c + 1;
  switch (c[0]) {
    case 'e': if (n == 2 && d[0] >= '1' && d[0] <= '3') { o = {UK_EVENT, d[0] - '0'}; return true; } return false;
    case 'm': if (n == 2 && (d[0] == '0' || d[0] == '1')) { o = {UK_AUTO, d[0] - '0'}; return true; } return false;
    case 's': if (n == 2 && (d[0] == '0' || d[0] == '1')) { o = {UK_STRIPS, d[0] - '0'}; return true; } return false;
    case 'g':
      if (n == 2 && d[0] == '0') { o = {UK_GAP, 0}; return true; }
      if (ufoNum(d, 120, 900, v)) { o = {UK_GAP, v}; return true; }
      return false;
    case 'c': if (ufoNum(d, 5, NET_CAP_MAX, v)) { o = {UK_CAP, v}; return true; } return false;
    default: return false;
  }
}
static inline bool ufoCmdAllowed(const char* c) { UfoCmd x; return ufoParse(c, x); }

// topic + payload from the MQTT client -> a NUL-terminated, allowlisted command in out[9]
static inline bool mqttAccept(const char* topic, const uint8_t* payload, unsigned len, char out[UFO_CMD_MAX + 1]) {
  if (topic == nullptr || strcmp(topic, UFO_CMD_TOPIC) != 0) return false;
  if (len == 0 || len > UFO_CMD_MAX) return false;      // before any copy
  for (unsigned i = 0; i < len; i++) {
    uint8_t ch = payload[i];
    if (ch < 0x20 || ch > 0x7e) return false;            // printable ASCII only (no NUL, no newline)
    out[i] = (char)ch;
  }
  out[len] = 0;
  return ufoCmdAllowed(out);
}

struct TokenBucket {                                      // ~5/s sustained, burst 8
  float tokens = 8, rate = 5, cap = 8;
  uint32_t last = 0;
  bool take(uint32_t nowMs) {
    float dt = (nowMs - last) / 1000.0f; last = nowMs;
    tokens += dt * rate; if (tokens > cap) tokens = cap;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  }
};

struct UfoGate {
  uint32_t lastMode = 0, lastStrips = 0, lastCap = 0;
  bool modeArmed = false, stripsArmed = false, capArmed = false;
  int pendingCap = -1;
  enum Verdict : uint8_t { APPLY, DEFER, REFUSE };
  // idleCalm: the show is idle with no event running
  Verdict offer(const UfoCmd& c, uint32_t nowMs, bool idleCalm) {
    switch (c.kind) {
      case UK_APPROACH: case UK_ABDUCT: case UK_EVENT:
        if (!idleCalm) return REFUSE;
        // fall through
      case UK_IDLE:
        if (modeArmed && nowMs - lastMode < MODE_COOLDOWN_MS) return REFUSE;
        lastMode = nowMs; modeArmed = true; return APPLY;
      case UK_STRIPS:
        if (stripsArmed && nowMs - lastStrips < STRIPS_COOLDOWN_MS) return REFUSE;
        lastStrips = nowMs; stripsArmed = true; return APPLY;
      case UK_CAP:
        pendingCap = c.arg; return DEFER;                 // latest wins; capDue() applies it
      default: return APPLY;
    }
  }
  bool capDue(uint32_t nowMs, int& pct) {
    if (pendingCap < 0 || (capArmed && nowMs - lastCap < CAP_WINDOW_MS)) return false;
    pct = pendingCap; pendingCap = -1; lastCap = nowMs; capArmed = true; return true;
  }
};

// What the network may change, with the ramps. The sketch owns the show state and auto timing; it reads
// capNow()/stripsNow() each frame and takes mode/event requests through `pending`.
struct UfoControl {
  TokenBucket bucket; UfoGate gate;
  bool autoOn = true; int gapFixed = 0;                   // 0 = random gap
  float cap = 0.42f, capTarget = 0.42f, strips = 1, stripsTarget = 1;
  uint32_t refused = 0, dropped = 0;
  bool wantStatus = false;

  static float netCap(int pct) { return (pct > NET_CAP_MAX ? NET_CAP_MAX : pct) / 100.0f; }
  void setCapSerial(float c) { cap = capTarget = c; }     // serial + / - step at once (USB only, not road-gated)

  // one MQTT message. Returns true if it changed something the sketch must act on now.
  bool net(const char* topic, const uint8_t* p, unsigned len, uint32_t nowMs, const State& st, Input& pending) {
    char c[UFO_CMD_MAX + 1];
    if (!mqttAccept(topic, p, len, c)) { refused++; return false; }
    if (!bucket.take(nowMs)) { dropped++; return false; }
    UfoCmd k; ufoParse(c, k);
    // a, b and e* only from a calm idle: no event running and the turbine slow (spin < 0.2, as for the idle events)
    bool calm = st.mode == IDLE && st.ev == EV_NONE && st.spin < 0.2f && !pending.hasMode && pending.event == EV_NONE;
    UfoGate::Verdict v = gate.offer(k, nowMs, calm);
    if (v == UfoGate::REFUSE) { dropped++; return false; }
    if (v == UfoGate::DEFER) return false;
    switch (k.kind) {
      case UK_IDLE: pending.hasMode = true; pending.mode = IDLE; pending.seq = false; break;
      case UK_APPROACH: pending.hasMode = true; pending.mode = APPROACH; pending.seq = true; break;
      case UK_ABDUCT: pending.hasMode = true; pending.mode = ABDUCTION; pending.seq = false; break;
      case UK_EVENT: pending.event = k.arg == 1 ? EV_COMMS : k.arg == 2 ? EV_SEARCH : EV_SPUTTER; break;
      case UK_AUTO: autoOn = k.arg == 1; break;
      case UK_GAP: gapFixed = k.arg; break;
      case UK_STRIPS: stripsTarget = k.arg ? 1.0f : 0.0f; break;
      case UK_STATUS: wantStatus = true; break;
      default: break;
    }
    return true;
  }

  // every frame: apply a due cap, move cap and strips toward their targets
  void tick(float dt, uint32_t nowMs) {
    int pct; if (gate.capDue(nowMs, pct)) capTarget = netCap(pct);
    float step = RAMP_PER_S * dt;
    cap += capTarget > cap ? fminf(step, capTarget - cap) : -fminf(step, cap - capTarget);
    strips += stripsTarget > strips ? fminf(step, stripsTarget - strips) : -fminf(step, strips - stripsTarget);
  }
  float capNow() const { return cap; }
  float stripsNow() const { return strips; }
};

}  // namespace ufo

#endif

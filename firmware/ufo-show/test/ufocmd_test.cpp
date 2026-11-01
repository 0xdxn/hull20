// Host tests for UfoCmd.h (run.sh builds this with ASan, then runs mutants that must make it fail).
#include <cstdio>
#include <cstring>
#include "../UfoCmd.h"
using namespace ufo;

static int fails = 0;
#define CHECK(c, msg) do { if (!(c)) { printf("FAIL %s:%d %s\n", __FILE__, __LINE__, msg); fails++; } } while (0)

static bool acc(const char* topic, const char* s, unsigned len) { char o[UFO_CMD_MAX + 1]; return mqttAccept(topic, (const uint8_t*)s, len, o); }
static bool acc(const char* s) { return acc(UFO_CMD_TOPIC, s, (unsigned)strlen(s)); }

int main() {
  // allowlist edges
  const char* ok[] = {"i", "a", "b", "?", "e1", "e2", "e3", "m0", "m1", "s0", "s1", "g0", "g120", "g121", "g600", "g900", "c5", "c6", "c42", "c60"};
  for (const char* s : ok) { char m[64]; snprintf(m, sizeof m, "accept %s", s); CHECK(acc(s), m); }
  const char* bad[] = {"T", "+", "-", "m", "s", "e", "g", "c", "e0", "e4", "a1", "b1", "i0", "s2", "m2", "g119", "g901", "g0120", "g01",
                       "g00", "g1000", "g-120", "g+120", "c4", "c61", "c100", "c05", "c0", "c-5", "c6x", " i", "i ", "?a", "ii", "W", "x",
                       "G120", "C60", "S1", "c60c60", "g12a"};
  for (const char* s : bad) { char m[64]; snprintf(m, sizeof m, "refuse %s", s); CHECK(!acc(s), m); }

  // framing: length before copy, NUL, newline, CR, topic
  CHECK(!acc(UFO_CMD_TOPIC, "", 0), "empty refused");
  CHECK(!acc(UFO_CMD_TOPIC, "i\n", 2), "trailing newline refused");
  CHECK(!acc(UFO_CMD_TOPIC, "i\r", 2), "trailing CR refused");
  CHECK(!acc(UFO_CMD_TOPIC, "i\0b", 3), "embedded NUL refused");
  CHECK(!acc(UFO_CMD_TOPIC, "\x01" "i", 2), "control byte refused");
  CHECK(!acc(UFO_CMD_TOPIC, "\xc3\xa9", 2), "non-ASCII refused");
  CHECK(!acc("fence/ufo/cmd/x", "i", 1), "longer topic refused");
  CHECK(!acc("fence/ufo/cm", "i", 1), "shorter topic refused");
  CHECK(!acc("fence/eyes/cmd", "i", 1), "other topic refused");
  CHECK(!acc(nullptr, "i", 1), "null topic refused");
  {  // 9 bytes: refused before any copy; the out buffer past index 8 must stay untouched
    char big[16]; memset(big, 'g', sizeof big);
    struct { char o[UFO_CMD_MAX + 1]; char guard[8]; } b; memset(&b, 0x55, sizeof b);
    CHECK(!mqttAccept(UFO_CMD_TOPIC, (const uint8_t*)big, 9, b.o), "9 bytes refused");
    bool clean = true; for (char g : b.guard) clean &= (g == 0x55); CHECK(clean, "no write past out[8]");
    bool untouched = true; for (char g : b.o) untouched &= (g == 0x55); CHECK(untouched, "nothing copied when too long");
    char eight[] = "c60"; CHECK(mqttAccept(UFO_CMD_TOPIC, (const uint8_t*)eight, 3, b.o) && b.o[3] == 0, "NUL written after copy");
  }

  // token bucket: burst 8, then ~5/s
  { TokenBucket tb; int n = 0; for (int t = 0; t < 1000; t += 10) n += tb.take(t); CHECK(n <= 13, "bucket <= 13 in 1 s"); CHECK(n >= 12, "bucket lets ~13 through in 1 s"); }

  // gate: mode starts at most 1 per 2 s, a/b/e only when idle and calm, strips 1 per 2 s, cap latest-wins every 334 ms
  {
    UfoGate g; UfoCmd i = {UK_IDLE, 0}, a = {UK_APPROACH, 0}, e = {UK_EVENT, 3}, s = {UK_STRIPS, 0};
    int applied = 0; for (int t = 0; t < 4000; t += 100) applied += g.offer(i, t, true) == UfoGate::APPLY;
    CHECK(applied == 2, "idle starts: 2 in 4 s");
    UfoGate g2; CHECK(g2.offer(a, 0, false) == UfoGate::REFUSE, "approach refused outside idle");
    CHECK(g2.offer(e, 0, false) == UfoGate::REFUSE, "event refused outside idle");
    CHECK(g2.offer(a, 0, true) == UfoGate::APPLY, "approach from idle");
    CHECK(g2.offer(e, 1000, true) == UfoGate::REFUSE, "event inside mode cooldown refused");
    CHECK(g2.offer(e, 2000, true) == UfoGate::APPLY, "event after cooldown");
    UfoGate g3; int sf = 0; for (int t = 0; t < 4000; t += 100) sf += g3.offer(s, t, true) == UfoGate::APPLY;
    CHECK(sf == 2, "strips flips: 2 in 4 s");
    UfoGate g4; int pct = 0, caps = 0;
    for (int t = 0; t < 1000; t += 50) { UfoCmd c = {UK_CAP, (t / 50) % 2 ? 60 : 5}; g4.offer(c, t, true); caps += g4.capDue(t, pct); }
    CHECK(caps <= 3, "cap applied <= 3 times in 1 s");
  }

  // control: cap never above 60 from the network, lowers a higher serial cap, ramps (no step)
  {
    State st; makeState(st, 1); Input pend{};
    UfoControl c; c.setCapSerial(0.80f);
    const char* c60 = "c60";
    c.net(UFO_CMD_TOPIC, (const uint8_t*)c60, 3, 0, st, pend);
    float maxStep = 0, prev = c.capNow();
    for (int f = 1; f <= 64; f++) { c.tick(1 / 64.0f, f * 16); maxStep = fmaxf(maxStep, fabsf(c.capNow() - prev)); prev = c.capNow(); }
    CHECK(fabsf(c.capNow() - 0.60f) < 1e-4f, "c60 lowers a serial 80 % cap to 60 %");
    CHECK(maxStep <= RAMP_PER_S / 64.0f + 1e-5f, "cap ramps, no step");
    UfoControl d; d.setCapSerial(0.20f);
    const char* cmds[] = {"c60", "c5", "c60", "c42", "c60"};
    float top = 0;
    for (int k = 0; k < 5; k++) { d.net(UFO_CMD_TOPIC, (const uint8_t*)cmds[k], (unsigned)strlen(cmds[k]), k * 400, st, pend); for (int f = 0; f < 26; f++) { d.tick(1 / 64.0f, k * 400 + f * 16); top = fmaxf(top, d.capNow()); } }
    for (int f = 0; f < 128; f++) { d.tick(1 / 64.0f, 2000 + f * 16); top = fmaxf(top, d.capNow()); }
    CHECK(top <= 0.60f + 1e-4f, "network never raises the cap above 60 %");
    CHECK(fabsf(UfoControl::netCap(100) - 0.60f) < 1e-6f, "netCap clamps to 60 %");
    // strips fade
    UfoControl s; const char* s0 = "s0"; s.net(UFO_CMD_TOPIC, (const uint8_t*)s0, 2, 0, st, pend);
    s.tick(1 / 64.0f, 16); CHECK(s.stripsNow() > 0.9f && s.stripsNow() < 1.0f, "strips fade, no step");
    // refused / dropped counters, mode request reaches pending
    UfoControl r; Input p2{}; const char* T = "T"; const char* ab = "b";
    r.net(UFO_CMD_TOPIC, (const uint8_t*)T, 1, 0, st, p2); CHECK(r.refused == 1 && !p2.hasMode, "T refused, nothing pending");
    r.net(UFO_CMD_TOPIC, (const uint8_t*)ab, 1, 10, st, p2); CHECK(p2.hasMode && p2.mode == ABDUCTION, "b from idle -> abduction pending");
    Input p3{}; r.net(UFO_CMD_TOPIC, (const uint8_t*)ab, 1, 3000, st, p3);
    State busy = st; busy.mode = ABDUCTION; Input p4{}; r.net(UFO_CMD_TOPIC, (const uint8_t*)ab, 1, 6000, busy, p4);
    CHECK(!p4.hasMode && r.dropped >= 1, "b during abduction dropped");
    // turbine still fast right after an abduction is cut short: a, b and e* wait for it to calm
    UfoControl q; State spun = st; spun.spin = 1.0f; Input p5{}; const char* e3 = "e3";
    q.net(UFO_CMD_TOPIC, (const uint8_t*)ab, 1, 0, spun, p5); q.net(UFO_CMD_TOPIC, (const uint8_t*)e3, 2, 2500, spun, p5);
    CHECK(!p5.hasMode && p5.event == EV_NONE && q.dropped == 2, "a/b/e refused while the turbine is fast");
  }

  if (fails) { printf("%d FAILED\n", fails); return 1; }
  printf("ufocmd: all passed\n");
  return 0;
}

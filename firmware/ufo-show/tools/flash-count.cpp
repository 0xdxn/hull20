// Flash-rate counter for the UFO show and its network command gate (see ../FLASHES.md).
//   c++ -std=c++17 -O2 -o flash-count firmware/ufo-show/tools/flash-count.cpp && ./flash-count [seed]
// Exit status 1 if any area goes over 3 flashes in any 1 s.
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <algorithm>
#include <functional>
#include "../UfoShow.h"
#include "../UfoCmd.h"
using namespace ufo;
// whole-segment luminance series; a flash = a pair of opposing swings each >= 10% of the run's peak
static int maxFlashesPerSec(const std::vector<float>& L, float fps) {
  float peak = *std::max_element(L.begin(), L.end()); if (peak <= 0) return 0;
  std::vector<int> swingAt; float ref = L[0]; int dir = 0;
  for (size_t i = 1; i < L.size(); i++) {
    float d = L[i] - ref;
    if (dir >= 0 && d <= -0.1f * peak) { swingAt.push_back(i); dir = -1; ref = L[i]; }
    else if (dir <= 0 && d >= 0.1f * peak) { swingAt.push_back(i); dir = 1; ref = L[i]; }
    else if ((dir > 0 && L[i] > ref) || (dir < 0 && L[i] < ref) || dir == 0) ref = (dir == 0 ? ref : L[i]);
  }
  int best = 0; size_t j = 0;
  for (size_t i = 0; i < swingAt.size(); i++) { while (swingAt[i] - swingAt[j] >= fps) j++; best = std::max(best, (int)(i - j + 1)); }
  return best / 2;
}
static inline float lum(const Col& o) { return o.r * 0.2126f + o.g * 0.7152f + o.b * 0.0722f; }
static inline float raw(const Col& o) { return std::max(0.f, o.r) + std::max(0.f, o.g) + std::max(0.f, o.b); }

int main(int argc, char** argv) {
  uint32_t seed = argc > 1 ? (uint32_t)strtoul(argv[1], nullptr, 10) : 25;   // the show's random seed (default 25)
  initIris(); State st; makeState(st, seed ? seed : 25); Col o; const float fps = 64, dt = 1 / fps;
  const char* names[] = {"rim", "cockpit", "spokes", "iris", "ports", "eyes"}; int cnt[] = {N_LINEA, N_COCKPIT, N_SPOKES, N_IRIS, N_PORTS, N_EYES};
  std::vector<float> L[6]; std::vector<float> PW[8], RF[8], SP[8]; int worst[6] = {0}, worstFace = 0, worstWin = 0, worstSpoke = 0;
  UfoControl ctl; uint32_t ms = 0;
  // cmd(f) returns the command to send on frame f (nullptr = none). With a command source the output is scaled as on
  // the board: cap and strips from UfoControl, then the 30 A limiter.
  auto run = [&](const char* title, int frames, Input first, std::function<const char*(int)> cmd) {
    for (auto& v : L) v.clear(); for (auto& v : PW) v.clear(); for (auto& v : RF) v.clear(); for (auto& v : SP) v.clear();
    for (int f = 0; f < frames; f++) {
      Input in = f == 0 ? first : Input{};
      if (cmd) { const char* c = cmd(f); if (c) ctl.net(UFO_CMD_TOPIC, (const uint8_t*)c, (unsigned)strlen(c), ms, st, in); }
      stepState(st, dt, in); ms += 1000 / 64 + (f % 4 == 0);   // 15.625 ms a frame
      float k = 1;
      if (cmd) {
        ctl.tick(dt, ms);
        float a = 0; for (int sg = 0; sg < 6; sg++) for (int i = 0; i < cnt[sg]; i++) { o = {0,0,0}; px((Seg)sg, i, i / (float)cnt[sg], st, o); a += raw(o); }
        float scale = ctl.capNow() * ctl.stripsNow(), amps = a / 255.0f * 0.020f * scale;
        k = amps > 30.0f ? scale * 30.0f / amps : scale;
      }
      for (int sg = 0; sg < 6; sg++) { float s = 0; for (int i = 0; i < cnt[sg]; i++) { o = {0,0,0}; px((Seg)sg, i, i / (float)cnt[sg], st, o); s += lum(o); } L[sg].push_back(s * k); }
      for (int w = 0; w < 8; w++) { float s = 0; for (int q = 0; q < 16; q++) { o = {0,0,0}; px(S_PORTS, w * 16 + q, 0, st, o); s += lum(o); } PW[w].push_back(s * k); }
      for (int g = 0; g < 8; g++) { float s = 0, s2 = 0; for (int q = 0; q < 55; q++) { int i = g * 55 + q; o = {0,0,0}; px(S_LINEA, i, i / 440.0f, st, o); s += lum(o); } for (int q = 0; q < SPOKE_N; q++) { o = {0,0,0}; px(S_SPOKES, g * SPOKE_N + q, 0, st, o); s2 += lum(o); } RF[g].push_back(s * k); SP[g].push_back(s2 * k); }
    }
    int wm = 0, fm = 0, sm = 0;
    for (int w = 0; w < 8; w++) wm = std::max(wm, maxFlashesPerSec(PW[w], fps));
    for (int g = 0; g < 8; g++) { fm = std::max(fm, maxFlashesPerSec(RF[g], fps)); sm = std::max(sm, maxFlashesPerSec(SP[g], fps)); }
    worstFace = std::max(worstFace, fm); worstWin = std::max(worstWin, wm); worstSpoke = std::max(worstSpoke, sm);
    printf("  %-22s window %d, rim face %d, spoke %d;  segment:", title, wm, fm, sm);
    for (int sg = 0; sg < 6; sg++) { int m = maxFlashesPerSec(L[sg], fps); printf(" %s %d", names[sg], m); worst[sg] = std::max(worst[sg], m); }
    printf("\n");
  };
  Input sp{}; sp.event = EV_SPUTTER; run("sputter", 7 * 64, sp, nullptr);
  Input cm{}; cm.event = EV_COMMS; run("comms", 5 * 64, cm, nullptr);
  Input ab{}; ab.hasMode = true; ab.mode = APPROACH; ab.seq = true; run("approach+abduction", 20 * 64, ab, nullptr);
  Input id{}; run("idle", 60 * 64, id, nullptr);

  // network command streams: every frame offers a command, far above the bucket's rate, 60 s each
  Input none{}; ctl.autoOn = false;
  auto alt = [](const char* x, const char* y) { return [x, y](int f) { return (f / 4) % 2 ? y : x; }; };   // switch every 4 frames
  run("net i/b", 60 * 64, none, alt("i", "b"));
  run("net i/a (end mid-beam)", 60 * 64, none, alt("i", "a"));
  run("net i/e3 (sputter)", 60 * 64, none, alt("i", "e3"));
  run("net s0/s1", 60 * 64, none, alt("s0", "s1"));
  run("net c5/c60", 60 * 64, none, alt("c5", "c60"));
  {
    const char* all[] = {"i", "a", "b", "e1", "e2", "e3", "m0", "m1", "s0", "s1", "g0", "g120", "c5", "c33", "c60", "?"};
    uint32_t r = 12345;
    run("net random", 120 * 64, none, [&](int) { r ^= r << 13; r ^= r >> 17; r ^= r << 5; return all[r % 16]; });
  }
  printf("worst: rim face %d, porthole %d, spoke %d;  segment:", worstFace, worstWin, worstSpoke);
  for (int sg = 0; sg < 6; sg++) printf(" %s %d", names[sg], worst[sg]);
  printf("   (max flashes in any 1 s; the porthole ring is the ports segment)\n");
  int over = std::max({worstFace, worstWin, worstSpoke, worst[0], worst[1], worst[2], worst[3], worst[4], worst[5]}) > 3;
  printf(over ? "OVER 3/s\n" : "all areas <= 3/s\n");
  return over;
}

/**
 * ufo-show: the UFO-25 light show on the UFO controller (Arduino Nano ESP32 + 74AHCT125).
 * The show is ufo-sim/src/show.js ported line for line (UfoShow.h), so the saucer looks like the sim.
 *
 * Data lines (wiring: docs/wiring/CONTROLLER-STACK.html and docs/wiring/STRIP-PLAN.html in this repo):
 *   1  D2 GPIO5  top rim, 440 RGB, clockwise from the aft flat's left corner
 *   2  D3 GPIO6  cockpit dome lip, 115 RGBW (4 bytes per LED)
 *   3  D4 GPIO7  spokes S1..S8 snaked (S1 outward, S2 inward, ...), 8 x 60 (a metre each), then the iris, 241, wired outer ring first
 *   4  D5 GPIO8  portholes P1..P8 (16 each), then the alien's 2 eye pixels
 *
 * Without the camera, AUTO plays the full approach + abduction every few minutes (random 2.5-4 min of idle);
 * between them the craft idles with its own events (comms, search, power sputter).
 *
 * Serial 115200, one key:
 *   i idle   a approach + abduction (as if someone came to the gate)   b abduction now
 *   1 comms  2 search  3 sputter (idle events)       m auto on/off
 *   + -  brightness cap (default 42 %)                T test: each line its wiring colour   ?  status
 * Supply limiter: the frame is scaled so the 5 V draw stays under 30 A (the sim's LIMIT_A), as in the sim.
 *
 * Network (v1.1, UFO_NET 1; reviewed against conditions U1-U6): Wi-Fi station and ArduinoOTA with a required
 * password hash, nothing else. No Wi-Fi = the plain standalone show. UFO_NET 0 builds the standalone v1 with no
 * radio code; it is the default when there is no Secrets.h, so a fresh clone builds the standalone show.
 *
 * Portal control (UFO_MQTT 1, needs UFO_NET; reviewed against conditions P1-P4): one outbound MQTT client to the
 * broker named in Secrets.h (UFO_MQTT_HOST), reading fence/ufo/cmd and writing fence/ufo/state (docs/MQTT.md). Every command goes
 * through UfoCmd.h (full-match allowlist, bucket, cooldowns, cap <= 60 %, ramps); T, + and - stay USB only. The show
 * runs the same without it. Tests: sh ufo-show/test/run.sh; flash rate: ufo-show/tools/flash-count.cpp.
 *
 * Build: arduino-cli compile --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber ufo-show
 *        (with the network on, build into a private directory: the .bin carries Secrets.h)
 */
#include <FastLED.h>
#include "UfoShow.h"
#include "UfoCmd.h"
#include "esp_system.h"
// Build id: the short git sha of the tree this image was built from, written into BuildId.h by the build step
// (git-ignored, never in the repo), so the serial lines say which image is running.
#if __has_include("BuildId.h")
#include "BuildId.h"
#endif
#ifndef UFO_BUILD
#define UFO_BUILD "dev"
#endif
using namespace ufo;

#ifndef UFO_NET
#if __has_include("Secrets.h")
#define UFO_NET 1                 // Secrets.h present: Wi-Fi + OTA (and MQTT if UFO_MQTT_HOST is set)
#else
#define UFO_NET 0                 // no Secrets.h: the standalone show, no radio code
#endif
#endif
// 0: OTA listens whenever Wi-Fi is up. N > 0: OTA listens only for the first N minutes after boot (update by
// power-cycling first), so the board isn't answering on the LAN while it runs the show.
#ifndef UFO_OTA_WINDOW_MIN
#define UFO_OTA_WINDOW_MIN 0
#endif

#define PIN_L1 5   // D2
#define PIN_L2 6   // D3
#define PIN_L3 7   // D4
#define PIN_L4 8   // D5

static const int N1 = N_LINEA, N2 = N_COCKPIT, N3 = N_SPOKES + N_IRIS, N4 = N_PORTS + N_EYES;
static const float RIM_A0 = -1.0f / 16;   // strip starts at the aft flat's left corner; a = 0 is the middle of the aft flat
static const float LIMIT_A = 30.0f;

static CRGB L1[N1], L2[N2], L3[N3], L4[N4];
static Col F1[N1], F2[N2], F3[N3], F4[N4];   // unscaled frame, for the limiter
static uint8_t irisLogical[N_IRIS];           // physical (outer ring first) -> logical (centre first)

static State st;
static Input pending = {};
static UfoControl ctl;                        // network gate + brightness cap, auto on/off, gap, strips (UfoCmd.h)
static bool testMode = false;
static float autoT = 0, autoGap = 180;
static uint32_t lastUs = 0, frames = 0, frameUsSum = 0;
static float lastAmps = 0;
static volatile bool otaActive = false;      // an update owns the board until it reboots (or fails)

// ---------------------------------------------------------------- network: Wi-Fi station + ArduinoOTA only
#if UFO_NET
#include <WiFi.h>
#include <ArduinoOTA.h>
#include "esp_ota_ops.h"
#if !__has_include("Secrets.h")
#error "ufo-show/Secrets.h is missing (copy Secrets.example.h; it is git-ignored). Or build with -DUFO_NET=0."
#endif
#include "Secrets.h"
#ifndef UFO_OTA_PASSWORD_MD5
#error "UFO_OTA_PASSWORD_MD5 missing: OTA must have a password"
#endif
#if !defined(UFO_WIFI_SSID) || !defined(UFO_WIFI_PASSWORD)
#error "UFO_WIFI_SSID / UFO_WIFI_PASSWORD missing in Secrets.h"
#endif
constexpr bool hex32(const char* s, int i = 0) {
  return i == 32 ? s[32] == 0 : (((s[i] >= '0' && s[i] <= '9') || (s[i] >= 'a' && s[i] <= 'f')) && hex32(s, i + 1));
}
static_assert(hex32(UFO_OTA_PASSWORD_MD5), "UFO_OTA_PASSWORD_MD5 must be 32 lowercase hex characters");
static bool hex32rt(const char* s) {        // the same check at run time, before ArduinoOTA.begin (fails closed)
  for (int i = 0; i < 32; i++) { char c = s[i]; if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false; }
  return s[32] == 0;
}

#define UFO_HOST     "ufo-25"
#define UFO_OTA_PORT 3232
#ifndef UFO_VERIFY_S
#define UFO_VERIFY_S 600          // a new image has 10 min to bring Wi-Fi + OTA up, or it rolls back
#endif
#ifndef UFO_NEVER_VALID
#define UFO_NEVER_VALID 0         // 1 only for the bench proof of the rollback path: never marks itself valid
#endif
static const uint32_t VERIFY_MS = (uint32_t)UFO_VERIFY_S * 1000UL;

static bool otaStarted = false, otaClosed = false, wasUp = false, imagePending = false;
static uint32_t wifiTryAt = 0;

// U6: hold the core's automatic "mark valid" so this sketch marks a new image valid only once Wi-Fi and OTA
// are up. An image that can't get back on the network, or crashes before that, goes back to the previous one.
// extern "C": the core's weak hook is a C symbol; a C++ definition would get a mangled name and not replace it
// (found on the bench 2026-10-25: images were marked valid at boot).
extern "C" bool verifyRollbackLater() { return true; }

static void imageCheck() {
  const esp_partition_t* run = esp_ota_get_running_partition();
  esp_ota_img_states_t s;
  imagePending = run && esp_ota_get_state_partition(run, &s) == ESP_OK && (s == ESP_OTA_IMG_PENDING_VERIFY || s == ESP_OTA_IMG_NEW);
  Serial.printf("image: %s, %s\n", run ? run->label : "?", imagePending ? "new, on trial until Wi-Fi + OTA are up" : "valid");
}
static void imageValid() {
  if (!imagePending) return;
  if (UFO_NEVER_VALID) { Serial.println("image: ROLLBACK PROOF build, not marking valid"); return; }
  esp_ota_mark_app_valid_cancel_rollback();
  imagePending = false;
  Serial.println("image: marked valid (Wi-Fi + OTA up)");
}

static void netBegin() {
  WiFi.mode(WIFI_STA);                       // station only: no soft AP, no provisioning portal (U3)
  WiFi.setSleep(false);                      // v1.2: no modem power save; with it, yard OTA timed out mid-upload
  WiFi.setHostname(UFO_HOST);
  WiFi.setAutoReconnect(true);
  WiFi.begin(UFO_WIFI_SSID, UFO_WIFI_PASSWORD);   // non-blocking: the show runs while it connects
  wifiTryAt = millis();
  Serial.printf("net: wifi station only; listener: OTA %u once online, otaAuth %s; window %s; no HTTP server\n",
                UFO_OTA_PORT, hex32rt(UFO_OTA_PASSWORD_MD5) ? "on" : "off (refused to start)",
                UFO_OTA_WINDOW_MIN ? String(String(UFO_OTA_WINDOW_MIN) + " min after boot").c_str() : "always");
}

static void otaBegin() {
  if (!hex32rt(UFO_OTA_PASSWORD_MD5)) { Serial.println("ota: OFF (no valid password hash)"); otaClosed = true; return; }   // U2: fails closed
  ArduinoOTA.setHostname(UFO_HOST);
  ArduinoOTA.setPort(UFO_OTA_PORT);
  ArduinoOTA.setPasswordHash(UFO_OTA_PASSWORD_MD5);
  ArduinoOTA.setRebootOnSuccess(true);
  ArduinoOTA.onStart([]() {                  // U5: one steady state (all off) before any flash write
    otaActive = true;
    FastLED.clear(true);
    Serial.println("ota: update starting, strips off");
  });
  ArduinoOTA.onEnd([]() { Serial.println("ota: done, rebooting"); });
  ArduinoOTA.onError([](ota_error_t e) { otaActive = false; Serial.printf("ota: error %u (%s), show resumes\n", (unsigned)e, e == OTA_AUTH_ERROR ? "auth refused" : "transfer failed"); });
  ArduinoOTA.begin();                        // its mDNS record is the arduino OTA service only (U3)
  otaStarted = true;
  Serial.printf("ota: listening on %u, otaAuth on\n", UFO_OTA_PORT);
  imageValid();
}

// ---------------------------------------------------------------- MQTT: portal control (reviewed against P1-P4;
// contract docs/MQTT.md). One outbound client, user from Secrets.h, subscribed to fence/ufo/cmd only; every message goes through UfoCmd.h (allowlist, bucket, cooldowns).
// Not required for anything else: the show, auto abductions, OTA and the U6 image check run without it.
#ifndef UFO_MQTT
#ifdef UFO_MQTT_HOST
#define UFO_MQTT 1                // a broker is named in Secrets.h
#else
#define UFO_MQTT 0
#endif
#endif
#if UFO_MQTT
#include <PubSubClient.h>
#if !defined(UFO_MQTT_HOST) || !defined(UFO_MQTT_USER) || !defined(UFO_MQTT_PASSWORD)
#error "UFO_MQTT_HOST / UFO_MQTT_USER / UFO_MQTT_PASSWORD missing in Secrets.h (or build with -DUFO_MQTT=0)"
#endif
#ifndef UFO_MQTT_PORT
#define UFO_MQTT_PORT 1883        // P3 bench proof builds with a dead port to show the board under broker trouble
#endif
static WiFiClient mqttNet;
static PubSubClient mqtt(mqttNet);
static uint32_t mqttTryAt = 0, mqttBackoff = 2500, mqttStateAt = 0, mqttConnectMsMax = 0;
static bool mqttEver = false;

static void onMqtt(char* topic, uint8_t* payload, unsigned int len) {
  ctl.net(topic, payload, len, millis(), st, pending);   // refused / dropped are counted inside
}

static const char* modeName(Mode m) { return m == IDLE ? "idle" : m == APPROACH ? "approach" : m == ABDUCTION ? "abduction" : "cooldown"; }
static const char* evName(Ev e) { return e == EV_COMMS ? "comms" : e == EV_SEARCH ? "search" : e == EV_SPUTTER ? "sputter" : "none"; }

static void mqttState() {
  int rssi = WiFi.RSSI(); if (rssi < -100) rssi = -100; if (rssi > 0) rssi = 0;
  int capPct = (int)lroundf(ctl.capNow() * 100); if (capPct < 5) capPct = 5; if (capPct > 100) capPct = 100;
  int next = ctl.autoOn ? (int)fmaxf(0, autoGap - autoT) : 0; if (next > 900) next = 900;
  float amps = fminf(30.0f, fmaxf(0, lastAmps));
  char buf[320];
  int n = snprintf(buf, sizeof buf,
    "{\"build\":\"%s\",\"mode\":\"%s\",\"event\":\"%s\",\"auto\":%s,\"next_s\":%d,\"gap_s\":%d,\"cap\":%d,\"strips\":%s,"
    "\"amps\":%.1f,\"rssi\":%d,\"img\":\"%s\",\"refused\":%lu,\"dropped\":%lu}",
    UFO_BUILD, modeName(st.mode), evName(st.ev), ctl.autoOn ? "true" : "false", next, ctl.gapFixed, capPct,
    ctl.stripsTarget > 0.5f ? "true" : "false", amps, rssi, imagePending ? "trial" : "valid",
    (unsigned long)ctl.refused, (unsigned long)ctl.dropped);
  if (n > 0 && n < (int)sizeof buf) mqtt.publish("fence/ufo/state", buf, false);   // retain off
  mqttStateAt = millis();
}

static void mqttBegin() {
  mqttNet.setConnectionTimeout(1500);        // P3: a dead broker can't hold the frame for long (TCP connect)
  mqtt.setServer(UFO_MQTT_HOST, UFO_MQTT_PORT);   // host name or dotted IP, from Secrets.h
  mqtt.setSocketTimeout(2);                  // P3: CONNACK / reads wait at most 2 s (library default 15 s)
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMqtt);
}

static void mqttLoop(uint32_t now) {
  if (!mqtt.connected()) {
    if (now - mqttTryAt < mqttBackoff) return;
    mqttTryAt = now;
    uint32_t t0 = millis();
    bool ok = mqtt.connect(UFO_HOST, UFO_MQTT_USER, UFO_MQTT_PASSWORD);
    uint32_t took = millis() - t0; if (took > mqttConnectMsMax) mqttConnectMsMax = took;
    if (ok && mqtt.subscribe("fence/ufo/cmd", 0)) {
      mqttBackoff = 5000; mqttEver = true;
      Serial.printf("mqtt: up, subscribed (connect %lu ms)\n", (unsigned long)took);
      mqttState();
    } else {
      if (ok) mqtt.disconnect();
      mqttBackoff = mqttBackoff >= 30000 ? 60000 : mqttBackoff * 2;   // 5 -> 10 -> 20 -> 40 -> 60 s
      Serial.printf("mqtt: connect failed, state %d, took %lu ms, next try in %lu s\n", mqtt.state(), (unsigned long)took, (unsigned long)(mqttBackoff / 1000));
    }
    return;
  }
  mqtt.loop();
  if (ctl.wantStatus || now - mqttStateAt > 15000) { ctl.wantStatus = false; mqttState(); }
}
static String mqttStatus() {
  return String("  mqtt ") + (mqtt.connected() ? "up" : mqttEver ? "down" : "never") + " r" + String((unsigned long)ctl.refused) +
         " d" + String((unsigned long)ctl.dropped) + " cmax " + String((unsigned long)mqttConnectMsMax) + "ms";
}
#else
static void mqttBegin() {}
static void mqttLoop(uint32_t) {}
static String mqttStatus() { return "  mqtt off"; }
#endif

static void netLoop() {
  uint32_t now = millis();
  if (UFO_OTA_WINDOW_MIN && otaStarted && !otaClosed && !otaActive && now > (uint32_t)UFO_OTA_WINDOW_MIN * 60000UL) {
    ArduinoOTA.end(); otaStarted = false; otaClosed = true;
    Serial.println("ota: window over, listener closed until the next power-up");
  }
  if (imagePending && now > VERIFY_MS && !otaActive) {
    Serial.println("image: not marked valid in time (Wi-Fi + OTA never came up); rolling back to the previous one");
    delay(50);
    esp_ota_mark_app_invalid_rollback_and_reboot();
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (wasUp) { wasUp = false; Serial.println("wifi: down, show carries on"); }
    if (now - wifiTryAt > 15000) { WiFi.disconnect(); WiFi.begin(UFO_WIFI_SSID, UFO_WIFI_PASSWORD); wifiTryAt = now; }
    return;
  }
  if (!wasUp) { wasUp = true; Serial.printf("wifi: up, %s  mac %s  rssi %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str(), (int)WiFi.RSSI()); }
  if (!otaStarted && !otaClosed) otaBegin();
  if (otaStarted) ArduinoOTA.handle();
  if (!otaActive) mqttLoop(now);
}
static String netStatus() {
  const esp_partition_t* run = esp_ota_get_running_partition();
  esp_ota_img_states_t s = ESP_OTA_IMG_UNDEFINED;
  if (run) esp_ota_get_state_partition(run, &s);
  return String("img ") + (run ? run->label : "?") + "/" + String((int)s) + "  wifi " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() + " rssi " + String((int)WiFi.RSSI()) : String("down")) +
         "  ota " + (otaStarted ? "auth on" : otaClosed ? "closed" : "off") + (imagePending ? "  image on trial" : "") + mqttStatus();
}
#else
static String netStatus() { return "no network (UFO_NET 0)"; }
#endif

static void buildIrisMap() {
  // the disc runs outer ring first; each ring keeps its direction (bench, 2026-10-10, iris-test phys())
  int phys = 0;
  for (int r = 8; r >= 0; r--) {
    int start = 0; for (int q = 0; q < r; q++) start += IRIS_RINGS[q];
    for (int k = 0; k < IRIS_RINGS[r]; k++) irisLogical[phys++] = start + k;
  }
}

static void status() {
  Serial.printf("ufo-show v1.2 " UFO_BUILD ": %s  ts %.1f  auto %s (next in %.0f s)  cap %d%%  %.1f A  %.1f ms/frame  passengers %d  rst %d  %s\n",
                testMode ? "TEST" : phaseName(st), st.ts, ctl.autoOn ? "on" : "off", ctl.autoOn ? fmaxf(0, autoGap - autoT) : 0,
                (int)lroundf(ctl.capNow() * 100), lastAmps, frames ? frameUsSum / 1000.0f / frames : 0, st.passengers, (int)esp_reset_reason(), netStatus().c_str());
}

static void newGap() { autoGap = ctl.gapFixed ? ctl.gapFixed : 150 + 90 * (esp_random() / 4294967296.0f); autoT = 0; }

static void handleSerial() {
  while (Serial.available()) {
    char k = Serial.read();
    switch (k) {
      case 'i': pending.hasMode = true; pending.mode = IDLE; pending.seq = false; testMode = false; break;
      case 'a': pending.hasMode = true; pending.mode = APPROACH; pending.seq = true; testMode = false; break;
      case 'b': pending.hasMode = true; pending.mode = ABDUCTION; pending.seq = false; testMode = false; break;
      case '1': pending.event = EV_COMMS; testMode = false; break;
      case '2': pending.event = EV_SEARCH; testMode = false; break;
      case '3': pending.event = EV_SPUTTER; testMode = false; break;
      case 'm': ctl.autoOn = !ctl.autoOn; newGap(); break;
      case '+': ctl.setCapSerial(fminf(1.0f, ctl.capTarget + 0.05f)); break;   // USB only: up to 100 %
      case '-': ctl.setCapSerial(fmaxf(0.05f, ctl.capTarget - 0.05f)); break;
      case 'T': testMode = !testMode; break;
      case '?': break;
      default: continue;
    }
    status();
  }
}

static void renderShow() {
  Col o;
  for (int p = 0; p < N1; p++) { float a = frac((p + 0.5f) / N1 + RIM_A0); o = {0, 0, 0}; px(S_LINEA, 0, a, st, o); F1[p] = o; }
  for (int p = 0; p < N2; p++) { o = {0, 0, 0}; px(S_COCKPIT, p, 0, st, o); F2[p] = o; }
  for (int p = 0; p < N_SPOKES; p++) {
    int s = p / SPOKE_N, q = p % SPOKE_N, j = (s % 2 == 0) ? SPOKE_N - 1 - q : q;   // S1, S3.. run outward (centre first)
    o = {0, 0, 0}; px(S_SPOKES, s * SPOKE_N + j, 0, st, o); F3[p] = o;
  }
  for (int p = 0; p < N_IRIS; p++) { o = {0, 0, 0}; px(S_IRIS, irisLogical[p], 0, st, o); F3[N_SPOKES + p] = o; }
  for (int p = 0; p < N_PORTS; p++) { o = {0, 0, 0}; px(S_PORTS, p, 0, st, o); F4[p] = o; }
  for (int p = 0; p < N_EYES; p++) { o = {0, 0, 0}; px(S_EYES, p, 0, st, o); F4[N_PORTS + p] = o; }
}

static void renderTest() {
  const Col C[4] = { {0x2f, 0xbf, 0x55}, {0x3b, 0x82, 0xf6}, {0xb1, 0x5c, 0xff}, {0x14, 0xb8, 0xc4} };
  for (int p = 0; p < N1; p++) F1[p] = C[0];
  for (int p = 0; p < N2; p++) F2[p] = C[1];
  for (int p = 0; p < N3; p++) F3[p] = C[2];
  for (int p = 0; p < N4; p++) F4[p] = C[3];
}

static float sumAmps(const Col* f, int n) { float s = 0; for (int k = 0; k < n; k++) s += fmaxf(0, f[k].r) + fmaxf(0, f[k].g) + fmaxf(0, f[k].b); return s / 255.0f * 0.020f; }
static inline uint8_t ch(float v, float k) { v *= k; return v <= 0 ? 0 : v >= 255 ? 255 : (uint8_t)(v + 0.5f); }
static void out(CRGB* L, const Col* F, int n, float k) { for (int p = 0; p < n; p++) L[p] = CRGB(ch(F[p].r, k), ch(F[p].g, k), ch(F[p].b, k)); }

void setup() {
  Serial.begin(115200);
  initIris(); buildIrisMap();
  makeState(st, esp_random() | 1);    // a different evening every power-up
  newGap();
  FastLED.addLeds<WS2812B, PIN_L1, GRB>(L1, N1);
  FastLED.addLeds<WS2812, PIN_L2, GRB>(L2, N2).setRgbw(Rgbw(kRGBWDefaultColorTemp, kRGBWExactColors));
  FastLED.addLeds<WS2812B, PIN_L3, GRB>(L3, N3);
  FastLED.addLeds<WS2812B, PIN_L4, GRB>(L4, N4);
  FastLED.setBrightness(255);          // brightness is the cap + limiter below, as in the sim
  FastLED.clear(true);
  delay(200);
  // why the last boot happened (esp_reset_reason_t: 1 power-on, 3 software, 4 panic, 5-7 watchdogs, 9 brownout);
  // added 2026-10-27 because the board restarts partway through a yard OTA
  Serial.printf("reset reason %d\n", (int)esp_reset_reason());
  Serial.println("ufo-show v1.2 " UFO_BUILD ": i idle  a approach+abduction  b abduction  1 comms 2 search 3 sputter  m auto  + - cap  T test  ? status");
#if UFO_NET
  imageCheck();
  netBegin();
  mqttBegin();
#endif
  lastUs = micros();
}

void loop() {
#if UFO_NET
  netLoop();
#endif
  if (otaActive) { delay(2); return; }   // U5: strips held off; the update owns the board until it reboots
  handleSerial();
  uint32_t now = micros();
  float dt = fminf(0.05f, (now - lastUs) / 1e6f); lastUs = now;

  // network settings that the auto timer follows
  static bool lastAuto = true; static int lastGap = 0;
  if (ctl.autoOn != lastAuto || ctl.gapFixed != lastGap) { lastAuto = ctl.autoOn; lastGap = ctl.gapFixed; newGap(); }
  if (ctl.autoOn && !pending.hasMode && pending.event == EV_NONE) {
    if (st.mode == IDLE && st.ev == EV_NONE) { autoT += dt; if (autoT > autoGap) { pending.hasMode = true; pending.mode = APPROACH; pending.seq = true; newGap(); } }
  }
  Mode before = st.mode;
  stepState(st, dt, pending);
  pending = {};
  if (st.mode != before) { status(); ctl.wantStatus = true; }
  ctl.tick(dt, millis());                    // cap ramp, strips fade, the cap's 334 ms window

  if (testMode) renderTest(); else renderShow();

  float scale = ctl.capNow() * ctl.stripsNow();
  float raw = (sumAmps(F1, N1) + sumAmps(F2, N2) + sumAmps(F3, N3) + sumAmps(F4, N4)) * scale;
  float k = (raw > LIMIT_A ? scale * LIMIT_A / raw : scale);
  lastAmps = fminf(raw, LIMIT_A);
  out(L1, F1, N1, k); out(L2, F2, N2, k); out(L3, F3, N3, k); out(L4, F4, N4, k);
  FastLED.show();

  frames++; frameUsSum += micros() - now;
  if (frames >= 400) { frames = 0; frameUsSum = 0; }
}

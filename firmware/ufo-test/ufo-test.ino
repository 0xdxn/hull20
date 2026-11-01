/**
 * ufo-test: bench check for the UFO controller (Arduino Nano ESP32 + 74AHCT125, wiring page
 * docs/wiring/CONTROLLER-STACK.html in this repo). No network.
 *
 * Drives the four data lines at once, each in the colour the wiring page draws it in:
 *   line 1 rim        Nano D2 (GPIO5)  green   WS2812B
 *   line 2 cockpit    Nano D3 (GPIO6)  blue    SK6812 RGBW
 *   line 3 spokes     Nano D4 (GPIO7)  purple  WS2812B
 *   line 4 portholes  Nano D5 (GPIO8)  cyan    WS2812B
 * so a test strip on any cable shows which line it is on.
 *
 * Serial 115200, one key:
 *   c  chase   one pixel walks each line at 20 px/s (boot default)
 *   s  solid   every line lit in its own colour
 *   w  white   every pixel dim white
 *   1-4        only that line, solid; the others off
 *   0  off     + / -  brightness     ?  status
 * Power: the strips take 5 V from the power box or bench supply, not from the Nano; FastLED still
 * caps the total at 1.5 A. MAX_LEDS slots per line; extra slots past a strip's end go nowhere.
 *
 * Build: arduino-cli compile --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber ufo-test
 *   (GPIO numbering, so the pin numbers below are the chip's own.)
 */
#include <FastLED.h>

#ifndef MAX_LEDS
#define MAX_LEDS 300
#endif
#define PIN_L1 5   // D2
#define PIN_L2 6   // D3
#define PIN_L3 7   // D4
#define PIN_L4 8   // D5

static CRGB line[4][MAX_LEDS];
static const CRGB COL[4] = { CRGB(0x2f, 0xbf, 0x55), CRGB(0x3b, 0x82, 0xf6), CRGB(0xb1, 0x5c, 0xff), CRGB(0x14, 0xb8, 0xc4) };
static const char *NAME[4] = { "1 rim (D2)", "2 cockpit (D3, RGBW)", "3 spokes (D4)", "4 portholes (D5)" };
static char mode = 'c';
static uint8_t bright = 40;
static uint16_t pos = 0;
static uint32_t stepAt = 0;

static void status() {
  Serial.printf("ufo-test: mode %c  brightness %u  chase at %u  (%d slots per line, 1.5 A cap)\n", mode, bright, pos, MAX_LEDS);
  for (int i = 0; i < 4; i++) Serial.printf("  line %s\n", NAME[i]);
}

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<WS2812B, PIN_L1, GRB>(line[0], MAX_LEDS);
  FastLED.addLeds<WS2812, PIN_L2, GRB>(line[1], MAX_LEDS).setRgbw(Rgbw(kRGBWDefaultColorTemp, kRGBWExactColors));
  FastLED.addLeds<WS2812B, PIN_L3, GRB>(line[2], MAX_LEDS);
  FastLED.addLeds<WS2812B, PIN_L4, GRB>(line[3], MAX_LEDS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 1500);
  FastLED.setBrightness(bright);
  FastLED.clear(true);
  delay(300);
  Serial.println("ufo-test: c chase  s solid  w white  1-4 one line  0 off  + - brightness  ? status");
  status();
}

void loop() {
  while (Serial.available()) {
    const char k = Serial.read();
    if (k == 'c' || k == 's' || k == 'w' || k == '0' || (k >= '1' && k <= '4')) { mode = k; pos = 0; FastLED.clear(); status(); }
    else if (k == '+') { bright = min(255, bright + 20); FastLED.setBrightness(bright); status(); }
    else if (k == '-') { bright = max(5, bright - 20); FastLED.setBrightness(bright); status(); }
    else if (k == '?') status();
  }
  const uint32_t now = millis();
  switch (mode) {
    case 'c':
      if (now - stepAt >= 50) {
        stepAt = now;
        for (int i = 0; i < 4; i++) { fill_solid(line[i], MAX_LEDS, CRGB::Black); line[i][pos] = COL[i]; }
        if (pos % 10 == 0) Serial.printf("chase %u\n", pos);
        pos = (pos + 1) % MAX_LEDS;
      }
      break;
    case 's': for (int i = 0; i < 4; i++) fill_solid(line[i], MAX_LEDS, COL[i]); break;
    case 'w': for (int i = 0; i < 4; i++) fill_solid(line[i], MAX_LEDS, CRGB(40, 40, 40)); break;
    case '1': case '2': case '3': case '4': {
      const int n = mode - '1';
      for (int i = 0; i < 4; i++) fill_solid(line[i], MAX_LEDS, i == n ? COL[i] : CRGB::Black);
      break;
    }
    default: FastLED.clear(); break;
  }
  FastLED.show();
}

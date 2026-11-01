# Data lines

Four WS2812B data lines from the Nano ESP32, each through one gate of a 74AHCT125 and a 330 Ω series resistor.
1,406 LEDs in all: 440 + 115 + 480 + 241 + 128 + 2.

| Line | Nano pin | GPIO | Runs | LEDs | Bytes/LED | Wire time per frame |
|---|---|---|---|---|---|---|
| 1 | D2 | 5 | Rim: one strip through all eight channels, clockwise from the aft flat's left corner, 55 per face | 440 RGB | 3 | 13.2 ms |
| 2 | D3 | 6 | Dome lip, warm white | 115 RGBW | 4 | 4.6 ms |
| 3 | D4 | 7 | Eight spokes (8 x 60), snaked out and back, then the 241-LED belly disc (nine rings, outer ring first) | 480 + 241 = 721 RGB | 3 | 21.6 ms |
| 4 | D5 | 8 | Eight 16-LED porthole rings, then the pilot's two eyes | 128 + 2 = 130 RGB | 3 | 3.9 ms |

Wire time: a WS2812B bit is 1.25 µs, so 24 bits is 30 µs per RGB LED (40 µs for RGBW), plus a latch of at least
50 µs (280 µs on newer parts). Line 3 is the long one. Putting the belly disc at the end of the spokes saved a
cable to the centre and cost nothing that shows. FastLED on the ESP32 drives the four lines through the RMT
peripheral; the show renders every frame in full and the limiter scales it before output.

Spoke order on line 3: S1 runs outward from the hub, S2 comes back in, a short wire crosses the hub to S3, and so on;
S8 ends at the centre and feeds the disc. The firmware un-snakes it (`renderShow()` in `ufo-show.ino`), and maps the
disc's physical order (outer ring first) to the show's logical order (centre first) in `buildIrisMap()`.

Belly disc rings, centre out: 1, 8, 12, 16, 24, 32, 40, 48, 60 (241).

## Why a level shifter

The ESP32 drives 3.3 V logic. A WS2812B powered at 5 V wants 0.7 x VDD = 3.5 V for a guaranteed high. It often
reads 3.3 V anyway; often is not good enough on a ladder. The 74AHCT125 has TTL input thresholds, so 3.3 V is a
solid high, and its outputs swing the full 5 V. Tie the unused gates' inputs to ground and every `OE` low.

The 330 Ω resistors at the controller end take the ringing off the edges on the way down the cables. Each data cable
carries DATA plus its own GND reference.

## Controller as built

Two stacked protoboards. Board A: the Nano on headers and the 74AHCT125 in a socket, 0.1 µF ceramic at the chip.
Board B: the four series resistors, a bulk electrolytic across the 5 V input (100 µF as built; the drawing in
`wiring/CONTROLLER-STACK.html` shows 1000 µF), and solder points for the four data cables and the 5 V feed. The Nano
takes its own 5 V through its USB-C port from the same bus; VIN, VBUS and 3V3 on the headers stay unconnected.

Pixel power never goes through the controller. See `POWER.md`.

Detailed drawings: `wiring/WIRING.html` (system), `wiring/CONTROLLER-STACK.html` (the two-board stack, step by step),
`wiring/STRIP-PLAN.html` (which strip goes where). These are the build-time pages; the fog machine, beam pods and
camera they mention as optional were left out of the final build.

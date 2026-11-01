# Power

**Read this before you plug anything in.** A 5 V, 60 A supply can deliver enough current to melt wire and start a
fire without ever tripping a household breaker. The mains side of the supply can kill you. If you are not
comfortable wiring mains, have an electrician do that part. This document describes what one hobbyist built; it is
not a certified design, and you are responsible for your own build.

## The supply

- **Mean Well LRS-350-5**: 5 V, 60 A, in an IP67 box under the deck. V-adjust set to 5.1 V.
- Fed from a covered **GFCI** outlet. Test the GFCI before each night. Unplug before opening the box.
- Earth the supply's ground terminal and any exposed metal (the aluminium frame) through the cord's earth.

## Fuse every feed

Pixel power never goes through the controller. Each run gets its own inline fuse at the supply, sized for the wire,
not just the load:

| Fuse | Feeds | Rating | Wire |
|---|---|---|---|
| F1 | Rim (line 1), via a ring bus around the inside of the rim | 15 A | 14 AWG pair |
| F2 | Dome lip (line 2, RGBW) | 10 A | 14 AWG pair |
| F3 | Spokes (line 3, first part), at the centre | 15 A | 14 AWG pair |
| F4 | Belly disc (line 3, end), to both the outer ring and centre pads | 10 A | 14 AWG pair |
| F5 | Top junction: portholes, eyes | 10 A | 14 AWG pair |
| F6 | Controller (Nano through its USB-C port, 74AHCT125) | 3 A | 18 AWG |

- Inject power at several points on long runs: the rim strip takes a tap from the ring bus at the start of every
  other face (four taps), 18 AWG.
- Put a 100 µF (or larger) electrolytic across 5 V and GND at each strip start.
- Data cables carry DATA plus a GND reference; all grounds meet at the supply's −V.
- Check the voltage at the last pixel of each line at full white with the brightness cap in place: at least 4.6 V.
  If it's lower, add an injection tap there.
- Never put 5 V on the Nano ESP32's VIN pin (it wants 6-21 V). The Nano takes its 5 V through its USB-C port from a
  power-only lead on F6. Unplug that lead before connecting a laptop to flash it.

## The firmware limiter

Full white on all 1,406 LEDs is roughly 87 A on paper at 20 mA a channel (1,291 RGB LEDs at 60 mA, 115 RGBW at 80 mA).
The supply is rated 60 A; the firmware holds the saucer to **30 A**:

1. Every frame is rendered in full (unscaled floats).
2. The estimated current is summed: channel value / 255 x 20 mA, over every channel of every line.
3. If the estimate times the brightness cap would exceed 30 A, the whole frame is scaled down to fit.

```cpp
float scale = ctl.capNow() * ctl.stripsNow();
float raw = (sumAmps(F1, N1) + sumAmps(F2, N2) + sumAmps(F3, N3) + sumAmps(F4, N4)) * scale;
float k = (raw > LIMIT_A ? scale * LIMIT_A / raw : scale);
```

The default brightness cap is 42 %; serial `+`/`-` changes it (network commands can never set it above 60 %). The
limiter is an estimate, not a measurement: it is a second line of defence behind correct fusing and wire, never a
replacement for them.

The estimate ignores the LEDs' quiescent draw (about 1 mA each, ~1.4 A for the saucer) and counts the RGBW lip
from its RGB values (FastLED derives the white channel from them), so leave headroom.

## Hanging it

The saucer is about 7 ft across. If you hang one, have the structure and rigging checked by someone qualified, use rated
hardware, and keep people out from under it while it goes up and comes down.

# HULL/20

A 7 ft flying saucer for a Halloween "spaceport" in a driveway: an octagon of 2020 aluminium extrusion, a clear
24-inch dome with an alien pilot, and **1,406 WS2812B LEDs** on four data lines from an **Arduino Nano ESP32**. Every
few minutes it runs an approach and an abduction; in between it idles like a turbine, with comms, search and power
sputter events. No part of it flashes more than three times a second.

- The build, with photos: https://spaceport.neighb.io/build
- The 2027 refit in 3D: https://spaceport.neighb.io/build/3d (also in `viewer/`, offline)

**No photos are included in this repository.** The images here are drawings, renders and generated previews only.

## What's here

| Folder | What it is | Licence |
|---|---|---|
| `firmware/` | `ufo-show`, the show (Arduino, FastLED), and `ufo-test`, the bench check | MIT |
| `sim/` | The 3D browser sim the show was written in (three.js); the firmware is a line-for-line port of `sim/src/show.js` | MIT (art: CC BY 4.0) |
| `frame/` | The 2020-extrusion frame: drawings, cut sheet, drill/tap guide, assembly steps | CERN-OHL-P-2.0 |
| `cut-files/` | DXFs for the 2027 refit: floating polycarbonate panels and aluminium plates, plus the script that makes them | CERN-OHL-P-2.0 (script: MIT) |
| `viewer/` | Offline 3D viewer of the refit, to scale, assembled or exploded | MIT (three.js: MIT) |
| `pcb/boarding-pass/` | Rev B souvenir boarding pass: a touch switch driving a Darlington pair. KiCad project and fab files | CERN-OHL-P-2.0 |
| `docs/` | The build story, data lines, power, the flash-rate rule, the MQTT contract, wiring drawings | CC BY 4.0 |

Details per path: `LICENSES.md`.

## Build overview

1. **Frame.** 20 bars of 1,220 mm 2020 extrusion, square cuts only, 135° corner brackets, M6 into tapped ends. Start at
   `frame/START-HERE.html`. 87⅛ in across the flats.
2. **LEDs.** Rim 440, dome lip 115 RGBW, spokes 8 x 60, belly disc 241 (nine rings), portholes 8 x 16, eyes 2.
   `docs/DATA-LINES.md` and `docs/wiring/`.
3. **Controller.** Nano ESP32 + 74AHCT125 level shifter + 330 Ω series resistors, on two stacked protoboards.
   `docs/wiring/CONTROLLER-STACK.html`.
4. **Power.** 5 V 60 A supply, one fuse per feed, firmware limit of 30 A. `docs/POWER.md`.
5. **Firmware.** `firmware/README.md`. A fresh clone builds the standalone show with no secrets:
   ```
   arduino-cli compile --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber firmware/ufo-show
   ```
   Wi-Fi + password OTA and MQTT control are opt-in through `firmware/ufo-show/Secrets.h` (copy
   `Secrets.example.h`; it is git-ignored).
6. **Sim.** `cd sim && npm install && npm run build`, then open `sim/index.html`.
7. **2027 refit.** `cut-files/README.md`: the DXFs work with any laser/router shop that takes DXF.

## Bill of materials (summary)

| Part | Qty | Notes |
|---|---|---|
| 2020 aluminium extrusion, 1,220 mm | 20 bars | Cut list in `frame/` and `docs/BUILD.md` |
| 135° 2020 corner brackets | 24 | 3 packs of 8 |
| M6 button/socket screws, stainless; M6 drill-tap bit | | `frame/FRAME-2020.html` has the full hardware list |
| WS2812B strip, 60/m, IP67 | 920 LEDs | 440 rim, 480 spokes |
| SK6812-style RGBW strip, warm white | 115 LEDs | Dome lip |
| 241-LED WS2812B disc, 9 rings | 1 | The belly light |
| 16-LED WS2812B rings | 8 (+2 spare) | Portholes, behind frosted 4 in acrylic discs |
| Aluminium LED channel with milky diffuser, 1 m | 8 | Rim |
| Arduino Nano ESP32 | 1 | |
| 74AHCT125 quad buffer + socket | 1 | 3.3 V to 5 V data |
| 330 Ω resistors | 4 | One per data line |
| Capacitors | | 0.1 µF at the chip, bulk electrolytic at the controller input, 100 µF at each strip start |
| Mean Well LRS-350-5 (5 V, 60 A) | 1 | With inline fuses (15/15/15/10/10/3 A) |
| IP67 enclosure | 1 | Under the deck |
| Clear 24 in dome | 1 | Cockpit |
| Skin | | 2026: aluminised shade cloth. 2027: frosted polycarbonate panels (`cut-files/`) |

## Safety

- **Power.** A 5 V 60 A supply will melt undersized wire long before a household breaker notices. Fuse every feed at
  the supply, size the wire for the fuse, inject power along long runs, and plug into a GFCI outlet. The firmware's
  30 A limiter is a second line of defence, not a substitute for fuses. If you aren't comfortable with the mains side,
  have an electrician wire it. `docs/POWER.md`.
- **Flashing.** The saucer faces a street, so nothing on it flashes faster than **3 times a second** in any area, the
  photosensitive-epilepsy guideline. A flash counter checks the show and every network command stream across 300
  random seeds. If you change the show, re-measure before it goes on the board. `docs/FLASH-RATE.md`.
- **Hanging.** It's 7 ft across. If you hang one, have the structure and rigging checked by someone qualified, use
  rated hardware, and keep people out from under it while it moves.

## Not included

This is the saucer only. The rest of the spaceport stays out of this first release: the LED banner and garage-eyes
firmware, the yard control server and phone app, the Gate 20 passport kiosk, the Planet Hopper passport site and the
neighbourhood site's backend. They depend on private configuration and anti-abuse logic.

## Author

Robb Dixon, 2026.

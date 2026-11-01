# Firmware

Two Arduino sketches for the saucer's controller: an **Arduino Nano ESP32** feeding a **74AHCT125** level shifter,
driving four WS2812B data lines (1,406 LEDs). Wiring: `../docs/wiring/` and `../docs/DATA-LINES.md`.

| Sketch | What it is |
|---|---|
| `ufo-show/` | The show. Standalone by default; Wi-Fi + password OTA and MQTT control are opt-in through `Secrets.h` |
| `ufo-test/` | Bench check: lights each data line in its own colour so you can tell which cable is which. No network |

## ufo-show files

| File | What it is |
|---|---|
| `ufo-show.ino` | The sketch: LED output, supply limiter (30 A), serial keys, optional Wi-Fi + password OTA, optional MQTT control |
| `UfoShow.h` | The show: state machine and every segment's pixels. Pure C++, host-testable. A line-for-line port of `../sim/src/show.js` |
| `UfoCmd.h` | The gate in front of every network command (allowlist, rate limit, cooldowns, brightness ramps). Pure C++, host-testable |
| `FLASHES.md` | The measured flash-rate table: every area at or under 3 flashes a second. Re-measure after any show or gate change |
| `tools/flash-count.cpp` | The flash counter: the show alone, plus network command streams, any seed |
| `test/` | `run.sh`: AddressSanitizer tests of `UfoCmd.h`, then mutants that must each make the tests fail |
| `Secrets.example.h` | Template for the git-ignored `Secrets.h`. Holds no real values |

## Build

Arduino CLI, ESP32 core 3.x (built and tested with `esp32:esp32` 3.2.0), FastLED 3.10, and PubSubClient 2.8 (only
for the MQTT build).

```
arduino-cli core install esp32:esp32
arduino-cli lib install FastLED PubSubClient
arduino-cli compile --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber --build-path build/ufo-show firmware/ufo-show
arduino-cli compile --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber --build-path build/ufo-test firmware/ufo-test
```

`PinNumbers=byGPIONumber` matters: the pin numbers in the sketches are the chip's GPIO numbers (D2 = GPIO5 and so on).

What you get depends on `ufo-show/Secrets.h`:

| `Secrets.h` | Build |
|---|---|
| absent (the default in a fresh clone) | Standalone show, no radio code (`UFO_NET 0`) |
| present, `UFO_MQTT_HOST` not set | Wi-Fi station + ArduinoOTA with a required password hash |
| present, `UFO_MQTT_HOST` set | The above plus MQTT control (`../docs/MQTT.md`) |

A `Secrets.h` copied from the example without filling it in **refuses to compile**: `UFO_OTA_PASSWORD_MD5` must be a
real 32-character lowercase hex MD5, so OTA can never run open. Force a mode with `-DUFO_NET=0` or `-DUFO_MQTT=0`.

With the network on, the `.bin` carries your Wi-Fi password and OTA hash. Build into a private directory, and don't
publish the build output.

## Flash

USB: `arduino-cli upload --fqbn esp32:esp32:nano_nora:PinNumbers=byGPIONumber -p <serial port> firmware/ufo-show`.

OTA (network build only): the board advertises itself as `ufo-25` over mDNS on port 3232. Use the ESP32 core's
`espota.py` or `arduino-cli upload` with a network port, and the OTA password whose MD5 you put in `Secrets.h`.
A new image is on trial until Wi-Fi and OTA come back up; if they don't within 10 minutes it rolls back to the
previous one. In practice OTA from inside an aluminium frame and box was unreliable (see `../docs/BUILD.md`); USB is
the dependable path.

Each build prints a build id at boot and on `?`. Put a short git sha in a git-ignored `ufo-show/BuildId.h`
(`#define UFO_BUILD "abc1234"`) to know which image is running; without it the id is `dev`.

## Checks before anything goes on the board

```
sh firmware/ufo-show/test/run.sh                                  # gate tests + mutants, all must be killed
c++ -std=c++17 -O2 -o flash-count firmware/ufo-show/tools/flash-count.cpp
for s in $(seq 1 300); do ./flash-count $s | tail -1; done | sort | uniq -c   # every line "all areas <= 3/s"
```

Then rebuild the sim (`../sim`) and compare: firmware and sim are meant to change together.

## Serial (115200)

`i a b` modes (idle, approach + abduction, abduction now), `1 2 3` idle events (comms, search, sputter), `m` auto
on/off, `+ -` brightness cap (to 100 %), `T` line test, `?` status: build id, phase, cap, amps, frame time, reset
reason, image slot and state, Wi-Fi RSSI, OTA, MQTT up/down, refused/dropped commands.

`T`, `+` and `-` are USB-only; nothing on the network can reach them.

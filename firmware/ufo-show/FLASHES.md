# Flash rate, measured

The UFO faces the road. Its show stays at or under **3 flashes a second per area** (photosensitive safety).
That holds for the show on its own and for any stream of network commands the portal can send. Every flicker in
`UfoShow.h` steps on one shared clock, `FLICK` = 4 changes a second, or half of it.

**Any change to the show or to the command gate (`UfoCmd.h`) is re-measured before it goes on the board,** and this
file is updated in the same commit.

## How

```
c++ -std=c++17 -O2 -o flash-count firmware/ufo-show/tools/flash-count.cpp
./flash-count            # seed 25; exit status 1 if any area goes over 3
for s in $(seq 1 300); do ./flash-count $s | tail -1; done | sort | uniq -c
```

The counter renders the show at 64 fps and sums the luminance of each area. It counts a flash as a pair of opposing
swings, each at least 10 % of that run's own peak, and reports the most flashes in any 1 s window. Using the
run's peak is never looser than "10 % of full brightness", and stricter in dim runs.

Runs:
- **The show on its own:** a sputter, a comms event, a full approach + abduction (20 s), and 60 s of idle with its
  own events.
- **Network command streams, 60 s each**: a command offered on every frame, far above the bucket's
  5/s, through the real `UfoControl` (allowlist, bucket, cooldowns, ramps). Output is scaled as on the board (cap,
  strips fade, 30 A limiter). Streams: `i`/`b`, `i`/`a` (ends mid-beam), `i`/`e3` (sputter), `s0`/`s1`,
  `c5`/`c60`, and 120 s of random allowlisted commands.

Areas: each rim face (55 LEDs), each porthole, each spoke. Whole segments too: the rim, cockpit, spokes, iris,
**porthole ring** and eyes. The porthole ring and the rim each count as **one area** from the street.

## Current (2026-10-27, portal control)

Seed 25. **Seeds 1-300: 0 over.**

| Area | Show alone | With network streams |
|---|---|---|
| Rim face | 3 | 3 |
| Rim (whole) | 3 | 3 |
| Porthole | 2 | 3 |
| Porthole ring | 3 | 3 |
| Spoke | 2 | 3 |
| Spokes (whole) | 1 | 2 |
| Iris | 1 | 2 |
| Cockpit | 1 | 2 |
| Eyes | 2 | 2 |

## What was changed to get there (2026-10-27)

The command-driven runs exposed places where the show itself sat over the line. The old counter missed them because
a brighter moment in the same run (the abduction's white flash) raised the threshold.
- **Porthole charge sweep:** a sharp comet lit the 8 windows one after another, so the ring pulsed 12 times a second.
  It is now a cos⁴ lobe, which has no harmonic above the 4th, so over 8 evenly spaced windows the ring's total stays
  constant while the lobe turns.
- **Sputter reboot:** rim faces and portholes come back in 4 groups of opposite pairs, 0.4 s apart (they were one by
  one, 0.3 / 0.13 s apart).
- **Strobes:** they fire only when the craft is calm: idle, no event for a second, turbine slow. Fore and aft now
  flash together.
- **Comms:** the rim cells and the windows step on half the clock (2 changes a second). Windows blend toward the
  comms colour and fade with the event; before, a window dropped to black as comms began.
- **Idle events** wait for a calm turbine. A mode change puts the next event at least 20 s out, so a cut-short
  event isn't followed at once by a new one.
- **Approach windows** fade on instead of flickering on. Crew shadows are soft-edged, lighter (35 %) and slower
  (0.4-0.7 Hz).
- **Eyes:** the red blink in the abduction runs once a second, with no lid blink on top of it.
- **Network gate:** `a`, `b` and `e*` only from a calm idle; a mode or event start at most every 2 s; strips 1 per
  2 s as a 0.5 s fade; the cap ramps and applies at most every 334 ms.

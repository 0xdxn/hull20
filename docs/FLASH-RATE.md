# No faster than three a second

The saucer faces a street. Its show holds one hard line: **no area flashes more than 3 times in any one second**,
the usual photosensitive-epilepsy guideline (WCAG 2.x "Three Flashes", and the broadcast guidance it comes from).
That holds for the show on its own and for any stream of commands the network can send.

The measured table and how to re-run it live with the firmware: `../firmware/ufo-show/FLASHES.md`. Re-measure after
any change to the show (`UfoShow.h`, `../sim/src/show.js`) or to the command gate (`UfoCmd.h`).

## How the show stays under the line

- **One shared clock.** Every flicker in the show steps on `FLICK` = 4 changes a second, or half of it. A change is
  half a flash (a flash is a pair of opposing swings), so 4 changes a second is at most 2 flashes.
- **Fades, not sparkle.** The first version flickered 16 to 30 times a second in places. Sparkle became fades.
- **The turbine tops out at 2 turns a second**, and comet tails fade out once more of them would pass one point more
  than about twice a second.
- **Strobes fire only when the craft is calm** (idle, no event for a second, turbine slow), and fore and aft flash
  together, so they read as one flash.
- **Network commands can't step brightness.** The cap ramps, strips fade over 0.5 s, and modes/events start at most
  every 2 s (`../docs/MQTT.md`).

## The flash counter

`firmware/ufo-show/tools/flash-count.cpp` renders the show at 64 frames a second and sums the luminance of each area.
It counts a flash as a pair of opposing swings, each at least 10 % of that run's own peak, and reports the most
flashes in any 1 s window.

Areas: each rim face (55 LEDs), each porthole, each spoke; and whole segments: the rim, cockpit, spokes, belly disc,
the **porthole ring** and the eyes. The porthole ring and the rim each count as one area seen from the street.

Runs: the show on its own (a sputter, a comms event, a full approach + abduction, 60 s of idle with its own events),
then 60 s network command streams offered on every frame (far above the 5/s rate limit) through the real gate, with
output scaled exactly as on the board. Across 300 random seeds: **0 over**.

## The one you can't see

The counter found a flash nobody could see. During the abduction's charge phase, a bright comet ran around the eight
portholes. Each window flashed slowly, but the ring as a whole pulsed 12 times a second.

The fix is a lobe of ((1 + cos φ) / 2)⁴ for each porthole's brightness against its angle φ from the sweep. Expanded,
that's a polynomial of degree 4 in cos φ, so it has no harmonic above the 4th. Summed over eight evenly spaced
windows, every harmonic from the 1st to the 7th cancels and only the constant is left: the ring's total brightness
stays flat while the lobe goes round. It still looks like it's spinning; the ring as a whole no longer pulses.

```cpp
// one sweep at 1.5 a second. A cos^4 lobe has no harmonic above the 4th,
// so over 8 evenly spaced windows the ring's total stays constant while the lobe turns.
float b = powf(0.5f + 0.5f * cosf(2 * (float)M_PI * (frac(st.t * 1.5f) - aw)), 4);
set(o, CYAN, 0.08f + 0.4f * sstep(PH_CHARGE, PH_BEAM, s));
add(o, lerpC(CYAN, HOT, sp), b);
```

Why it works: for N windows at angles 2πk/N, the sum of cos(m(θ − 2πk/N)) over k is zero unless m is a multiple of N.
The lobe's harmonics stop at m = 4 < 8, so only m = 0 survives.

## Caveat

This is a measured guideline, not a medical guarantee. The counter uses luminance swings of 10 % of the run's peak,
which is stricter than "10 % of full brightness", but it doesn't model saturated-red flashes separately or the area
of the viewer's visual field. If you change the show, re-measure, and when in doubt slow it down.

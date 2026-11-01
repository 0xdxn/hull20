# MQTT control contract (optional)

The saucer runs its whole show without a network. If you build `firmware/ufo-show` with `UFO_MQTT_HOST` set in
`Secrets.h`, it also makes one outbound MQTT connection so a control page can nudge it. The control page itself (the
original project's yard portal) is **not included** in this repository; anything that can publish to an MQTT broker
can drive the board.

## `fence/ufo/cmd`: controller writes, board reads. QoS 0, retain off

One command per message, ASCII, no newline. The board accepts only a full match against this allowlist (`UfoCmd.h`):

| Cmd | Meaning |
|---|---|
| `i` | idle now |
| `a` | approach, then abduction (only from a calm idle) |
| `b` | abduction now (only from a calm idle) |
| `e1` `e2` `e3` | comms / search / sputter (only in idle, no event running) |
| `m0` `m1` | auto abductions off / on |
| `g0` | auto gap back to random (150-240 s) |
| `g120`..`g900` | auto gap fixed, seconds; decimal, no sign, no leading zero |
| `c5`..`c60` | brightness cap percent; no leading zero; never above 60 from the network |
| `s0` `s1` | strips dark / show |
| `?` | publish state now |

The gate on the board, in front of every message:
- exact topic; length 1-8 checked before any copy; printable ASCII only; then the allowlist;
- a token bucket of about 5 commands a second (burst 8); the excess is dropped;
- a mode or event starts at most every 2 s, and `a`, `b`, `e*` only from a calm idle;
- strips on/off at most every 2 s, as a 0.5 s fade;
- the brightness cap ramps, applies at most every 334 ms, and is never above 60 % from the network.

Together these keep any command stream under the 3-flashes-a-second line (`firmware/ufo-show/FLASHES.md`).
Line test (`T`) and the cap above 60 % stay on USB serial only.

## `fence/ufo/state`: board writes, controller reads. Retain off

Sent on connect, every 15 s, on `?` and on each mode change. JSON, under 320 bytes.

**Treat it as hostile input.** A broker password on a home LAN is sniffable, so anyone on that network may be able to
write this topic. A controller should drop messages over 512 bytes and invalid JSON, accept only the keys below with
these types and ranges (drop the whole message if one is wrong), and render values as text, never as HTML.

| Key | Type | Allowed |
|---|---|---|
| `build` | string | exactly 7 lowercase hex, or `dev` |
| `mode` | string | `idle` `approach` `abduction` `cooldown` |
| `event` | string | `none` `comms` `search` `sputter` |
| `auto` | boolean | |
| `next_s` | integer | 0..900 |
| `gap_s` | integer | 0 (random) or 120..900 |
| `cap` | integer | 5..100 (serial can set it above 60) |
| `strips` | boolean | |
| `amps` | number | 0..30 |
| `rssi` | integer | -100..0 |
| `img` | string | `valid` `trial` |
| `refused` | integer | 0..4294967295 |
| `dropped` | integer | 0..4294967295 |

## Connection behaviour

TCP connect capped at 1.5 s and socket reads at 2 s, so a dead broker can't stall the LEDs for long; reconnects back
off from 2.5 s up to 60 s. The MQTT client pauses during an OTA update.

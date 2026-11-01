# Building HULL/20

The engineering story of the saucer, October 2026: the frame and cut list, the four data lines, the controller, the
show's state machine and the update that wouldn't land. Photos of the build are on the project page,
https://spaceport.neighb.io/build. This repository holds no photos.

Some people put a skeleton on the lawn in October. We built a spaceport, and this is its flying saucer: an octagon of
2020 aluminium extrusion, 87⅛ inches across the flats, a clear 24-inch dome, an alien pilot who has never asked for a
raise, and 1,406 LEDs on four data lines from an Arduino Nano ESP32.

## A simulator before the ladder

The show was written first as pure functions in JavaScript, in a 3D browser sim of the saucer (`../sim`), then ported
line for line to C++ for the Nano ESP32 (`../firmware/ufo-show/UfoShow.h`) and checked against the sim pixel by
pixel. The sim is where the look got decided. The port is where it got real.

The sim also models the wire: a WS2812B bit is 1.25 µs, so 24 bits is 30 µs per LED. Better to learn the frame rate
from a chair than from a ladder.

## The frame

2020 T-slot: eight rim bars (A) in an octagon, eight spokes (B) to a hub ring (C) that stands 6⅜ inches up on eight
posts (E), and a small core ring (D) at the centre. 87⅛ inches (2,213 mm) across the flats, 94⅜ across the points.

There are no sloped joints. Everything meets square or at 135 degrees, with corner brackets at the rim, and the slope
of the top comes from the skin pulled tight from the rim to the hub. Flat rings and straight spokes are stiffer than
hinges, there's nothing to set by eye, and it's cheaper. Under the deck an IP67 box sits on two rails across the core
ring. The dome sits on the deck plate. Four spokes carry pad eyes top and bottom as lift points, and holes for the
legs it stands on when it's landed.

Drawings: `../frame/START-HERE.html`, then `FRAME-2020.html`, `CUT-SHEET.html`, `DRILL-TAP.html`, `ASSEMBLY.html`.

**Cut list**, 20 bars of 1,220 mm, 3 mm kerf, square cuts only:

| Piece | Qty | Length | Cut from |
|---|---|---|---|
| A rim | 8 | 900 mm (35⅜") | bars 1 to 8 |
| B spoke | 8 | 900 mm (35⅜") | bars 9 to 16 |
| C hub ring | 8 | 300 mm (11¾") | offcuts of A |
| D core ring | 8 | 137.8 mm (5⅜") | offcuts of B |
| E hub post | 8 | 142 mm (5⅝") | offcuts of B |
| F plate leg | 4 | 90 mm (3½") | bar 18 |
| G riser post | 8 | 95 mm (3¾") | bars 17, 18 |
| H box rail | 2 | 373 mm (14⅝") | bar 19, cut last |
| K porthole post | 8 | 60 mm (2⅜") | bar 18 |
| L leg post | 4 | 150 mm (5⅞") | bars 17, 20 |
| X leg extension | 4 | 400 mm (15¾") | bars 17, 19, 20 |

At the saw, one stop-block setting per letter: cut every piece of that letter, then move the block, and tape a label
on everything as it comes off. Matching lengths within a letter matter more than the exact number. Then 88 ends
tapped M6, 25 mm deep (every B, E, F, G, K, L and X, both ends), 6.5 mm clearance holes on the centre line with a
drill guide, and 5.5 mm bracket holes marked through the brackets. And a great deal of deburring. Aluminium chips get
everywhere.

The 2026 skin was Aluminet (aluminised shade cloth), top and belly, pulled tight from the rim to the hub, with ¾ in
plywood plates. The
2027 refit replaces them with floating frosted polycarbonate panels and aluminium plates: `../cut-files`, shown to
scale and exploded in `../viewer`.

## Last year's lights

No new LEDs. Four 5 m reels of 60/m RGB and one warm-white RGBW reel from the year before, each bench-tested, with
every cut planned around what was on the reel. One had a bad seal and got resealed with heat shrink.

The plan called for 56 LEDs per spoke. A metre is 60, so the spokes got 60 and the firmware was changed to match the
ship rather than the drawing (`SPOKE_N = 60`). The rim is one strip running all the way round through eight aluminium
channels with milky diffusers. The spokes are cut pieces joined with short wires, so one data line snakes out along a
spoke, across to the next, and back in, then carries on into the big light in the belly. Details: `DATA-LINES.md`.

## The controller

The fog machine and the beam pods came off the manifest, and so did the screw terminals. Every part you take out is a
part that can't fail at 8 pm with a line of kids watching.

Two stacked protoboards: the Nano ESP32 on headers and a 74AHCT125 in a socket on one; four 330 Ω series resistors, a
bulk capacitor and solder points for the cables on the other. Every wire soldered straight into its hole, one wire per
step, 35 steps (`wiring/CONTROLLER-STACK.html`).

The bench test (`../firmware/ufo-test`) lights all four lines at once, each in its own colour (rim green, dome blue,
spokes purple, portholes cyan), with a short test strip moved from cable to cable. Three of the four lit the first
time. The rim stayed dark. A meter down the chain found it at the first resistor, and then everything lit.

The controller was also drawn as a proper PCB. It stayed a drawing and is not in this repository; the one flying is
the hand-wired stack.

## The show

A small state machine, the same in the sim and on the board:

| Mode | How long | What it does |
|---|---|---|
| Idle | 150 to 240 s, random | The rim turns like a turbine. Rare events: comms (4.6 s), search (6 s), sputter (6.6 s) |
| Approach | 3.5 s | The portholes light in sequence from one side, like the crew rushing to the window |
| Abduction | 11.2 s | Charge 2.0 s, beam 4.5 s, lift 8.0 s, flash 9.6 s, black 9.75 s, release 10.05 s, end 11.2 s |
| Cooldown | 3.0 s | Back to idle |

```cpp
static const float PH_CHARGE = 2.0f, PH_BEAM = 4.5f, PH_LIFT = 8.0f, PH_FLASH = 9.6f,
                   PH_BLACK = 9.75f, PH_RELEASE = 10.05f, PH_END = 11.2f;
static const uint8_t IRIS_RINGS[9] = { 1, 8, 12, 16, 24, 32, 40, 48, 60 };   // 241 LEDs
```

The abduction, in order: the portholes lock on, cyan fills the spokes toward the white centre, violet at full speed, a
lift of soft white on the rim, a flash, a moment of black, and a ring of light runs back out. Abductions are
scheduled, not strobed. The saucer keeps a passenger count, incremented at the flash. Nobody has been taken. The count
is a formality.

A few details. The turbine has inertia: a first-order lag, quick to spin up (0.9 s) and slow to spin down (2.2 s),
capped at 2 turns a second. Idle events come 20 to 60 seconds apart and start only once the turbine has calmed down,
because comets plus an event went over the flash limit. The big light in the belly is drawn as an eye: a pupil, a
gaze that drifts on slow noise, and a blink every 5 to 14 seconds in which the rings close from the outside in. On
lock-on the gaze snaps. There's an input for a camera to say where a person is; there's no camera on this saucer, so
it snaps at whoever it imagines. The show clock wraps in a quiet moment, so float precision doesn't wander over a
long night. Same state and same inputs give the same pixels: all randomness comes from one xorshift32.

Power and the 30 A limiter: `POWER.md`. The flash rule and the maths behind it: `FLASH-RATE.md`.

## Updates in an aluminium can

The saucer can take updates over Wi-Fi with a password. In the driveway, inside an aluminium frame, an aluminium box
and shade cloth, 11 tries in a row stopped partway, each at a different point. It looks like the board restarts
mid-transfer; the one update that ever landed out there had USB power plugged in as well. So updates went over the
cable, and v1.2 turns Wi-Fi modem power saving off (`WiFi.setSleep(false)`). In space, no one can hear your Wi-Fi.

Every update lands in the other of two flash slots, so the slot doesn't tell you what's running. Each build prints its
own build id on the serial line at boot.

## The boarding pass

A souvenir for the kids at the gate: a circuit board cut like a ticket (`../pcb/boarding-pass`). Touch both halves of
the gold disc and a Darlington pair, running on the few microamps that leak through a finger, switches on three LEDs
behind a bare-FR4 beam window. No battery, no radio, no firmware: USB-C for power, and a "CUT ME" jumper that makes it
twice as touchy.

## Maiden flight

29 October 2026. It hangs over the driveway, lit from below, and every few minutes it abducts nobody in particular.

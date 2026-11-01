"""HULL/20 boarding pass rev B: every mark on the card, as polygons per layer.

Rev B adds a real circuit (design.py): the split gold disc under the beam is
the touch switch, three lenses light the beam, three stars are lit windows,
and the back explains it all in plain words. The pumpkin and the barcode are
gone; the date reads TONIGHT so the pass works any night of the year.

Runs in the art Python (fontTools, shapely, segno, python-barcode):
    python artgen.py <build-dir>/art.json

Four finishes from one board, no parts:
  gold   = copper with the mask opened over it (ENIG gold)
  white  = silkscreen
  black  = mask over bare board
  window = mask opened on both sides with no copper: the beam is bare FR4,
           which glows when the pass is held up to a light.
Front layers are F.*, back layers B.*; the back is drawn in "view"
coordinates (as you see it turned over) and mirrored onto the board.
"""
import json
import math
import os
import sys
from pathlib import Path

import barcode
import segno
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, os.environ.get("PCB_TOOLS", "tools"))  # the scripting toolkit (not included)
from art import render  # noqa: E402

W, H = 89.0, 51.0          # card
STUB_X = 64.0              # perforation between pass and stub
URL = "https://spaceport.neighb.io/pass"

out = {}                   # layer -> list of shapely geometries


def add(layer, geom):
    out.setdefault(layer, []).append(geom)


def gold(side, geom):
    add(f"{side}.Cu", geom)
    add(f"{side}.Mask", geom.buffer(0.05))


def text_geom(**item):
    item.setdefault("id", item["text"])
    item.setdefault("layer", "x")
    polys = render(item)["polys"]
    return unary_union([Polygon(p["outer"], p["holes"]) for p in polys])


def T(text, x, y, h, font="IBMPlexMono", wght=600, anchor="center", tracking=0.0, back=False):
    return text_geom(text=text, x=(W - x) if back else x, y=y, height=h, font=font, wght=wght,
                     anchor=anchor,  # art.py mirrors about the anchor, so view-left stays "left"
                     tracking=tracking, mirror=back)


def back(geom):
    """View coordinates of the back -> board coordinates."""
    return affinity.scale(geom, xfact=-1, yfact=1, origin=(W / 2, 0))


def ellipse(cx, cy, rx, ry):
    return affinity.scale(Point(cx, cy).buffer(1.0, 64), rx, ry)


def star(cx, cy, r):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return Polygon(pts)


# ------------------------------------------------------------- the saucer
SX, SY = 47.0, 21.0        # saucer centre on the front


def saucer(alien=True):
    body = unary_union([ellipse(SX, SY + 1.0, 13.5, 3.4), ellipse(SX, SY - 0.6, 8.8, 2.9)])
    rim = box(SX - 14, SY + 1.05, SX + 14, SY + 1.45)
    ports = unary_union([Point(SX + dx, SY - 0.55).buffer(0.55, 24) for dx in (-6.2, -3.1, 0, 3.1, 6.2)])
    dome_out = ellipse(SX, SY - 2.0, 5.6, 5.4).intersection(box(SX - 7, SY - 8, SX + 7, SY - 2.0))
    dome_in = ellipse(SX, SY - 2.0, 4.8, 4.6).intersection(box(SX - 7, SY - 8, SX + 7, SY - 2.6))
    g = unary_union([body, dome_out]).difference(unary_union([rim, ports, dome_in]))
    if alien:
        head = ellipse(SX, SY - 4.4, 1.35, 1.75)
        eyes = unary_union([affinity.rotate(ellipse(SX + s * 0.62, SY - 4.3, 0.55, 0.3), s * -28)
                            for s in (-1, 1)])
        neck = box(SX - 0.35, SY - 3.0, SX + 0.35, SY - 2.6)
        g = g.union(unary_union([head, neck]).difference(eyes))
    return g


BEAM = Polygon([(SX - 3.6, SY + 4.5), (SX + 3.6, SY + 4.5), (SX + 9.0, SY + 19.0), (SX - 9.0, SY + 19.0)])


def pumpkin(cx, cy, s=1.0):
    lobes = unary_union([ellipse(cx + dx * s, cy, rx * s, 2.05 * s)
                         for dx, rx in ((-1.45, 1.6), (1.45, 1.6), (0, 1.95))])
    stem = affinity.rotate(box(cx - 0.32 * s, cy - 2.75 * s, cx + 0.32 * s, cy - 1.7 * s), -14)
    face = unary_union([
        Polygon([(cx - 1.5 * s, cy - 0.15 * s), (cx - 0.55 * s, cy - 0.15 * s), (cx - 1.02 * s, cy - 1.0 * s)]),
        Polygon([(cx + 0.55 * s, cy - 0.15 * s), (cx + 1.5 * s, cy - 0.15 * s), (cx + 1.02 * s, cy - 1.0 * s)]),
        Polygon([(cx - 1.75 * s, cy + 0.45 * s), (cx + 1.75 * s, cy + 0.45 * s), (cx + 1.25 * s, cy + 1.25 * s),
                 (cx + 0.6 * s, cy + 0.85 * s), (cx, cy + 1.35 * s), (cx - 0.6 * s, cy + 0.85 * s),
                 (cx - 1.25 * s, cy + 1.25 * s)]),
    ])
    return unary_union([lobes, stem]).difference(face)


PUMPKIN = pumpkin(SX, SY + 14.6, 1.05)
SCAN = unary_union([LineString([(SX - 12, SY + y), (SX + 12, SY + y)]).buffer(0.13, cap_style=2)
                    for y in (8.4, 12.8, 17.6)]).intersection(BEAM.buffer(-0.5))   # between the lens cutouts (design.py BEAM_LED_Y)

# ------------------------------------------------------------------ FRONT
gold("F", saucer())
gold("F", SCAN)
add("F.Mask", BEAM)
# (the back stays masked over the beam: the light comes from the lenses behind it now)
LIT = ((38.5, 14.0), (55.2, 12.4), (60.8, 15.2))      # = design.py POWER_STAR + PIEZO_STARS
for x, y, r in ((59.0, 29.5, 0.6), (35.0, 31.5, 0.7), (60.2, 38.8, 0.5), (33.4, 39.6, 0.45), (40.4, 9.9, 0.4)):
    gold("F", star(x, y, r))
for x, y in LIT:              # a gold sparkle round the LED's lens cutout (1.7 x 2.3 + 0.25 copper clearance)
    gold("F", star(x, y, 2.6).difference(box(x - 1.1, y - 1.4, x + 1.1, y + 1.4)))

# header
add("F.SilkS", T("HULL/20", 4.2, 7.3, 3.0, font="Orbitron", wght=900, anchor="left", tracking=0.04))
add("F.SilkS", T("BOARDING PASS", 61.0, 7.0, 1.25, anchor="right", tracking=0.3))
gold("F", box(4.2, 8.9, 61.0, 9.25))


def field(label, value, x, y, vh=1.6):
    add("F.SilkS", T(label, x, y, 0.95, anchor="left", tracking=0.2))
    add("F.SilkS", T(value, x, y + 2.7, vh, font="Orbitron", wght=700, anchor="left", tracking=0.04))


field("FROM", "EARTH", 4.2, 13.0)
field("TO", "MOTHERSHIP", 15.4, 13.0, vh=1.45)
field("FLIGHT", "HL20", 4.2, 19.8)
field("DATE", "TONIGHT", 15.4, 19.8, vh=1.45)
field("GATE", "20", 4.2, 26.6)
field("SEAT", "ANY", 11.6, 26.6)
field("CLASS", "ABDUCTEE", 19.6, 26.6, vh=1.35)
field("STATUS", "NOW BOARDING", 4.2, 33.4, vh=1.45)

# passenger: a white silk panel to write a name on
add("F.SilkS", T("PASSENGER", 4.2, 40.2, 0.95, anchor="left", tracking=0.2))
add("F.SilkS", box(4.2, 41.2, 30.6, 46.4))

# the split disc (a footprint in design.py) sits where the beam lands
add("F.SilkS", T("TOUCH BOTH HALVES", SX, 49.6, 0.8, tracking=0.25))
# fuel port: the USB-C's legs come through here, between HULL/20 and BOARDING PASS
USB_X = 34.5               # = design.py
add("F.SilkS", T("FUEL", USB_X, 5.6, 0.9, tracking=0.3))
add("F.SilkS", Polygon([(USB_X, 2.4), (USB_X - 0.8, 3.6), (USB_X + 0.8, 3.6)]))

# perforation + stub
def perforation(side):
    dashes = [box(STUB_X - 0.12, y, STUB_X + 0.12, y + 0.9) for y in [3.2 + i * 1.6 for i in range(28)] if y + 0.9 < H - 3.2]
    add(f"{side}.SilkS", unary_union(dashes))


perforation("F")
SC = 75.5
add("F.SilkS", T("GATE", SC, 6.6, 1.2, anchor="center", tracking=0.4))
gold("F", T("20", SC, 16.4, 7.6, font="Orbitron", wght=900, anchor="center", tracking=0.02))
qr = segno.make(URL, error="m")
mods = qr.matrix
n = len(mods)
quiet, m = 2, 0.6
size = (n + 2 * quiet) * m
qx, qy = SC - size / 2, 20.2
dark = unary_union([box(qx + (quiet + c) * m, qy + (quiet + r) * m, qx + (quiet + c + 1) * m, qy + (quiet + r + 1) * m)
                    for r, row in enumerate(mods) for c, v in enumerate(row) if v])
add("F.SilkS", box(qx, qy, qx + size, qy + size).difference(dark))
add("F.SilkS", T("HOW IT", SC, qy + size + 2.3, 1.0, anchor="center", tracking=0.3))
add("F.SilkS", T("WORKS", SC, qy + size + 4.1, 1.0, anchor="center", tracking=0.3))

# ------------------------------------------------------------------- BACK
# The back is the circuit, explained. View coordinates (as you see it turned
# over); every label sits beside the part it names (design.py positions,
# view x = W - board x).
SMALL = 0.85


def bt(text, x, y, h=SMALL, anchor="center", **kw):
    add("B.SilkS", T(text, x, y, h, anchor=anchor, back=True, **kw))


bt("FUEL IN", W - USB_X - 9.6, 3.6, 0.8, tracking=0.15)          # beside the connector, clear of its parts
bt("USB-C, 5 V", W - USB_X - 9.6, 5.4, 0.8, tracking=0.08)
bt("THE BEAM: 3 LEDS", W - SX, 24.3, 0.8, tracking=0.12)
bt("PIEZO: TAP ME", W - 58.0, 22.3, 0.8, tracking=0.1)
bt("AMPLIFIER", W - SX + 2.0, 41.4, 0.8, tracking=0.25)
bt("Q1", W - 47.0, 43.6, 0.8)
bt("Q2", W - 41.0, 43.6, 0.8)
bt("CUT ME", W - 57.6, 39.6, 0.8, tracking=0.1)
bt("+", W - 35.3, 43.0, 1.0)        # J3 pad 1 (SPARE_A) is at board x 35.3
bt("-", W - 31.7, 43.0, 1.0)
bt("YOUR LED", W - 33.5, 48.9, 0.75, tracking=0.15)

COL = 61.5                # explainer column, view x
lines = [
    ("HOW THIS PASS WORKS", "h"),
    ("1 PLUG USB-C INTO A PHONE", ""),
    ("  CHARGER. THAT'S THE FUEL.", ""),
    ("2 TOUCH BOTH HALVES OF THE", ""),
    ("  GOLD DISC ON THE FRONT.", ""),
    ("  YOUR SKIN CLOSES THE GAP.", ""),
    ("3 Q1 AND Q2 ARE TRANSISTORS.", ""),
    ("  THEY TURN THE TINY CURRENT", ""),
    ("  IN YOUR FINGER INTO ENOUGH", ""),
    ("  TO LIGHT THE BEAM.", ""),
    ("", ""),
    ("TRY THIS", "h"),
    ("- HOLD HANDS IN A CHAIN.", ""),
    ("- DRAW ACROSS THE GAP WITH", ""),
    ("  A SOFT PENCIL.", ""),
    ("- CUT THE JUMPER. DOES ONE", ""),
    ("  HALF WORK ON ITS OWN NOW?", ""),
    ("- TAP A PIEZO ON ITS PADS.", ""),
]
y = 11.0
for text, kind in lines:
    if text:
        if kind == "h":
            bt(text, COL, y + 0.3, 1.05, anchor="left", font="Orbitron", wght=800, tracking=0.08)
        else:
            bt(text, COL, y, SMALL, anchor="left")
    y += 2.05 if kind != "h" else 2.4

# back stub (view x 3..25): ringed planet + who made it
bs = 14.0
planet = Point(bs, 25.0).buffer(4.0, 96)
ring = affinity.rotate(ellipse(bs, 25.0, 8.0, 2.0).difference(ellipse(bs, 25.0, 6.6, 1.35)), -18, origin=(bs, 25.0))
ring_front = ring.difference(box(bs - 9, 18, bs + 9, 25.0).intersection(planet.buffer(0.45)))
planet_cut = planet.difference(ring.buffer(0.45).difference(box(bs - 9, 18, bs + 9, 25.0)))
gold("B", back(unary_union([planet_cut, ring_front])))
add("B.SilkS", T("HULL/20", bs, 9.6, 2.6, font="Orbitron", wght=900, tracking=0.04, back=True))
add("B.SilkS", T("SPACEPORT", bs, 12.6, 1.0, tracking=0.35, back=True))
for i, line in enumerate(("THIS PASS IS A", "REAL CIRCUIT BOARD", "MADE AT GATE 20")):
    add("B.SilkS", T(line, bs, 36.0 + i * 2.2, 0.95, tracking=0.1, back=True))
# for the curious: Arc Station, lesson 4 (arcacademy.sh)
add("B.SilkS", T("ls -a", bs, 44.6, 1.0, tracking=0.1, back=True))
add("B.SilkS", T("pip is in the vents", bs, 46.7, 0.85, tracking=0.05, back=True))


# ------------------------------------------------------------------ write
def polys(geom):
    geoms = getattr(geom, "geoms", [geom])
    res = []
    for g in geoms:
        if g.geom_type == "Polygon" and not g.is_empty:
            g = g.simplify(0.01)
            res.append({"outer": list(g.exterior.coords)[:-1],
                        "holes": [list(i.coords)[:-1] for i in g.interiors]})
        elif hasattr(g, "geoms"):
            res += polys(g)
    return res


items = []
for layer, geoms in out.items():
    g = unary_union(geoms)
    items.append({"id": layer, "layer": layer, "polys": polys(g)})
    print(f"{layer:<8} {len(items[-1]['polys']):4d} shapes")
Path(sys.argv[1]).write_text(json.dumps(items))
print(f"QR version {qr.version} {qr.error}, {n}x{n} modules at {m} mm, {size:.1f} mm square")

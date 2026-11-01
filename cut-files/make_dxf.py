"""
UFO 2027 cut files for any laser/router shop that takes DXF: floating polycarbonate top and belly facets,
and 5052 aluminium plates.

Geometry comes from the frame drawing (../frame/FRAME-2020.html, 2026-10-12), in mm, exported in INCHES
(upload at 1:1 and choose inches). One part per file, closed outlines and holes only, no text.

    python make_dxf.py        (needs ezdxf + matplotlib; writes *.dxf and previews/*.png here, and ../viewer/geometry.js)

Frame numbers used (rim top = z 0):
  rim       outer side 916.6 -> outer apothem 1106.45, centreline 1096.45 (20 mm bar)
  hub ring  300 cut, square ends butting inside -> outer apothem 382.1, centreline 372.1; top z = 142 post + 20 = 162
  core ring 137.8 cut -> centreline apothem 176.3; plate legs F 29 mm from one end of D2/D4/D6/D8
  dome      flange ID 605, OD 666, bolted straight to the deck on r 317.75 (no G riser posts as built)
  lift      J12 pad eyes on every other spoke, 1000 mm from centre (top and underneath); leg posts L at 940 mm
  porthole  K posts on every spoke at 744 mm from centre, 60 mm tall, porthole plate on top
  belly     rim bottom z -20; centre plate top z -110 (F legs 90 under the core ring), bottom -113.2 in 0.125 in 5052
"""
import json
import math
from pathlib import Path

import ezdxf
import ezdxf.path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path(__file__).parent
IN = 25.4
T22 = math.tan(math.radians(22.5))

# ---- the panel plane ---------------------------------------------------------------------------
STANDOFF = 25.0                         # rim standoff height, rim top to panel underside
R_RIM_C, R_RIM_O = 1096.45, 1106.45
R_HUB_O, R_HUB_C, HUB_TOP = 382.1, 372.1, 162.0
TAN = (HUB_TOP - STANDOFF) / (R_RIM_C - R_HUB_O)   # rests on the standoffs and on the hub ring's outer top edge
COS = math.cos(math.atan(TAN))
R_O = R_RIM_O + 10.0                    # outer edge: a 10 mm drip edge past the rim
R_I = 370.0                             # inner edge: 12 mm onto the hub ring, clamped under the deck plate
GAP = 8.0                               # the reveal between neighbouring panels (gaps, not joins)
SIDE = (GAP / 2) / math.cos(math.radians(22.5))
L = (R_O - R_I) / COS                   # panel length along the slope

def y_of(r):                            # plan radius -> distance up the panel from its outer edge
    return (R_O - r) / COS

def half_w(r):
    return r * T22 - SIDE

# ---- outline helpers ---------------------------------------------------------------------------
def fillet_poly(pts, radii):
    """closed polygon with a fillet radius per vertex -> list of (x, y, bulge) for an LWPOLYLINE"""
    n, out = len(pts), []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        r = radii[i]
        if r <= 0:
            out.append((p1[0], p1[1], 0.0)); continue
        v1 = (p0[0] - p1[0], p0[1] - p1[1]); v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1, u2 = (v1[0] / l1, v1[1] / l1), (v2[0] / l2, v2[1] / l2)
        ang = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        d = r / math.tan(ang / 2)
        a = (p1[0] + u1[0] * d, p1[1] + u1[1] * d); b = (p1[0] + u2[0] * d, p1[1] + u2[1] * d)
        sweep = math.pi - ang
        cross = u1[0] * u2[1] - u1[1] * u2[0]           # turn direction at this vertex
        bulge = math.tan(sweep / 4) * (1 if cross < 0 else -1)
        out.append((a[0], a[1], bulge)); out.append((b[0], b[1], 0.0))
    return out

def octagon(af, r_fillet):
    """regular octagon, across flats af, flats on the x and y axes, centred on 0,0"""
    s = af / (1 + math.sqrt(2)); h = af / 2
    pts = [(s / 2, -h), (h, -s / 2), (h, s / 2), (s / 2, h), (-s / 2, h), (-h, s / 2), (-h, -s / 2), (-s / 2, -h)]
    return fillet_poly(pts, [r_fillet] * 8)

class Part:
    def __init__(self, name):
        self.name, self.outline, self.circles, self.slots = name, [], [], []
    def save(self):
        doc = ezdxf.new("R2010", units=ezdxf.units.IN)
        doc.header["$MEASUREMENT"] = 0
        msp = doc.modelspace()
        msp.add_lwpolyline([(x / IN, y / IN, b) for x, y, b in self.outline], format="xyb", close=True)
        for (cx, cy, d) in self.circles:
            msp.add_circle((cx / IN, cy / IN), d / 2 / IN)
        for s in self.slots:
            msp.add_lwpolyline([(x / IN, y / IN, b) for x, y, b in s], format="xyb", close=True)
        doc.saveas(OUT / f"{self.name}.dxf")
        self.preview()
    def geom(self):
        """the saved DXF traced back to mm polylines, for the 3D build viewer (../build-2027)"""
        doc = ezdxf.readfile(OUT / f"{self.name}.dxf")
        outline, holes = None, []
        for e in doc.modelspace():
            if e.dxftype() == "LWPOLYLINE":
                pts = [[round(v.x * IN, 2), round(v.y * IN, 2)] for v in ezdxf.path.make_path(e).flattening(0.02)]
                if outline is None: outline = pts
                else: holes.append(pts)
            elif e.dxftype() == "CIRCLE":
                c, r = e.dxf.center, e.dxf.radius * IN
                holes.append([[round(c.x * IN + r * math.cos(a), 2), round(c.y * IN + r * math.sin(a), 2)]
                              for a in (i / 48 * 2 * math.pi for i in range(48))])
        return {"outline": outline[:-1] if outline[0] == outline[-1] else outline, "holes": holes}
    def bbox(self):
        xs = [p[0] for p in self.outline]; ys = [p[1] for p in self.outline]
        return (max(xs) - min(xs)) / IN, (max(ys) - min(ys)) / IN
    def preview(self):
        (OUT / "previews").mkdir(exist_ok=True)
        doc = ezdxf.readfile(OUT / f"{self.name}.dxf")
        fig, ax = plt.subplots(figsize=(7, 7))
        for e in doc.modelspace():
            if e.dxftype() == "LWPOLYLINE":
                pts = list(ezdxf.path.make_path(e).flattening(0.002)); ax.plot([p.x for p in pts], [p.y for p in pts], "k-", lw=1)
            elif e.dxftype() == "CIRCLE":
                c, r = e.dxf.center, e.dxf.radius
                t = [i / 90 * 2 * math.pi for i in range(91)]
                ax.plot([c.x + r * math.cos(a) for a in t], [c.y + r * math.sin(a) for a in t], "k-", lw=1)
        w, h = self.bbox()
        ax.set_aspect("equal"); ax.set_title(f"{self.name}  ·  {w:.2f} × {h:.2f} in", fontsize=10); ax.grid(alpha=.2)
        fig.savefig(OUT / "previews" / f"{self.name}.png", dpi=110, bbox_inches="tight"); plt.close(fig)

def obround(cx, cy, length, width):     # slot along y, centred at cx, cy
    r, h = width / 2, (length - width) / 2
    return [(cx + r, cy - h, 0.0), (cx + r, cy + h, 1.0), (cx - r, cy + h, 0.0), (cx - r, cy - h, 1.0)]

# ---- 1-2. top panels (polycarbonate) -----------------------------------------------------------
def top_panel(lift: bool):
    p = Part("top-panel-lift" if lift else "top-panel")
    wo, wi = half_w(R_O), half_w(R_I)
    # inner edge notch round the J5 deck screw (hub ring centreline, mid-side): open U, 10 wide, to 6 mm past the screw
    nw, ny = 10.0, y_of(R_HUB_C + 6.0)               # ny: the notch bottom, outboard of the screw
    pts = [(-wo, 0), (wo, 0), (wi, L), (nw / 2, L), (nw / 2, ny), (-nw / 2, ny), (-nw / 2, L), (-wi, L)]
    radii = [6, 6, 4, 0, 4.99, 4.99, 0, 4]
    p.outline = fillet_poly(pts, radii)
    yr = y_of(R_RIM_C)
    p.circles = [(-320, yr, 10.0), (320, yr, 10.0),   # rim standoffs, oversize for M6 + expansion
                 (0, y_of(744), 10.0)]                # mid support: a 1 in standoff on the porthole plate (K post), so the span doesn't sag
    if lift:
        # the bridle leg leaves the pad eye (r 1000) up and inward: a slot along the spoke, centred r 985
        p.slots = [obround(0, y_of(985), 60, 32)]
    return p

# ---- belly panels (polycarbonate) -------------------------------------------------------------
# Hung under the rim on standoffs in the rim's bottom slot, a 2 in standoff from each spoke's bottom slot at
# mid-span, the inner edge clamped between the centre plate and the bezel ring. The reveals land under the 8
# belly LED channels (rim corner to plate corner), so the strips show as lit lines between the panels.
B_STAND, PLATE_BOT, PLATE_AF = 25.0, -113.2, 457.2
B_TAN = (-PLATE_BOT - (20 + B_STAND)) / (R_RIM_C - PLATE_AF / 2)
B_COS = math.cos(math.atan(B_TAN))
B_RI = 190.0                            # inner edge: 38 mm in under the centre plate
B_MID = R_RIM_C - (2 * IN + 20 - (20 + B_STAND)) / B_TAN    # where a 2 in standoff from the spoke bottom meets the panel
BEZEL_BC = 210.0                        # M5 bolts: centre plate, panel, bezel, on the spoke lines
def by_of(r):
    return (R_O - r) / B_COS

def belly_panel(leg: bool):
    p = Part("belly-panel-leg" if leg else "belly-panel")
    wo, wi, L2 = half_w(R_O), half_w(B_RI), by_of(B_RI)
    p.outline = fillet_poly([(-wo, 0), (wo, 0), (wi, L2), (-wi, L2)], [6, 6, 4, 4])
    yr = by_of(R_RIM_C)
    p.circles = [(-320, yr, 10.0), (320, yr, 10.0), (0, by_of(B_MID), 10.0), (0, by_of(BEZEL_BC), 7.0)]
    if leg:
        # the lift spokes: bottom pad eye (1000) and leg post L (940) share one slot, 920-1030 mm from centre
        p.slots = [obround(0, by_of(975), 110 / B_COS, 40)]
    return p

# ---- 3. deck plate (5052) ----------------------------------------------------------------------
def deck():
    p = Part("deck-plate")
    p.outline = octagon(2 * R_HUB_O, 3)
    holes = []
    for k in range(8):
        a = math.radians(45 * k)                      # mid-sides: on the spokes
        holes.append((R_HUB_C * math.cos(a), R_HUB_C * math.sin(a), 6.6))        # J5
        b = a + math.radians(22.5)                    # dome lip bolts (no riser posts as built), between the spokes
        holes.append((317.75 * math.cos(b), 317.75 * math.sin(b), 6.6))          # J9
    holes.append((0, 0, 38.1))                        # cable pass to the dome (inside the dome's footprint)
    p.circles = holes
    return p

# ---- 4. centre plate (5052) + 5. sail clamp ring -----------------------------------------------
def centre():
    p = Part("centre-plate")
    p.outline = octagon(457.2, 3)
    holes = [(0, 0, 241.3)]                           # beam port 9.5 in
    for k in range(4):                                # plate legs F under D2/D4/D6/D8: core ring centreline, 39.9 mm off mid-side
        a = math.radians(90 * k)
        r, t = 176.3, 137.8 / 2 - 29.0
        holes.append((r * math.cos(a) - t * math.sin(a), r * math.sin(a) + t * math.cos(a), 6.6))
    for k in range(8):
        a = math.radians(45 * k)                      # M5: plate, belly panel, bezel, on the spoke lines
        holes.append((BEZEL_BC * math.cos(a), BEZEL_BC * math.sin(a), 5.5))
    p.circles = holes
    return p

def bezel():
    """the visible trim under the belly's centre: clamps the 8 panels' inner edges to the centre plate"""
    p = Part("belly-bezel")
    p.outline = octagon(PLATE_AF + 20, 3)              # 10 mm proud of the plate all round, hides the panel edges
    p.circles = [(0, 0, 241.3)] + [(BEZEL_BC * math.cos(math.radians(45 * k)), BEZEL_BC * math.sin(math.radians(45 * k)), 5.5) for k in range(8)]
    return p

# ---- 6. porthole plate (5052) ------------------------------------------------------------------
def porthole():
    p = Part("porthole-plate")
    h = 127.0 / 2
    p.outline = fillet_poly([(-h, -h), (h, -h), (h, h), (-h, h)], [6] * 4)
    p.circles = [(0, 0, 6.6)]                         # J10
    return p

if __name__ == "__main__":
    parts = [top_panel(True), top_panel(False), belly_panel(True), belly_panel(False), deck(), centre(), bezel(), porthole()]
    for p in parts:
        p.save()
        w, h = p.bbox()
        print(f"{p.name:18s} {w:6.2f} x {h:5.2f} in")
    geo = {"parts": {p.name: p.geom() for p in parts},
           "k": {"STANDOFF": STANDOFF, "TAN": TAN, "COS": COS, "R_O": R_O, "R_I": R_I, "L": L, "R_RIM_C": R_RIM_C,
                 "R_HUB_O": R_HUB_O, "R_HUB_C": R_HUB_C, "HUB_TOP": HUB_TOP, "B_STAND": B_STAND, "B_TAN": B_TAN,
                 "B_COS": B_COS, "B_RI": B_RI, "B_MID": B_MID, "BEZEL_BC": BEZEL_BC, "PLATE_BOT": PLATE_BOT,
                 "PLATE_AF": PLATE_AF, "GAP": GAP}}
    viewer = OUT.parent / "viewer"
    viewer.mkdir(exist_ok=True)
    # a script, not JSON: the viewer opens from file:// (no fetch) and the site's CSP allows only same-origin scripts
    (viewer / "geometry.js").write_text("window.UFO_GEO=" + json.dumps(geo, separators=(",", ":")) + ";\n")
    print(f"panel: slope {math.degrees(math.atan(TAN)):.2f} deg, length {L:.1f} mm ({L / IN:.2f} in), "
          f"outer {2 * half_w(R_O) / IN:.2f} in, inner {2 * half_w(R_I) / IN:.2f} in, gap {GAP:.0f} mm")
    print(f"belly: slope {math.degrees(math.atan(B_TAN)):.2f} deg, length {by_of(B_RI) / IN:.2f} in, mid standoff at r {B_MID:.0f} mm, "
          f"inner {2 * half_w(B_RI) / IN:.2f} in")

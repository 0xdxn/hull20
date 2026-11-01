"""HULL/20 boarding pass, rev B: a touch-to-light learning board.

89 x 51 mm, the Gate 20 pass art (ENIG gold on black, artgen.py) with a real
circuit behind it. Every part sits on the back so JLC assembles one side.

  USB-C (power only, CC pull-downs so any C charger gives 5 V)
    -> the split gold disc under the beam (front): left half = 5 V,
       right half = the amplifier's input through 100k
    -> Q1 + Q2 MMBT3904 as a Darlington pair (gain ~10,000): the few
       microamps through a finger, a chain of hands or a pencil line
       switch ~30 mA into three beam LEDs
    -> the beam: three reverse-mount yellow LEDs behind the bare-FR4 beam
       window, lens down through a 1.7 x 2.3 mm cutout each (Lite-On DS22-2000-254 p.7)
       and through the glass itself.
  JP1 (bridged trace, "CUT ME"): puts 4.7M in parallel with the 10M input
       pull-down (sensitive enough for a dry fingertip or a chain of hands).
       Cut it and only the 10M is left: the input gets twice as touchy (does
       one half alone pick up the hum of the house wiring now?).
  Power star: one reverse-mount LED behind a star window, on whenever USB is.
  Piezo stars: two LEDs back to back across two pads for a piezo disc (not
       fitted; salvage one): tap it and a star flashes, no USB needed.
  Spare LED: two pads + 220R in parallel with the beam: solder in your own.

Nothing draws current until the disc is closed (the power star aside), so
there is no switch. No battery, no radio, no firmware.

Built with a private KiCad scripting toolkit that isn't part of this release: placement from this file, routing
with the KiCad autorouter, then the session frozen in boarding-pass.ses. The KiCad project here is the editable source.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.environ.get("PCB_TOOLS", "tools"))  # the scripting toolkit (not included)
import pcblab  # noqa: E402
from circuit import Circuit  # noqa: E402

W, H, R_CORNER, STUB_X, NR = 89.0, 51.0, 3.0, 64.0, 1.6
SX, SY = 47.0, 21.0                       # saucer centre (front), same as artgen.py
DISC = (SX, 44.0)
USB_X = 34.5                              # clear of HULL/20 on the front (the shield legs come through)                         # split touch disc (front)
BEAM_LED_Y = (27.2, 31.6, 36.0)           # gold rungs sit between them, at 29.4 / 33.8 / 38.6 (artgen.py)
POWER_STAR = (38.5, 14.0)                 # lit stars, board coordinates (front view)
PIEZO_STARS = ((55.2, 12.4), (60.8, 15.2))

FP_R = "Resistor_SMD:R_0603_1608Metric"
LED = ("Device:LED", "Pass:LED_LTST-C230", "LTST-C230KSKT")
LED_LCSC = "C125108"                      # Lite-On reverse mount 1206, yellow 587 nm
OWN_FP = (0, 0.0, 0.0)                    # fp_from_lcsc footprint: JLC origin and rotation by construction
# HRO TYPE-C-31-M-12: measured correction (JLC origin at KiCad (0, -1.42))
USB_C_ROT = (0, 0.0, -1.42)


def circuit():
    c = Circuit("boarding-pass", title="HULL/20 boarding pass", rev="B")
    p = c.part
    j = p("J1", "Connector:USB_C_Receptacle_USB2.0_16P", "Pass:USB_C_HRO_TYPE-C-31-M-12_Flush",
          "USB-C", lcsc="C165948", rot_offset=USB_C_ROT)
    rcc1 = p("R1", "Device:R", FP_R, "5.1k", lcsc="C23186")
    rcc2 = p("R2", "Device:R", FP_R, "5.1k", lcsc="C23186")
    disc = p("TP1", "Connector_Generic:Conn_01x02", "Pass:TouchSplit", "TOUCH")
    rin = p("R3", "Device:R", FP_R, "100k", lcsc="C25803")
    rpd = p("R4", "Device:R", FP_R, "10M", lcsc="C7250")
    rant = p("R5", "Device:R", FP_R, "4.7M", lcsc="C177475")
    jp = p("JP1", "Jumper:SolderJumper_2_Bridged", "Jumper:SolderJumper-2_P1.3mm_Bridged_RoundedPad1.0x1.5mm", "CUT ME")
    q1 = p("Q1", "Transistor_BJT:MMBT3904", "Package_TO_SOT_SMD:SOT-23", "MMBT3904", lcsc="C20526")
    q2 = p("Q2", "Transistor_BJT:MMBT3904", "Package_TO_SOT_SMD:SOT-23", "MMBT3904", lcsc="C20526")
    beams = [p(f"D{i}", *LED, lcsc=LED_LCSC, rot_offset=OWN_FP) for i in (1, 2, 3)]
    rbeam = [p(f"R{5 + i}", "Device:R", FP_R, "220", lcsc="C22962") for i in (1, 2, 3)]
    star = p("D4", *LED, lcsc=LED_LCSC, rot_offset=OWN_FP)
    rstar = p("R9", "Device:R", FP_R, "4.7k", lcsc="C23162")
    pz = [p(f"D{5 + i}", *LED, lcsc=LED_LCSC, rot_offset=OWN_FP) for i in (0, 1)]
    pzpad = p("J2", "Connector_Generic:Conn_01x02", "Pass:PadPair_3mm", "PIEZO")
    spare = p("J3", "Connector_Generic:Conn_01x02", "Pass:PadPair_3mm", "SPARE LED")
    rspare = p("R10", "Device:R", FP_R, "220", lcsc="C22962")

    c.connect("VBUS", *j.pins_named("VBUS"), disc[1], *(r[1] for r in rbeam), rstar[1], rspare[1])
    c.connect("0V", *j.pins_named("GND"), j["SH"], rcc1[2], rcc2[2], rpd[2], rant[2], q2["E"], star["K"])
    c.connect("CC1", j["CC1"], rcc1[1])
    c.connect("CC2", j["CC2"], rcc2[1])
    c.nc(*j.pins_named("D+"), *j.pins_named("D-"), j["SBU1"], j["SBU2"])
    c.connect("TOUCH", disc[2], rin[1])
    c.connect("BASE1", rin[2], q1["B"], rpd[1], jp[1])
    c.connect("ANT", jp[2], rant[1])
    c.connect("BASE2", q1["E"], q2["B"])
    c.connect("BEAM", q1["C"], q2["C"], *(d["K"] for d in beams), spare[2])
    for i, (d, r) in enumerate(zip(beams, rbeam), 1):
        c.connect(f"BEAM_A{i}", r[2], d["A"])
    c.connect("STAR_A", rstar[2], star["A"])
    c.connect("SPARE_A", rspare[2], spare[1])
    # piezo: two LEDs back to back, one lights on each half of the tap's pulse
    c.connect("PZ1", pzpad[1], pz[0]["A"], pz[1]["K"])
    c.connect("PZ2", pzpad[2], pz[0]["K"], pz[1]["A"])
    c.supply("VBUS")
    c.supply("0V")
    return c


def arc(cx, cy, r, a0, a1, n=16):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def layout(B, c):
    import pcbnew
    B.libs["Pass"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Pass.pretty")
    B.rules(clearance=0.2, track=0.25, classes=[("Power", 0.4, ["VBUS", "0V", "BEAM"])])
    edge = []
    edge += arc(R_CORNER, R_CORNER, R_CORNER, 180, 270)
    edge += arc(STUB_X, 0.0, NR, 180, 0)
    edge += arc(W - R_CORNER, R_CORNER, R_CORNER, 270, 360)
    edge += arc(W - R_CORNER, H - R_CORNER, R_CORNER, 0, 90)
    edge += arc(STUB_X, H, NR, 0, -180)
    edge += arc(R_CORNER, H - R_CORNER, R_CORNER, 90, 180)
    B.outline(edge)

    # front: the split disc where the beam lands
    B.place("TP1", DISC, rot=0, side="F")
    # back: USB-C at the top edge, opening up, in the clear band between HULL/20 and BOARDING PASS
    B.place("J1", (USB_X, 3.65), rot=180, side="B")      # face flush with the edge, so thick plugs seat and latch
    # CC pull-downs straight behind their pins (drawn stubs join them below)
    for ref, pin in (("R1", "A5"), ("R2", "B5")):
        x, _ = B.pad_xy("J1", pin)
        B.place(ref, (x, 10.9), rot=90, side="B")
        r = B.fps[ref]
        if B.pad_xy(ref, 1)[1] > B.pad_xy(ref, 2)[1]:      # pin 1 (CC) faces the connector
            r.SetOrientationDegrees(r.GetOrientationDegrees() + 180)
    # the beam: three lenses down the window's centre line, resistors beside it
    for i, y in enumerate(BEAM_LED_Y, 1):
        B.place(f"D{i}", (SX, y), rot=0, side="B")
        B.place(f"R{5 + i}", (38.2, y), rot=0, side="B")
    # the amplifier, under the disc
    B.place("R3", (53.0, 42.8), rot=90, side="B")
    B.place("Q1", (47.0, 46.8), rot=0, side="B")
    B.place("Q2", (41.0, 46.8), rot=0, side="B")
    B.place("R4", (53.0, 47.2), rot=0, side="B")
    B.place("JP1", (57.6, 42.8), rot=90, side="B")
    B.place("R5", (57.6, 46.8), rot=90, side="B")
    # power star
    B.place("D4", POWER_STAR, rot=0, side="B")
    B.place("R9", (POWER_STAR[0], POWER_STAR[1] + 2.4), rot=0, side="B")
    # piezo stars + their pads
    for i, xy in enumerate(PIEZO_STARS):
        B.place(f"D{5 + i}", xy, rot=0, side="B")
    B.place("J2", (58.0, 18.5), rot=0, side="B")
    # spare LED pads beside the amplifier
    B.place("J3", (33.5, 45.6), rot=0, side="B")
    B.place("R10", (38.2, 42.6), rot=90, side="B")

    # No copper pour: ground ("0V", so the toolchain treats it as an ordinary
    # routed net) is a trace like the rest, and the back reads as the circuit.
    B.art(B.art_path)

    # Drawn copper (locked; the router keeps it). Seen through the lit window from
    # the front, the beam's wiring reads as a spine and three rungs.
    for i in (1, 2, 3):                 # each resistor turned so its LED end faces the LED
        r = B.fps[f"R{5 + i}"]
        if B.pad_xy(f"R{5 + i}", 2)[0] < B.pad_xy(f"R{5 + i}", 1)[0]:
            r.SetOrientationDegrees(r.GetOrientationDegrees() + 180)
    for i in (1, 2, 3):
        B.track(f"BEAM_A{i}", "B.Cu", [B.pad_xy(f"D{i}", 2), B.pad_xy(f"R{5 + i}", 2)], width=0.3)
    spine = [B.pad_xy(f"D{i}", 1) for i in (1, 2, 3)]
    B.track("BEAM", "B.Cu", spine + [(spine[-1][0], SY + 19.6)], width=0.4)
    # the USB-C's CC pins escape straight back out of the pad row on the back,
    # so the router never needs the front (its tracks would show by FUEL)
    for pad, net, ref in (("A5", "CC1", "R1"), ("B5", "CC2", "R2")):
        B.track(net, "B.Cu", [B.pad_xy("J1", pad), B.pad_xy(ref, 1)], width=0.2)
    # the USB-C's two VBUS pin pairs, joined under the connector body (between
    # its locating pegs): the drawn CC lines leave no way round below
    vl, vr = B.pad_xy("J1", "A4"), B.pad_xy("J1", "A9")
    if vl[0] > vr[0]:
        vl, vr = vr, vl
    top = vl[1] - 0.72                              # pad edge on the connector side
    B.track("VBUS", "B.Cu", [vl, (vl[0], top), (vl[0] + 0.55, top - 0.6), (vl[0] + 0.55, top - 2.0),
                             (vr[0] - 0.55, top - 2.0), (vr[0] - 0.55, top - 0.6), (vr[0], top), vr], width=0.3)
    # the disc's two halves drop to the back through a via each
    B.via("VBUS", (DISC[0] - 1.9, DISC[1] - 1.6), size=0.6, drill=0.3)    # high in each half, clear of the amplifier behind
    B.via("TOUCH", (DISC[0] + 1.9, DISC[1] - 1.6), size=0.6, drill=0.3)
    for item in B.b.GetTracks():
        item.SetLocked(True)

    # the router's brief: back layer only, never through a window or the front art
    beam = [(SX - 3.6, SY + 4.5), (SX + 3.6, SY + 4.5), (SX + 9.0, SY + 19.0), (SX - 9.0, SY + 19.0)]
    stars = [arc(x, y, 2.0, 0, 360, 16)[:-1] for x, y in (POWER_STAR, *PIEZO_STARS)]
    art = json.load(open(B.art_path))
    art_cu = [pp["outer"] for item in art if item["layer"] == "F.Cu" for pp in item["polys"]]
    e = 0.6
    strips = [[(0, 0), (W, 0), (W, e), (0, e)], [(0, H - e), (W, H - e), (W, H), (0, H)],
              [(0, 0), (e, 0), (e, H), (0, H)], [(W - e, 0), (W, 0), (W, H), (W - e, H)],
              [(STUB_X - NR - e, 0), (STUB_X + NR + e, 0), (STUB_X + NR + e, NR + e), (STUB_X - NR - e, NR + e)],
              [(STUB_X - NR - e, H - NR - e), (STUB_X + NR + e, H - NR - e), (STUB_X + NR + e, H), (STUB_X - NR - e, H)]]
    A = lambda pts: [(round(B.ox + x, 4), round(B.oy + y, 4)) for x, y in pts]
    with open(os.path.splitext(B.path)[0] + ".route.json", "w") as f:
        json.dump({"inactive_layers": ["F.Cu"],
                   "wire_keepouts": [{"layer": "B.Cu", "poly": A(beam)}] +
                                    [{"layer": "F.Cu", "poly": A(p)} for p in art_cu],   # the DSN doesn't carry art copper
                   "via_keepouts": [{"poly": A(p)} for p in [beam, *stars, *art_cu]],
                   "hard_keepouts": {"layers": ["B.Cu"], "polys": [A(s) for s in strips]}}, f)

    B.hide_values()
    for ref in c.parts:
        B.ref_text(ref, visible=False)
    B.colours(mask="Black", silk="White", finish="ENIG")


if __name__ == "__main__":
    pcblab.main(circuit, layout)

# Cut files: the 2027 refit panels and plates

Floating frosted polycarbonate panels, top and belly, plus aluminum plates for the 2020 frame. These replace the aluminet, the belly sail and the ¾ in plywood plates. The geometry comes from `../frame/FRAME-2020.html`, and `make_dxf.py` rebuilds every file.

These are plain DXF files. Any laser, waterjet or CNC router shop that takes DXF can cut them; nothing here is tied to one shop. `hull20-2027-cut-files.zip` holds the eight DXFs and this README for upload.

**Upload:** the `.dxf` files are drawn at 1:1 in **inches**, one part per file, outlines and holes only. Tell the shop the units are inches.

## What to order

| File | Material | Thickness | Qty | Size (in) | What it is |
|---|---|---|---|---|---|
| `top-panel-lift.dxf` | Polycarbonate, clear | 0.177" | **4** | 35.81 × 29.92 | Top facet on a lift spoke (slot for the bridle leg) |
| `top-panel.dxf` | Polycarbonate, clear | 0.177" | **4** | 35.81 × 29.92 | Top facet, other four spokes |
| `belly-panel-leg.dxf` | Polycarbonate, clear | 0.177" | **4** | 35.80 × 36.59 | Belly facet on a lift spoke (slot for the leg post and the bottom pad eye) |
| `belly-panel.dxf` | Polycarbonate, clear | 0.177" | **4** | 35.80 × 36.59 | Belly facet, other four spokes |
| `deck-plate.dxf` | 5052 aluminum | 0.125" | 1 | 30.09 × 30.09 | Deck on the hub ring; the dome lip bolts straight to it |
| `centre-plate.dxf` | 5052 aluminum | 0.125" (0.187" stiffer) | 1 | 18 × 18 | Belly centre plate, 9½ in beam port |
| `belly-bezel.dxf` | 5052 aluminum | 0.125" | 1 | 18.79 × 18.79 | Trim under the centre plate: clamps the belly panels' inner edges, hides them |
| `porthole-plate.dxf` | 5052 aluminum | 0.125" | **8** | 5 × 5 | On the K posts; now also the top panels' mid support |

- **Finish:** black powder coat on the aluminum if your shop offers it at these sizes, to match the black extrusion. The bezel is the part you see from below. Check the shop's anodizing size limit before asking for it on the 30 in deck.
- **Size limits:**
  - The **belly panels are 36.6 in in both directions**. Check your shop's maximum polycarbonate sheet size; some stop at 30 in on one side. If they're too big, split each belly facet in two down its centre line in `make_dxf.py`. That gives a 16-panel belly with a reveal on every spoke.
  - The deck is 30.09 in. If a shop's limit is 30 in, take it down to 29.9 in.

## How the panels float (railing-glass style)

**The seams between panels are open: an 8 mm reveal**, about 5⁄16 in, with every panel edge free. It reads as deliberate, and it absorbs ±4 mm of build error at every edge. Each panel sits on three lines of the frame: the rim, the middle of its spoke, and the hub or centre plate.

### Top

- **Outer edge:** two **¾ × 1 in stainless glass standoffs** (M6) in **M6 drop-in T-nuts** in the rim's top slot, 320 mm either side of the mid-side.
  - The panel overhangs the rim by 10 mm as a drip edge.
  - The panel holes are 10 mm for an M6 screw, so the sheet can move with temperature.
- **Middle:** one **1 in standoff on the porthole plate** over the K post, with a 4 mm EPDM pad under the panel. The gap to fill is about 29 mm.
  - Without it, a 30 in span on a shallow slope sags about 10 mm.
  - It leaves one polished cap mid-panel, the railing-glass look.
- **Inner edge:** runs 12 mm onto the hub ring and is clamped **under the deck plate** by the J5 screws, on an ⅛ in EPDM strip.
  - A notch clears the screw, so a panel slides out after you loosen one screw.
  - The deck overlaps the panels, so rain runs off the deck, down the panels and off the drip edge.
- **Slope:** 10.9°.
- **Lift spokes:** the bridle leg comes up through a 60 × 32 mm slot. Line it with rubber U edge trim for 3/16 in sheet.

### Belly

- **Outer edge:** two **¾ × 1 in standoffs hanging from T-nuts in the rim's bottom slot**, 320 mm either side of the mid-side, with a 10 mm overhang.
  - The rim's LED line A shows as a lit band between the top and belly panels.
- **Middle:** one **¾ × 2 in standoff hanging from the spoke's bottom slot**, 768 mm from centre.
  - The panel is nearly flat (4.5°), so without it the span would sag about 25 mm.
- **Inner edge:** runs 38 mm in under the centre plate and is **sandwiched between the plate and the bezel** by 8 M5 bolts on the spoke lines, one through each panel.
- **Lift spokes:** the leg post L (940 mm from centre) and the bottom pad eye (1000 mm) share a 110 × 40 mm slot. Line it with edge trim.
- **The reveals fall right under the 8 belly LED channels**, which run rim corner to plate corner. From below, the belly reads as 8 lit lines between glowing frosted panels.

### Frosting

Most shops cut **clear** polycarbonate, not frosted. Two options:
- **Sand:** wet-sand the inner face of every panel, 220 grit then 320, random orbit. That's the underside of the top panels and the upper side of the belly panels. The glossy face stays outside.
- **Film:** frosted window film on the same face.

A few weeks of sun a year won't yellow it.

## Buy separately (hardware, not cut parts)

| Part | Qty |
|---|---|
| Stainless glass standoffs, ¾ in diameter × 1 in, M6 | 40 (16 top rim, 8 top mid, 16 belly rim) |
| Stainless glass standoffs, ¾ in diameter × 2 in, M6 | 8 (belly mid) |
| M6 drop-in T-nuts, 2020 (slot 6) | 40 (rim top 16, rim bottom 16, spoke bottoms 8) |
| EPDM washers, 3 mm | ~96 (one each side of the panel at every standoff) |
| EPDM pads, 4 mm (top mid supports) | 8 |
| EPDM sponge strip, ½ × ⅛ in, adhesive (deck and centre plate clamps) | ~12 ft |
| Rubber U edge trim for 3/16 in sheet (the 8 slots) | ~4 ft |
| M5 × 20 stainless + M5 nylocks (centre plate, panel, bezel) | 8 |

- **Deck screws:** the J5 screws stay M6 × 50. Deck 3.2 + panel 4.5 + ring 20 leaves 22 mm of thread in the post.
- **Angled washers:** the panels are tilted (10.9° top, 4.5° belly) and the standoff caps are flat. The EPDM washers take up the tilt. For a perfectly flush cap, 3D-print angled washers.

## Before you order: check these against what you built

The files follow the frame-2020 drawing. The 2026 build used ¾ in plywood plates. If your frame differs from the drawing, these are the numbers that matter:

1. **Hub ring, outside across flats:** about **30⅛ in** (765 mm). This is the deck size.
2. **Hub ring top above the rim top:** about **6⅜ in** (162 mm). This sets the top panels' slope.
3. **Rim side, outside:** about **36.1 in** (916.6 mm).
4. **Centre plate underside below the rim top:** about **4⅜ in** (113 mm). This sets the belly slope. It is the F legs (90 mm) under the core ring, plus the plate.
5. **Centre plate leg holes:** 4 holes on a 7⅛ in (181 mm) radius, each 1.57 in to one side of a flat's centre line, all to the same side, like a pinwheel. Lay your old plate over the print: if the holes are mirrored or elsewhere, fix `make_dxf.py` first.
6. **Dome lip bolts:** 8 × M6 on a 25 in circle, between the spokes, straight through the dome lip into the deck. The 2026 build left out the G riser posts, so the dome sits on the deck. Plus a 1½ in cable hole in the middle, inside the dome.
7. **Lift pad eyes:** 1000 mm from centre; **leg posts:** 940 mm, on the same 4 spokes.
8. **Porthole posts (K):** 744 mm from centre, 60 mm tall.
9. **Belly LED channels:** they must sit above the belly panels. At mid-span the panel is about 15–20 mm below the line from the rim corner to the plate corner, depending on where the channel's rim end is fixed. If a channel hangs lower than that, the belly standoffs go up to 1½ in and 2½ in.

## Facts

- **Top panel:** 36.07 in across the outer edge, 11.73 in across the inner edge, 29.92 in up the slope, 10.86°.
- **Belly panel:** 36.07 in across the outer edge, 5.86 in across the inner edge, 36.59 in along the slope, 4.49°.
- **Weight:** about 5.5 lb per top panel and 5.9 lb per belly panel in 0.177 in, so about 91 lb for all sixteen. The aluminum plates are lighter than the ¾ in ply.
- **Previews:** in `previews/`.
- **3D:** `../viewer/index.html` shows every part here on the frame, to scale, assembled or exploded. `make_dxf.py` rewrites its `geometry.js`, so the model always matches these files.
- **Portholes:** the top mid standoff screws through the porthole plate into the K post, in the middle of the 16-LED ring (the ring's hole is about 44 mm, the standoff 19 mm). The 4 in disc needs a 20 mm centre hole, or leave it off: the frosted panel above diffuses the ring anyway.

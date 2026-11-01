# Licences

Copyright (c) 2026 Robb Dixon. This repository mixes code, hardware designs and documentation, each under the licence
that fits it. Full texts are in `LICENSES/`. Where a file isn't listed, the licence of the nearest listed folder applies.

| Path | Licence |
|---|---|
| `firmware/` | MIT (`LICENSES/MIT.txt`) |
| `sim/src/`, `sim/build.mjs`, `sim/package.json` | MIT |
| `sim/assets/` (skin art textures) | CC BY 4.0 (`LICENSES/CC-BY-4.0.txt`) |
| `viewer/` (except `viewer/vendor/`) | MIT |
| `viewer/vendor/` | three.js r147, MIT, Copyright © 2010-2022 three.js authors (`viewer/vendor/LICENSE`) |
| `cut-files/make_dxf.py` | MIT |
| `cut-files/` (DXFs, previews, zip) | CERN-OHL-P-2.0 (`LICENSES/CERN-OHL-P-2.0.txt`) |
| `frame/` (frame drawings, cut sheet, drill/tap guide, assembly) | CERN-OHL-P-2.0 |
| `pcb/boarding-pass/*.py` (generator scripts) | MIT |
| `pcb/boarding-pass/` (KiCad project, footprints, routing, fab files, renders) | CERN-OHL-P-2.0 |
| `docs/`, `README.md` files, `LICENSES.md` | CC BY 4.0 |

`LICENSE` at the top level is the MIT licence, for the code.

Third-party code keeps its own licence: three.js in `viewer/vendor/`; the sim's npm dependencies (three.js, esbuild)
and the firmware's Arduino libraries (ESP32 Arduino core, FastLED, PubSubClient) are not vendored and are fetched by
their own tools under their own licences. The built sim bundle keeps three.js's licence comment.

Names and marks: "HULL/20", "UFO-25" and the spaceport artwork are the project's own.

KiCad libraries: `pcb/boarding-pass/Pass.pretty/USB_C_HRO_TYPE-C-31-M-12_Flush.kicad_mod` is KiCad's standard
`USB_C_Receptacle_HRO_TYPE-C-31-M-12` footprint with the face silkscreen removed, so it stays under the KiCad
libraries' licence (CC BY-SA 4.0 with the KiCad libraries exception). The other three footprints in `Pass.pretty/` are
original. Standard KiCad symbols and footprints embedded in the schematic and board are used under the same KiCad
libraries exception, which leaves designs that use them under their own licence.

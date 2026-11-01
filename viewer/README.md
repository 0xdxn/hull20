# 3D viewer: the 2027 refit, to scale

Open `index.html` in a browser (double-click works; no server, no network). It shows the 2020 frame with every
panel and plate from `../cut-files` on it, to scale, assembled or exploded, with a step-by-step build order, a section
through a spoke, a night view and a table of the cut parts. Click a row to show only that part.

- `viewer.js`, `viewer.css`, `index.html`: the viewer.
- `geometry.js`: the panel and plate outlines, written by `../cut-files/make_dxf.py`, so the model always matches the
  cut files. Don't edit it by hand.
- `vendor/`: three.js r147 (MIT, see `vendor/LICENSE`), unmodified.

Fonts: the hosted version (https://spaceport.neighb.io/build/3d) loads its own web fonts from `/fonts`; opened from
disk the system fallbacks apply.

The frame follows `../frame/FRAME-2020.html`; the box, belly disc, porthole rings and bridle are approximate.
1 grid square = 1 ft.

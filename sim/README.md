# UFO-25 LED show sim

`index.html` is a built, self-contained file (three.js + the print art inlined): double-click it, works offline,
desktop and phone. It is build output, so it is not in the repo: run the build once. three.js keeps its MIT
notice at the end of the bundle.

- `src/show.js`: the show. Pure functions (`makeState`, `stepState`, `px`, `beamLevel`, `fogRelay`,
  `limitFrame`); this is the part that is ported line for line to `firmware/ufo-show/UfoShow.h`.
- `src/main.js`: the three.js scene (a stand-in yard, the hung saucer, bloom, beam, fog).
- `assets/`: the skin art plan views, embedded as textures.

Build: `npm install && npm run build`.
Headless checks take URL params: `?view=street|gate|free&state=abduction&ts=6.3&day=1&uv=0&person=left`.

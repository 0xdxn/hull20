/* HULL/20 2027 refit viewer: the 2020 frame with the new panels and plates (outlines traced from the cut
 * files into geometry.js), to scale in mm, rim top = z 0.
 * Plain script, no inline code: opens from file:// and fits a strict same-origin CSP. three.js r147. */
(() => {
  "use strict";
  const G = window.UFO_GEO, K = G.k, IN = 25.4, D = Math.PI / 180, T22 = Math.tan(22.5 * D);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rhat = (th) => V3(Math.cos(th), Math.sin(th), 0);
  const that = (th) => V3(-Math.sin(th), Math.cos(th), 0);
  const $ = (id) => document.getElementById(id);

  // ---- frame numbers (mm) ----------------------------------------------------------------------
  const RIM_C = K.R_RIM_C, RIM_O = RIM_C + 10, RIM_I = RIM_C - 10, CORE_C = 176.3, HUB_C = K.R_HUB_C, HUB_TOP = K.HUB_TOP;
  const PT = 0.177 * IN, AT = 0.125 * IN;                       // polycarbonate, aluminum
  const DECK_Z = HUB_TOP + PT, DECK_TOP = DECK_Z + AT;          // deck sits on the panels' inner edges
  const LIP_Z = DECK_TOP, DOME_R = 302.5, DOME_BASE = LIP_Z + 3;  // no riser posts as built: the lip bolts to the deck
  const PLATE_TOP = -110, PLATE_BOT = K.PLATE_BOT;
  const FLOOR = -20 - 150 - 400;                                 // landed: leg post L + extension X
  const LIFT = (k) => k % 2 === 0;
  const SIN = K.TAN * K.COS, B_SIN = K.B_TAN * K.B_COS;
  const topUnder = (r) => K.STANDOFF + (RIM_C - r) * K.TAN;     // top panel underside
  const bellyTop = (r) => -(20 + K.B_STAND) - (RIM_C - r) * K.B_TAN;

  // ---- renderer, cameras ------------------------------------------------------------------------
  const stage = $("stage");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  const persp = new THREE.PerspectiveCamera(32, 1, 20, 80000);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -80000, 80000);
  let camera = persp;
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.6;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(2500, 5000, 2000);
  scene.add(hemi, sun);
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;                               // build in z-up, show in three's y-up
  scene.add(root);

  // ---- materials (all registered so the section plane reaches them) ----------------------------
  const MATS = [];
  const reg = (m) => (MATS.push(m), m);
  const std = (o) => reg(new THREE.MeshStandardMaterial(o));
  const M = {
    ext: std({ color: 0x1c1f24, metalness: 0.55, roughness: 0.42 }),
    poly: std({ color: 0xeef3f7, metalness: 0, roughness: 0.35, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    alu: std({ color: 0x2c3036, metalness: 0.35, roughness: 0.55 }),
    steel: std({ color: 0xd6dbe0, metalness: 0.9, roughness: 0.22 }),
    epdm: std({ color: 0x111111, roughness: 0.9 }),
    box: std({ color: 0x9aa0a8, roughness: 0.6 }),
    disc: std({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.7, depthWrite: false }),
    dome: std({ color: 0xdfeaff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    person: new THREE.MeshStandardMaterial({ color: 0x7d8793, roughness: 0.9, side: THREE.DoubleSide }),  // not in MATS: the spoke cut leaves the figure whole
    chan: std({ color: 0x16181c, metalness: 0.5, roughness: 0.5 }),
    ledA: std({ color: 0x0d0d0d, emissive: 0x3ee6c8 }),
    ledB: std({ color: 0x0d0d0d, emissive: 0x28ff3c }),
    ledP: std({ color: 0x0d0d0d, emissive: 0xffb23d }),
    ledI: std({ color: 0x0d0d0d, emissive: 0xb44dff }),
    ledW: std({ color: 0x0d0d0d, emissive: 0xffe2b0 }),
  };
  const LEDS = [M.ledA, M.ledB, M.ledP, M.ledI, M.ledW];
  const edgeMat = reg(new THREE.LineBasicMaterial({ color: 0x9fb2c4, transparent: true, opacity: 0.85 }));
  const edgeDark = reg(new THREE.LineBasicMaterial({ color: 0x5b6573 }));
  const rigMat = reg(new THREE.LineBasicMaterial({ color: 0xf2b33d }));
  const dimMat = reg(new THREE.LineBasicMaterial({ color: 0xf2b33d }));

  // ---- layers, items -----------------------------------------------------------------------------
  const LAYERS = [
    ["frame", "2020 frame", "#1c1f24"],
    ["poly", "Polycarbonate panels", "#dfe7ee"],
    ["alu", "Aluminum plates", "#3a3f47"],
    ["hw", "Standoffs, caps, bolts, pad eyes", "#cfd5db"],
    ["led", "LED channels, rings, iris", "#3ee6c8"],
    ["inside", "IP67 box, porthole discs", "#9aa0a8"],
    ["dome", "Dome", "#bcd7ff"],
    ["rig", "Bridle (illustrative)", "#f2b33d"],
    ["ground", "Floor, landed legs, 5′10″ person", "#7d8793"],
    ["dims", "Dimensions", "#f2b33d"],
  ];
  const layer = {};
  for (const [id, label, colour] of LAYERS) {
    const g = new THREE.Group();
    root.add(g);
    layer[id] = { id, label, colour, g, n: 0 };
  }
  const items = [];
  /** obj: a mesh or group in root (z-up) coords; o: {layer, step, ex: exploded offset, info: {name, sub}, cut} */
  function add(obj, o) {
    obj.userData = { ...o, base: obj.position.clone(), ex: o.ex || V3(), arrive: 0 };
    obj.traverse((c) => { c.userData.item = obj; });
    layer[o.layer].g.add(obj);
    layer[o.layer].n++;
    items.push(obj);
    return obj;
  }
  const withEdges = (mesh, mat = edgeMat) => (mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), mat)), mesh);

  // ---- 2020 extrusion ---------------------------------------------------------------------------
  const PROFILE = (() => {
    const s = new THREE.Shape(), h = 10, w = 3.1, d = 6;
    s.moveTo(-h, -h);
    s.lineTo(-w, -h); s.lineTo(-w, -h + d); s.lineTo(w, -h + d); s.lineTo(w, -h); s.lineTo(h, -h);
    s.lineTo(h, -w); s.lineTo(h - d, -w); s.lineTo(h - d, w); s.lineTo(h, w); s.lineTo(h, h);
    s.lineTo(w, h); s.lineTo(w, h - d); s.lineTo(-w, h - d); s.lineTo(-w, h); s.lineTo(-h, h);
    s.lineTo(-h, w); s.lineTo(-h + d, w); s.lineTo(-h + d, -w); s.lineTo(-h, -w); s.closePath();
    const c = new THREE.Path(); c.absarc(0, 0, 2.1, 0, Math.PI * 2, true); s.holes.push(c);
    return s;
  })();
  const barCache = {};
  function barGeo(len) {
    const key = len.toFixed(1);
    if (!barCache[key]) {
      const g = new THREE.ExtrudeGeometry(PROFILE, { depth: len, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -len / 2);
      barCache[key] = g;
    }
    return barCache[key];
  }
  /** an oriented frame: z' along d, x' horizontal (or `side` for vertical bars) */
  function basis(d, side) {
    const z = d.clone().normalize();
    let x = V3(0, 0, 1).cross(z);
    if (x.lengthSq() < 1e-6) x = (side || V3(1, 0, 0)).clone();
    x.normalize();
    const y = z.clone().cross(x);
    return new THREE.Matrix4().makeBasis(x, y, z);
  }
  function bar(a, b, side) {
    const m = new THREE.Mesh(barGeo(a.distanceTo(b)), M.ext);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromRotationMatrix(basis(b.clone().sub(a), side));
    return m;
  }
  const at = (v, z) => v.clone().setZ(z);

  // ---- cut parts, from the traced outlines -------------------------------------------------------------
  const cutCache = {};
  function cutGeo(name, t) {
    const key = name + t;
    if (!cutCache[key]) {
      const p = G.parts[name];
      const s = new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const h of p.holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
      cutCache[key] = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 4 });
    }
    return cutCache[key];
  }
  function cutSize(name) {
    const xs = G.parts[name].outline.map((p) => p[0]), ys = G.parts[name].outline.map((p) => p[1]);
    return `${((Math.max(...xs) - Math.min(...xs)) / IN).toFixed(2)} × ${((Math.max(...ys) - Math.min(...ys)) / IN).toFixed(2)} in`;
  }
  const POLY = "Polycarbonate, clear, 0.177 in (frost the inner face)";
  const ALU = "5052 aluminum, 0.125 in";
  const CUT = {
    "top-panel-lift": { name: "Top panel, lift spoke", mat: POLY, qty: 4, note: "Slot for the bridle leg." },
    "top-panel": { name: "Top panel", mat: POLY, qty: 4, note: "Rim standoffs ×2, mid standoff on the porthole plate, notch for the J5 deck screw." },
    "belly-panel-leg": { name: "Belly panel, lift spoke", mat: POLY, qty: 4, note: "Slot for the leg post and the bottom pad eye." },
    "belly-panel": { name: "Belly panel", mat: POLY, qty: 4, note: "Hangs on rim standoffs ×2 and a 2 in spoke standoff; inner edge in the bezel clamp." },
    "deck-plate": { name: "Deck plate", mat: ALU, qty: 1, note: "On the hub ring over the top panels' inner edges; the dome lip bolts straight to it." },
    "centre-plate": { name: "Centre plate", mat: ALU + " (0.187 stiffer)", qty: 1, note: "On the 4 plate legs; 9½ in beam port." },
    "belly-bezel": { name: "Belly bezel", mat: ALU, qty: 1, note: "Clamps the belly panels' inner edges to the centre plate (8 × M5)." },
    "porthole-plate": { name: "Porthole plate", mat: ALU, qty: 8, note: "On each K post; the top panel's mid standoff screws through it." },
  };
  const cutInfo = (name) => ({ name: CUT[name].name, sub: `${cutSize(name)} · qty ${CUT[name].qty}`, cut: name });

  function plate(name, z, mat = M.alu) {
    return withEdges(new THREE.Mesh(cutGeo(name, AT), mat), edgeDark);
  }
  /** a panel on its facet: local x across, y up the slope from the outer edge, extruded along the normal */
  function facet(name, th, belly) {
    const r = rhat(th), t = that(th);
    const d = belly ? r.clone().multiplyScalar(-K.B_COS).add(V3(0, 0, -B_SIN)) : r.clone().multiplyScalar(-K.COS).add(V3(0, 0, SIN));
    const n = t.clone().cross(d).normalize();
    const m = withEdges(new THREE.Mesh(cutGeo(name, PT), M.poly));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, d, n));
    const o = r.clone().multiplyScalar(K.R_O);
    if (belly) o.setZ(bellyTop(K.R_O)).addScaledVector(n, -PT); else o.setZ(topUnder(K.R_O));
    m.position.copy(o);
    m.renderOrder = 2;
    return m;
  }

  // ---- small parts -------------------------------------------------------------------------------
  const cyl = (r, h, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2);
  const G_STAND = {}, G_CAP = new THREE.CylinderGeometry(8.2, 9.525, 6, 24).rotateX(Math.PI / 2);
  const standGeo = (h) => (G_STAND[h.toFixed(1)] ||= cyl(9.525, h));
  function standoff(p, z0, z1) {                     // barrel between z0 and z1
    const m = new THREE.Mesh(standGeo(Math.abs(z1 - z0)), M.steel);
    m.position.copy(at(p, (z0 + z1) / 2));
    return m;
  }
  function cap(p, z, up) {                           // cap face on z, body away from the panel
    const m = new THREE.Mesh(G_CAP, M.steel);
    m.position.copy(at(p, z + (up ? 3 : -3)));
    if (!up) m.rotation.x = Math.PI;
    return m;
  }
  function padEye(p, th, up) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(44, 22, 3), M.steel);
    base.rotation.z = th;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(9, 2.6, 10, 24, Math.PI), M.steel);
    loop.rotation.x = Math.PI / 2;
    loop.rotation.y = th;
    if (!up) loop.rotation.x = -Math.PI / 2;
    loop.position.z = up ? 1.5 : -1.5;
    g.add(base, loop);
    g.position.copy(at(p, up ? 1.5 : -21.5));
    return g;
  }
  function annulus(od, id, t, mat) {
    const s = new THREE.Shape(); s.absarc(0, 0, od / 2, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, id / 2, 0, Math.PI * 2, true); s.holes.push(h);
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 48 }), mat);
  }
  /** an LED channel (U102-ish, 17 × 8) whose lit face points along `face` */
  function channel(a, b, face, ledMat) {
    const g = new THREE.Group();
    const len = a.distanceTo(b), d = b.clone().sub(a).normalize();
    const f = face.clone().addScaledVector(d, -face.dot(d)).normalize();
    const side = f.clone().cross(d).normalize();          // right-handed: side × f = d
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, f, d));
    const body = new THREE.Mesh(new THREE.BoxGeometry(17, 8, len), M.chan);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(12, 1, len - 4), ledMat);
    lit.position.y = 4.2;
    g.add(body, lit);
    g.quaternion.copy(q);
    g.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(f, 4);
    return g;
  }

  // ---- build it ----------------------------------------------------------------------------------
  const UP = (z) => V3(0, 0, z);
  const info = (name, sub) => ({ name, sub });
  for (let k = 0; k < 8; k++) {
    const th = 45 * k * D, r = rhat(th), t = that(th), lift = LIFT(k);
    // 1. rim, spokes, core ring
    const c = at(r.clone().multiplyScalar(RIM_C), -10);
    add(bar(c.clone().addScaledVector(t, -450), c.clone().addScaledVector(t, 450)), { layer: "frame", step: 1, info: info("A · Rim", "2020 × 900 mm, square ends · 8") });
    add(bar(at(r.clone().multiplyScalar(CORE_C + 10), -10), at(r.clone().multiplyScalar(RIM_I), -10)), { layer: "frame", step: 1, info: info(`B · Spoke${lift ? " (lift)" : ""}`, "2020 × 900 mm · 8, flush with the rim top") });
    const cc = at(r.clone().multiplyScalar(CORE_C), -10);
    add(bar(cc.clone().addScaledVector(t, -68.9), cc.clone().addScaledVector(t, 68.9)), { layer: "frame", step: 1, info: info("D · Core ring", "2020 × 137.8 mm · 8") });
    // 2. hub posts + ring, porthole posts, leg posts, pad eyes
    const hp = r.clone().multiplyScalar(HUB_C);
    add(bar(at(hp, 0), at(hp, 142), r), { layer: "frame", step: 2, info: info("E · Hub post", "2020 × 142 mm · 8") });
    const hc = at(hp, 152);
    add(bar(hc.clone().addScaledVector(t, -150), hc.clone().addScaledVector(t, 150)), { layer: "frame", step: 2, info: info("C · Hub ring", "2020 × 300 mm · 8; top 162 mm above the rim") });
    const kp = r.clone().multiplyScalar(744);
    add(bar(at(kp, 0), at(kp, 60), r), { layer: "frame", step: 2, info: info("K · Porthole post", "2020 × 60 mm · 8, 744 mm from centre") });
    if (lift) {
      const lp = r.clone().multiplyScalar(940), pe = r.clone().multiplyScalar(1000);
      add(bar(at(lp, -20), at(lp, -170), r), { layer: "frame", step: 2, info: info("L · Leg post", "2020 × 150 mm · 4, 940 mm from centre") });
      add(bar(at(lp, -170), at(lp, FLOOR), r), { layer: "ground", step: 2, info: info("X · Leg extension", "2020 × 400 mm · 4, landed mode") });
      add(padEye(pe, th, true), { layer: "hw", step: 2, ex: UP(80), info: info("J12 · Pad eye, top", "316 stainless, 1000 mm from centre; bridle leg") });
      add(padEye(pe, th, false), { layer: "hw", step: 2, ex: UP(-80), info: info("J12 · Pad eye, under", "316 stainless; tag line") });
      // bridle leg from the top pad eye up through the panel slot to an apex over the centre
      const apex = UP(1500), g = new THREE.BufferGeometry().setFromPoints([at(pe, 20), apex]);
      add(new THREE.Line(g, rigMat), { layer: "rig", step: 8, info: info("Bridle leg", "illustrative apex 1.5 m up") });
    }
    // 4. LED channels: line A on the rim's outer face, belly channel rim corner -> plate corner
    const la = at(r.clone().multiplyScalar(RIM_O), -10);
    add(channel(la.clone().addScaledVector(t, -457), la.clone().addScaledVector(t, 457), r, M.ledA), { layer: "led", step: 4, ex: r.clone().multiplyScalar(160), info: info("Rim LED line A", "U102 channel, 914 mm, on the rim's outer face") });
    const hip = rhat(th + 22.5 * D);
    const ca = at(hip.clone().multiplyScalar(RIM_I / Math.cos(22.5 * D)), -20), cb = at(hip.clone().multiplyScalar(K.PLATE_AF / 2 / Math.cos(22.5 * D)), PLATE_TOP);
    add(channel(ca, cb, UP(-1), M.ledB), { layer: "led", step: 4, ex: UP(-120), info: info("Belly LED channel", "U102, 935 mm, rim corner to plate corner; shows through the belly reveal") });
    // 5. belly: standoffs, panel, caps
    const bp = facet(lift ? "belly-panel-leg" : "belly-panel", th, true);
    add(bp, { layer: "poly", step: 5, ex: UP(-620).addScaledVector(r, 160), info: cutInfo(lift ? "belly-panel-leg" : "belly-panel") });
    const zb = bellyTop(RIM_C), zbm = bellyTop(K.B_MID);
    for (const s of [-320, 320]) {
      const p = r.clone().multiplyScalar(RIM_C).addScaledVector(t, s);
      add(standoff(p, -20, zb), { layer: "hw", step: 5, ex: UP(-380), info: info("Belly rim standoff", "¾ × 1 in stainless, M6 T-nut in the rim's bottom slot · 16") });
      add(cap(p, zb - PT / K.B_COS, false), { layer: "hw", step: 5, ex: UP(-780).addScaledVector(r, 160), info: info("Standoff cap", "polished stainless") });
    }
    const pm = r.clone().multiplyScalar(K.B_MID);
    add(standoff(pm, -20, zbm), { layer: "hw", step: 5, ex: UP(-380), info: info("Belly mid standoff", "¾ × 2 in stainless from the spoke's bottom slot · 8") });
    add(cap(pm, zbm - PT / K.B_COS, false), { layer: "hw", step: 5, ex: UP(-780).addScaledVector(r, 160), info: info("Standoff cap", "polished stainless") });
    const m5 = new THREE.Mesh(cyl(4.75, 3, 16), M.steel);
    m5.position.copy(at(r.clone().multiplyScalar(K.BEZEL_BC), PLATE_BOT - PT - AT - 1.5 - 6));
    add(m5, { layer: "hw", step: 5, ex: UP(-1020), info: info("M5 × 20 + nylock", "centre plate, belly panel, bezel · 8") });
    // 6. porthole plate, ring, disc, top standoffs
    const pp = plate("porthole-plate");
    pp.position.copy(at(kp, 60)); pp.rotation.z = th;
    add(pp, { layer: "alu", step: 6, ex: UP(120), info: cutInfo("porthole-plate") });
    const ring = annulus(68, 44, 3, M.ledP); ring.position.copy(at(kp, 60 + AT));
    add(ring, { layer: "led", step: 6, ex: UP(170), info: info("Porthole ring", "16-LED WS2812B ring (approx. size)") });
    const disc = annulus(101.6, 20, 3, M.disc); disc.position.copy(at(kp, 63.2 + 3));
    add(disc, { layer: "inside", step: 6, ex: UP(215), info: info("Porthole disc", "4 in frosted acrylic, needs a 20 mm centre hole for the standoff") });
    const zt = topUnder(RIM_C), ztm = topUnder(744);
    for (const s of [-320, 320]) {
      const p = r.clone().multiplyScalar(RIM_C).addScaledVector(t, s);
      add(standoff(p, 0, zt), { layer: "hw", step: 6, ex: UP(270).addScaledVector(r, 60), info: info("Top rim standoff", "¾ × 1 in stainless, M6 T-nut in the rim's top slot · 16") });
      add(cap(p, zt + PT / K.COS, true), { layer: "hw", step: 7, ex: UP(680).addScaledVector(r, 160), info: info("Standoff cap", "polished stainless") });
    }
    add(standoff(kp, 63.2, ztm - 4), { layer: "hw", step: 6, ex: UP(270), info: info("Top mid standoff", "1 in stainless through the porthole plate into the K post · 8") });
    const pad = new THREE.Mesh(cyl(11, 4), M.epdm); pad.position.copy(at(kp, ztm - 2));
    add(pad, { layer: "hw", step: 6, ex: UP(300), info: info("EPDM pad", "4 mm, under the panel at the mid standoff") });
    add(cap(kp, ztm + PT / K.COS, true), { layer: "hw", step: 7, ex: UP(680).addScaledVector(r, 160), info: info("Standoff cap", "polished stainless") });
    // 7. top panel
    const tp = facet(lift ? "top-panel-lift" : "top-panel", th, false);
    add(tp, { layer: "poly", step: 7, ex: UP(540).addScaledVector(r, 160), info: cutInfo(lift ? "top-panel-lift" : "top-panel") });
  }
  // 3. plate legs, centre plate, box rails, box, iris
  for (let k = 0; k < 4; k++) {
    const a = 90 * k * D, tt = 137.8 / 2 - 29.0;
    const p = V3(CORE_C * Math.cos(a) - tt * Math.sin(a), CORE_C * Math.sin(a) + tt * Math.cos(a), 0);
    add(bar(at(p, -20), at(p, PLATE_TOP), rhat(a)), { layer: "frame", step: 3, ex: UP(-150), info: info("F · Plate leg", "2020 × 90 mm · 4, pinwheel off the side centres") });
  }
  for (const y of [-50, 50]) add(bar(V3(-186.5, y, 10), V3(186.5, y, 10)), { layer: "frame", step: 3, ex: UP(230), info: info("H · Box rail", "2020 × 373 mm · 2, across the core ring") });
  const box = new THREE.Mesh(new THREE.BoxGeometry(284, 196, 130), M.box);
  box.position.set(0, 0, 20 + 65);
  add(withEdges(box, edgeDark), { layer: "inside", step: 3, ex: UP(400), info: info("IP67 box", "11.2 × 7.7 × 5.1 in, on the rails under the deck") });
  const cp = plate("centre-plate"); cp.position.z = PLATE_BOT;
  add(cp, { layer: "alu", step: 3, ex: UP(-310), info: cutInfo("centre-plate") });
  const iris = new THREE.Mesh(cyl(80, 3, 48), M.ledI); iris.position.z = PLATE_TOP + 4;
  add(iris, { layer: "led", step: 3, ex: UP(-240), info: info("Iris", "241-LED disc in the beam port (approx. size)") });
  const bz = plate("belly-bezel"); bz.position.z = PLATE_BOT - PT - 1.5 - AT;
  add(bz, { layer: "alu", step: 5, ex: UP(-900), info: cutInfo("belly-bezel") });
  // 8. deck, dome
  const dk = plate("deck-plate"); dk.position.z = DECK_Z;
  add(dk, { layer: "alu", step: 8, ex: UP(820), info: cutInfo("deck-plate") });
  const lip = annulus(666, 605, 3, M.dome); lip.position.z = LIP_Z;
  add(lip, { layer: "dome", step: 8, ex: UP(1120), info: info("Dome flange", "ID 605, OD 666 mm, bolted straight to the deck · 8 × M6 on a 25 in circle") });
  const domeG = new THREE.SphereGeometry(DOME_R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  const dome = new THREE.Mesh(domeG, M.dome); dome.position.z = DOME_BASE; dome.renderOrder = 3;
  add(dome, { layer: "dome", step: 8, ex: UP(1120), info: info("Dome", "24 × 12 in clear, the alien pilot's office") });
  const lipLed = new THREE.Mesh(new THREE.TorusGeometry(318, 3, 8, 96), M.ledW); lipLed.position.z = LIP_Z + 6;
  add(lipLed, { layer: "led", step: 8, ex: UP(1120), info: info("Dome lip LEDs", "~115 RGBW, warm white") });

  // ground: grid in 1 ft squares at the landed floor, a 5'10" person
  const grid = new THREE.GridHelper(304.8 * 20, 20, 0x6b7684, 0x3a414b);
  grid.rotation.x = Math.PI / 2; grid.position.z = FLOOR;
  add(grid, { layer: "ground", step: 1, info: info("Floor", "1 ft squares, landed mode (L + X legs)") });
  // scale figure: a flat 5'10" silhouette, the architect's kind, beside the saucer and turned to the 3D view
  const half = [[0, 1778], [62, 1764], [80, 1712], [78, 1650], [64, 1596], [44, 1566], [54, 1530], [140, 1488], [210, 1458], [228, 1392],
    [236, 1240], [242, 1090], [244, 950], [236, 830], [212, 790], [190, 806], [192, 950], [186, 1100], [172, 1270], [158, 1300],
    [148, 1150], [140, 1050], [164, 930], [170, 800], [158, 500], [140, 240], [128, 70], [170, 30], [172, 0], [28, 0], [38, 70],
    [44, 300], [38, 600], [18, 800], [0, 830]];
  const outline = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y])).map(([x, y]) => new THREE.Vector2(x, y));
  const personG = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 20, bevelEnabled: false }).translate(0, 0, -10).rotateX(Math.PI / 2);
  const person = new THREE.Mesh(personG, M.person);
  person.position.set(1250, 1150, FLOOR); person.rotation.z = 0.33;
  add(person, { layer: "ground", step: 1, info: info("Person, 5′10″", "for scale, standing on the floor") });

  // dimensions
  const dims = [];
  function dimLine(pts, at3, text) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    add(new THREE.LineSegments(g, dimMat), { layer: "dims", step: 1, info: info("Dimension", text) });
    const el = document.createElement("div");
    el.className = "dim-label"; el.textContent = text; $("labels").appendChild(el);
    dims.push({ p: at3, el });
  }
  const yD = -(K.R_O + 260), yF = K.R_O * T22;
  dimLine([V3(-K.R_O, yD, 0), V3(K.R_O, yD, 0), V3(-K.R_O, -yF, 0), V3(-K.R_O, yD - 40, 0), V3(K.R_O, -yF, 0), V3(K.R_O, yD - 40, 0)],
    V3(0, yD, 0), `${(2 * K.R_O / IN).toFixed(1)} in across the panel edges · rim ${(2 * RIM_O / IN).toFixed(1)} in`);
  const xH = K.R_O + 320, top = DOME_BASE + DOME_R;
  dimLine([V3(xH, 0, FLOOR), V3(xH, 0, top), V3(xH - 40, 0, top), V3(xH + 40, 0, top), V3(xH - 40, 0, -170), V3(xH + 40, 0, -170), V3(xH - 40, 0, FLOOR), V3(xH + 40, 0, FLOOR)],
    V3(xH, 0, (top - 170) / 2), `${((top + 170) / IN).toFixed(1)} in, leg posts to dome top`);
  dims.push({ p: V3(xH, 0, (-170 + FLOOR) / 2), el: Object.assign(document.createElement("div"), { className: "dim-label", textContent: `+ ${(400 / IN).toFixed(1)} in landed legs` }) });
  $("labels").appendChild(dims[dims.length - 1].el);
  const slopeTop = Math.atan(K.TAN) / D, slopeBelly = Math.atan(K.B_TAN) / D;
  $("dims").textContent = `${(2 * K.R_O / IN).toFixed(1)} in across · ${((top + 170) / IN).toFixed(1)} in tall (hung) · 16 panels on ${K.GAP} mm reveals · top ${slopeTop.toFixed(1)}°, belly ${slopeBelly.toFixed(1)}°`;

  // ---- steps -------------------------------------------------------------------------------------
  const STEPS = [
    "Rim octagon, core ring and 8 spokes, flush on top (A, D, B). A 135° bracket in every corner.",
    "Hub posts and hub ring (E, C), porthole posts (K), leg posts (L), and the pad eyes on the 4 lift spokes (J12).",
    "Box rails (H) and the IP67 box over the core ring. Plate legs (F), then the aluminum centre plate with the iris in the beam port.",
    "LED channels: line A round the rim's outer face, and 8 belly channels from each rim corner to a plate corner.",
    "Belly: T-nuts and standoffs in the rim's and spokes' bottom slots, 8 panels hung on them, inner edges clamped to the centre plate by the bezel (8 × M5).",
    "Porthole plates on the K posts with their LED rings and discs; 1 in standoffs in the rim's top slot and through each porthole plate.",
    "Top panels onto the rim and porthole standoffs, inner edges onto the hub ring. Caps on.",
    "Deck plate over the panels' inner edges (J5 × 8), then the dome lip bolted straight to the deck (8 × M6). Bridle to the 4 top pad eyes.",
  ];
  let step = STEPS.length;
  function setStep(s, animate) {
    const prev = step;
    step = Math.max(1, Math.min(STEPS.length, s));
    for (const it of items) {
      const vis = it.userData.step <= step;
      if (animate && vis && it.userData.step > prev) it.userData.arrive = 1;
      it.visible = vis;
    }
    $("stepNum").textContent = `${step} / ${STEPS.length}`;
    $("stepText").textContent = STEPS[step - 1];
  }

  // ---- UI ------------------------------------------------------------------------------------------
  const ul = $("layers");
  for (const L of Object.values(layer)) {
    const li = document.createElement("li");
    const lab = document.createElement("label");
    const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked: true });
    const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = L.colour;
    const tx = document.createElement("span"); tx.textContent = L.label;
    cb.addEventListener("change", () => { L.g.visible = cb.checked; if (L.id === "dims") $("labels").hidden = !cb.checked; });
    lab.append(cb, sw, tx);
    li.append(lab);
    ul.append(li);
  }
  const table = $("cutTable");
  let isolated = null;
  for (const [name, c] of Object.entries(CUT)) {
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.textContent = `${c.name} · ${cutSize(name)}`;
    const b = document.createElement("td"); b.className = "q"; b.textContent = `× ${c.qty}`;
    tr.append(a, b);
    tr.addEventListener("click", () => isolate(isolated === name ? null : name));
    tr.dataset.cut = name;
    table.append(tr);
  }
  function isolate(name) {
    isolated = name;
    for (const tr of table.rows) tr.classList.toggle("on", tr.dataset.cut === name);
    for (const it of items) {
      const keep = !name || it.userData.cut === name || it.userData.layer === "frame" || it.userData.layer === "ground" || it.userData.layer === "dims";
      it.visible = keep && it.userData.step <= step;
    }
    M.ext.transparent = !!name; M.ext.opacity = name ? 0.3 : 1; M.ext.needsUpdate = true;
    if (name) showInfo(cutInfo(name));
  }

  const ex = $("explode");
  let explode = 0, exTarget = null;
  ex.addEventListener("input", () => { explode = ex.value / 100; exTarget = null; });
  $("btnExplode").addEventListener("click", () => { exTarget = 1; zoomFor(1); });
  $("btnAssemble").addEventListener("click", () => { exTarget = 0; zoomFor(0); });
  $("stepPrev").addEventListener("click", () => setStep(step - 1));
  $("stepNext").addEventListener("click", () => setStep(step + 1, true));
  $("stepAll").addEventListener("click", () => setStep(STEPS.length));
  let playing = null;
  $("stepPlay").addEventListener("click", () => {
    if (playing) { clearInterval(playing); playing = null; $("stepPlay").textContent = "Play"; return; }
    exTarget = 0; setStep(1, false); for (const it of items) if (it.visible) it.userData.arrive = 1;
    $("stepPlay").textContent = "Stop";
    playing = setInterval(() => {
      if (step >= STEPS.length) { clearInterval(playing); playing = null; $("stepPlay").textContent = "Play"; return; }
      setStep(step + 1, true);
    }, 2200);
  });

  // views
  const TARGET = V3(-300, 60, 0);                 // a little left of centre: the panel covers the left of the screen
  const VIEWS = { iso: V3(3300, 2300, 3900), top: V3(0, 7000, 1), bottom: V3(0, -7000, 1), side: V3(0, 120, 7200) };
  let camAnim = null;
  // phones: the panel takes the bottom of the screen and the view is narrow, so stand further back
  const fit = () => (stage.clientWidth < 720 ? 2.4 : 1);
  const viewAt = (v) => TARGET.clone().addScaledVector(VIEWS[v].clone().sub(TARGET), fit());
  function goView(v) {
    camAnim = { from: camera.position.clone(), to: viewAt(v), tFrom: controls.target.clone(), t: 0 };
  }
  /** pull back for the exploded stack (about 3.2 m tall), come back in for the assembled saucer */
  function zoomFor(x) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    camAnim = { from: camera.position.clone(), to: TARGET.clone().addScaledVector(dir, 5300 * fit() * (1 + 0.55 * x)), tFrom: controls.target.clone(), t: 0 };
  }
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => goView(b.dataset.view)));

  const section = new THREE.Plane(V3(0, 0, -1), 0);   // world z <= 0 kept: the plan's +y half, cut along spokes 0 and 4
  $("optSection").addEventListener("change", (e) => { for (const m of MATS) { m.clippingPlanes = e.target.checked ? [section] : []; m.side = e.target.checked ? THREE.DoubleSide : m.userData.side ?? m.side; m.needsUpdate = true; } });
  for (const m of MATS) m.userData.side = m.side;
  $("optOrtho").addEventListener("change", (e) => {
    const next = e.target.checked ? ortho : persp;
    next.position.copy(camera.position); next.quaternion.copy(camera.quaternion);
    camera = next; controls.object = camera; fitOrtho(); controls.update();
  });
  function fitOrtho() {
    const dist = persp.position.distanceTo(controls.target);
    const h = dist * Math.tan((persp.fov / 2) * D), a = stage.clientWidth / stage.clientHeight;
    Object.assign(ortho, { left: -h * a, right: h * a, top: h, bottom: -h });
    ortho.updateProjectionMatrix();
  }
  function setNight(on) {
    document.body.classList.toggle("day", !on);
    scene.background = new THREE.Color(on ? 0x05070b : 0xdde3ea);
    hemi.intensity = on ? 0.12 : 0.7; sun.intensity = on ? 0.15 : 1.3;
    renderer.toneMappingExposure = on ? 0.9 : 1;
    for (const m of MATS) if (m.isMeshStandardMaterial) m.envMapIntensity = on ? 0.08 : 1;
    for (const m of LEDS) m.emissiveIntensity = on ? 1.3 : 0.45;
    M.poly.emissive = new THREE.Color(on ? 0x0a2a26 : 0x000000);
    M.disc.emissive = new THREE.Color(on ? 0x553a10 : 0x000000);
    edgeMat.color.set(on ? 0x4fd8c0 : 0x7d93a8);
  }
  $("optNight").addEventListener("change", (e) => setNight(e.target.checked));
  $("optFrost").addEventListener("change", (e) => { M.poly.opacity = e.target.checked ? 0.55 : 0.18; M.poly.roughness = e.target.checked ? 0.35 : 0.05; });
  $("optSpin").addEventListener("change", (e) => { controls.autoRotate = e.target.checked; });

  // picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $("tip");
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const cut = $("optSection").checked;
    for (const h of ray.intersectObjects(root.children, true)) {
      if (!h.object.isMesh || !shown(h.object)) continue;
      if (cut && h.point.z > 0.5) continue;
      return h.object.userData.item;
    }
    return null;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    const it = pick(ev);
    if (!it) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.replaceChildren();
    const b = document.createElement("b"); b.textContent = it.userData.info.name;
    tip.append(b, document.createElement("br"), document.createTextNode(it.userData.info.sub));
    tip.style.left = ev.clientX + 14 + "px"; tip.style.top = ev.clientY + 14 + "px";
  });
  renderer.domElement.addEventListener("pointerleave", () => { tip.hidden = true; });
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => { down = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 4) return;
    const it = pick(ev);
    if (it) showInfo(it.userData.info);
  });
  function showInfo(i) {
    const box = $("info");
    box.hidden = false; box.replaceChildren();
    const x = Object.assign(document.createElement("button"), { className: "x", textContent: "×" });
    x.addEventListener("click", () => { box.hidden = true; });
    const h = document.createElement("h3"); h.textContent = i.name;
    box.append(x, h);
    const line = (t) => { const p = document.createElement("p"); p.textContent = t; box.append(p); };
    line(i.sub);
    if (i.cut) { line(CUT[i.cut].mat); line(CUT[i.cut].note); }
  }

  // ---- loop ----------------------------------------------------------------------------------------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h);
    persp.aspect = w / h;
    if (w < 720) persp.setViewOffset(w, h, 0, h * 0.23, w, h); else persp.clearViewOffset();  // lift the ship above the panel
    persp.updateProjectionMatrix();
    if (camera === ortho) fitOrtho();
  }
  window.addEventListener("resize", resize);
  const v = V3();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (exTarget !== null) {
      explode += Math.sign(exTarget - explode) * Math.min(Math.abs(exTarget - explode), dt * 0.9);
      ex.value = Math.round(explode * 100);
      if (explode === exTarget) exTarget = null;
    }
    const e = explode * explode * (3 - 2 * explode);
    for (const it of items) {
      const u = it.userData;
      if (u.arrive > 0) u.arrive = Math.max(0, u.arrive - dt * 1.6);
      const drop = u.ex.lengthSq() > 0 ? u.ex : UP(300);
      const a = u.arrive * u.arrive;
      it.position.copy(u.base).addScaledVector(u.ex, e).addScaledVector(drop, a);
    }
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt * 1.6);
      const s = camAnim.t * camAnim.t * (3 - 2 * camAnim.t);
      camera.position.lerpVectors(camAnim.from, camAnim.to, s);
      controls.target.lerpVectors(camAnim.tFrom, TARGET, s);
      if (camAnim.t >= 1) camAnim = null;
    }
    controls.update();
    if (camera === ortho && camAnim) fitOrtho();
    renderer.render(scene, camera);
    if (layer.dims.g.visible) {
      const w = stage.clientWidth, h = stage.clientHeight;
      for (const d of dims) {
        v.copy(d.p).applyMatrix4(root.matrixWorld).project(camera);
        const off = v.z > 1 || v.z < -1;
        d.el.hidden = off;
        d.el.style.left = ((v.x + 1) / 2) * w + "px"; d.el.style.top = ((1 - v.y) / 2) * h + "px";
      }
    }
    requestAnimationFrame(frame);
  }

  controls.target.copy(TARGET);
  resize();
  camera.position.copy(viewAt("iso"));
  setNight($("optNight").checked);
  setStep(STEPS.length);
  requestAnimationFrame(frame);
  /** look at a point from a point, both in mm in the saucer's own z-up frame (rim top = 0) */
  function lookAt(from, to) {
    camAnim = null;
    controls.target.copy(V3(to[0], to[2], -to[1]));
    camera.position.copy(V3(from[0], from[2], -from[1]));
    controls.update();
  }
  window.UFO_VIEWER = { items, layer, setStep, isolate, goView, lookAt, setExplode: (x) => { explode = x; exTarget = null; ex.value = x * 100; } };
})();

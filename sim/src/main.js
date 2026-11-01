// UFO-25 LED show sim v2: three.js scene around the pure SHOW functions in show.js.
// World units are feet (y up, z toward the viewer). The saucer is built in inches inside a group scaled 1/12,
// over a path in a generic stand-in yard, tilted 12 deg toward the viewer.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as SH from "./show.js";
import TEX_TOP from "../assets/plan-top.jpg";
import TEX_TOP_UV from "../assets/plan-top-uv.jpg";
import TEX_BELLY from "../assets/plan-belly.jpg";
import TEX_BELLY_UV from "../assets/plan-belly-uv.jpg";

const MOBILE = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 600;
const SUPPLY_A = 40, WARN_A = 32, LIMIT_A = 30;
const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------------------------------------- renderer
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(MOBILE ? 50 : 40, innerWidth / innerHeight, 0.1, 900);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.9, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, rep, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8;
  return t;
}
let seedN = 7;
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
function noise(g, w, h, base, amp, blotch = 0) {
  const d = g.createImageData(w, h);
  for (let k = 0; k < w * h; k++) {
    const n = (rnd() - 0.5) * amp + (blotch ? Math.sin((k % w) * 0.05 + Math.floor(k / w) * 0.031) * blotch : 0);
    d.data[k * 4] = base[0] + n; d.data[k * 4 + 1] = base[1] + n; d.data[k * 4 + 2] = base[2] + n; d.data[k * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
}
const T = {
  concrete: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, [150, 148, 142], 26, 6); g.strokeStyle = "rgba(60,60,60,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 1); g.lineTo(w, 1); g.moveTo(1, 0); g.lineTo(1, h); g.stroke(); }, [1, 1]),
  asphalt: canvasTex(256, 256, (g, w, h) => noise(g, w, h, [52, 52, 55], 30), [1, 1]),
  mulch: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, [62, 46, 34], 46); for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${40 + rnd() * 50},${30 + rnd() * 30},${20 + rnd() * 20},.8)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 7, 1 + rnd() * 2); } }, [1, 1]),
  lawn: canvasTex(256, 256, (g, w, h) => noise(g, w, h, [52, 70, 38], 34), [1, 1]),
  stucco: canvasTex(256, 256, (g, w, h) => noise(g, w, h, [226, 222, 212], 14), [1, 1]),
  siding: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, [104, 62, 40], 22); g.fillStyle = "rgba(30,15,8,.55)"; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2); }, [1, 1]),
  bark: canvasTex(128, 512, (g, w, h) => { noise(g, w, h, [70, 60, 52], 36); for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(25,20,18,${0.3 + rnd() * 0.4})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 20 + rnd() * 90); } }, [2, 6]),
  door: canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#2a2622"; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 4, fr = 7;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = (c * w) / cols + fr, y = (r * h) / rows + fr, ww = w / cols - 2 * fr, hh = h / rows - 2 * fr;
      const gr = g.createLinearGradient(x, y, x, y + hh); gr.addColorStop(0, "#4b4f55"); gr.addColorStop(1, "#33363b");
      g.fillStyle = gr; g.fillRect(x, y, ww, hh);
    }
  }, [1, 1]),
  strand: canvasTex(64, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let y = 4; y < h - 4; y += 5) {
      const s = 1 - y / h * 0.35, side = (y / 5) % 2 ? 1 : -1;
      g.fillStyle = `rgb(${52 + rnd() * 30},${88 + rnd() * 40},${40 + rnd() * 20})`;
      g.save(); g.translate(w / 2, y); g.rotate(side * (0.9 + rnd() * 0.3)); g.beginPath(); g.ellipse(side * 10 * s, 0, 11 * s, 2.4 * s, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.fillStyle = "#3b4a2a"; g.fillRect(w / 2 - 1, 0, 2, h);
  }, null),
  clump: canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * w * 0.46;
      g.fillStyle = `rgb(${46 + rnd() * 34},${82 + rnd() * 46},${36 + rnd() * 22})`;
      g.save(); g.translate(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); g.rotate(rnd() * 6.3); g.beginPath(); g.ellipse(0, 0, 9, 2.2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, null),
};
T.door.wrapS = T.door.wrapT = THREE.ClampToEdgeWrapping;
const tl = new THREE.TextureLoader();
function planTex(src) { const t = tl.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const ART = { top: planTex(TEX_TOP), topUV: planTex(TEX_TOP_UV), belly: planTex(TEX_BELLY), bellyUV: planTex(TEX_BELLY_UV) };

// ---------------------------------------------------------------------------------------------------------- helpers
function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function plane(w, d, mat, x, z, y = 0, rep) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  if (rep) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / rep, uv.getY(k) * d / rep); }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); scene.add(m); return m;
}
function rod(a, b, r, mat, parent = scene) {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m); return m;
}
function taperedTube(points, r0, r1, segs = 40, radial = 10, mat) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), p = g.attributes.position, c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, c); const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r); }
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); scene.add(m); return { mesh: m, curve };
}
const std = (o) => new THREE.MeshStandardMaterial(o);

// ---------------------------------------------------------------------------------------------------------- sky
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: "uniform vec3 uTop,uHor,uGlow; varying vec3 vD; void main(){ float h = clamp(vD.y,0.,1.); vec3 c = mix(uHor,uTop,pow(h,.55)); c += uGlow*exp(-h*9.); gl_FragColor = vec4(c,1.); }",
}));
scene.add(sky);
const starG = new THREE.BufferGeometry(), starP = [];
for (let k = 0; k < 700; k++) { const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.4; starP.push(Math.cos(a) * Math.cos(e) * 560, Math.sin(e) * 560, Math.sin(a) * Math.cos(e) * 560); }
starG.setAttribute("position", new THREE.Float32BufferAttribute(starP, 3));
const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xc8d4ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }));
scene.add(stars);

// ---------------------------------------------------------------------------------------------------------- ground + backdrop
const M = {
  concrete: std({ map: T.concrete, roughness: 0.92 }), asphalt: std({ map: T.asphalt, roughness: 0.97 }),
  mulch: std({ map: T.mulch, roughness: 1 }), lawn: std({ map: T.lawn, roughness: 1 }),
  stucco: std({ map: T.stucco, roughness: 0.95 }), siding: std({ map: T.siding, roughness: 0.85 }),
  roof: std({ color: 0x2b2c2f, roughness: 0.9 }), fascia: std({ color: 0x1d1d1f, roughness: 0.7 }),
  door: std({ map: T.door, roughness: 0.45, metalness: 0.4 }), glass: std({ color: 0x0c0f14, roughness: 0.15, metalness: 0.6 }),
  metal: std({ color: 0x151515, roughness: 0.5, metalness: 0.7 }), bark: std({ map: T.bark, roughness: 0.96 }),
  black: std({ color: 0x0a0a0a, roughness: 0.6 }), warm: new THREE.MeshBasicMaterial({ color: 0x3a2610 }),
};
plane(400, 400, std({ color: 0x1e1f1a, roughness: 1 }), 0, 0, -0.02);
plane(19.5, 25, M.concrete, -10.25, 12.5, 0, 6);
plane(31, 19, M.mulch, 15, 15.5, 0.005, 5);
plane(31, 10, M.lawn, 15, 1, 0.004, 6);
plane(3.4, 19, M.concrete, 2.5, 15.5, 0.012, 3.4);
plane(120, 4, M.concrete, 0, 27, 0.01, 4);
box(120, 0.5, 0.5, M.concrete, 0, 0.25, 29.1);
plane(160, 60, M.asphalt, 0, 59.4, 0.0, 12);
// garage
box(18, 9.2, 18, M.stucco, -10, 4.6, -9);
const door = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.6), M.door); door.position.set(-10, 3.8, 0.02); scene.add(door);
box(19.6, 0.55, 20.2, M.roof, -10, 9.45, -8.3); box(19.6, 0.75, 0.25, M.fascia, -10, 9.35, 1.8);
// backdrop building
box(17, 10, 16, M.siding, 7.5, 5, -12); box(18, 0.55, 18, M.roof, 7.5, 10.25, -11.5);
for (const x of [2, 6, 10]) { box(3, 3.4, 0.1, M.glass, x, 5.2, -3.95); }
const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.0), new THREE.MeshBasicMaterial({ color: 0x3b2410 })); win.position.set(14, 5.2, -3.93); scene.add(win);
box(16, 9.6, 16, M.stucco, -6, 14, -18); box(17, 0.5, 17, M.roof, -6, 18.9, -18); box(10, 2.6, 0.1, M.glass, -6, 14.5, -9.95); for (const x of [-11, -8.5, -6, -3.5, -1]) box(0.14, 2.7, 0.16, M.fascia, x, 14.5, -9.9); box(10.2, 0.14, 0.16, M.fascia, -6, 15.82, -9.9); box(10.2, 0.14, 0.16, M.fascia, -6, 13.18, -9.9);
// fence + gate (black metal pickets), steel sail post by the gate
const pickets = []; for (let x = -0.6; x <= 18; x += 0.36) pickets.push(x);
const pk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 4, 0.06), M.metal, pickets.length);
pickets.forEach((x, k) => pk.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, 2, 6)));
scene.add(pk); box(18.8, 0.1, 0.1, M.metal, 8.7, 3.8, 6); box(18.8, 0.1, 0.1, M.metal, 8.7, 0.5, 6);
const POST_TOP = new THREE.Vector3(0.3, 10.6, 6.4);
rod(new THREE.Vector3(0.3, 0, 6.4), POST_TOP, 0.11, M.metal);
// a distant street light
rod(new THREE.Vector3(-36, 0, 31), new THREE.Vector3(-36, 15.5, 31), 0.2, M.metal);
const lampHead = box(1.6, 0.3, 0.7, new THREE.MeshBasicMaterial({ color: 0xffd8a0 }), -35.3, 15.5, 31);

// ---------------------------------------------------------------------------------------------------------- saucer
const G = { Ro: 47.04, Ri: 15.68, apo: 43.46, rimTop: 0.75, rimBot: -0.75, rise: 6.36, drop: 4, portR: 4.69, irisR: 3.35, domeR: 13.1, domeH: 11.8, riser: 4 };
G.hub = G.rimTop + G.rise; G.portY = G.rimBot - G.drop;
const corner = (k, R) => { const a = (22.5 + 45 * k) * D2R; return [R * Math.cos(a), R * Math.sin(a)]; };
const saucer = new THREE.Group();
saucer.position.set(2.5, 10.0, 14.3);
saucer.rotation.x = 12 * D2R;               // the fore side dips 12 deg
saucer.scale.setScalar(1 / 12);
scene.add(saucer);

function planarGeo(tris, mirror) {     // tris: [x,y,z]... ; UV = plan image: u = .5 + x/96 (mirrored for the belly), v = .5 - z/96
  const pos = new Float32Array(tris.flat()), uv = new Float32Array((pos.length / 3) * 2);
  for (let k = 0; k < pos.length / 3; k++) { const x = pos[k * 3], z = pos[k * 3 + 2]; uv[k * 2] = 0.5 + (mirror ? -x : x) / 96; uv[k * 2 + 1] = 0.5 - z / 96; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
const topTris = [], bellyTris = [], rimTris = [];
for (let k = 0; k < 8; k++) {
  const k2 = (k + 1) % 8, [ox, oz] = corner(k, G.Ro), [ox2, oz2] = corner(k2, G.Ro), [ix, iz] = corner(k, G.Ri), [ix2, iz2] = corner(k2, G.Ri);
  const A = [ox, G.rimTop, oz], B = [ox2, G.rimTop, oz2], Cc = [ix2, G.hub, iz2], D = [ix, G.hub, iz];
  topTris.push(A, Cc, B, A, D, Cc);
  const [px, pz] = corner(k, G.portR), [px2, pz2] = corner(k2, G.portR);
  const E = [ox, G.rimBot, oz], F = [ox2, G.rimBot, oz2], P1 = [px, G.portY, pz], P2 = [px2, G.portY, pz2];
  bellyTris.push(E, F, P2, E, P2, P1);
  rimTris.push(A, B, F, A, F, E);
}
const matTop = std({ side: THREE.DoubleSide, map: ART.top, roughness: 0.55, emissiveMap: ART.topUV, emissive: 0xffffff, emissiveIntensity: 0 });
const matBelly = std({ map: ART.belly, roughness: 0.55, emissiveMap: ART.bellyUV, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
// skins: "silver" = knitted aluminium shade cloth (aluminet, 99 %) on the top + blank white vinyl belly (2026-10-07);
// "white" = blank white vinyl all over; "print" = the older printed-vinyl art
const alum = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#a9adb2"; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 900; k++) {                     // crinkle: random lit / shaded foil patches
    const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 26, v = 120 + rnd() * 120;
    g.fillStyle = `rgba(${v},${v + 2},${v + 6},0.35)`; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * (0.6 + rnd()), y); g.lineTo(x, y + r); g.lineTo(x - r * (0.6 + rnd()), y); g.fill();
  }
  g.strokeStyle = "rgba(40,42,46,0.55)"; g.lineWidth = 1;   // the knit: diagonal strands
  for (let k = -h; k < w; k += 6) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
}, [5, 5]);
const alumRough = canvasTex(256, 256, (g, w, h) => noise(g, w, h, [95, 95, 95], 90), [9, 9], false);
const matTopSilver = std({ side: THREE.DoubleSide, map: alum, roughnessMap: alumRough, roughness: 0.42, metalness: 0.92, envMap: envTex, envMapIntensity: 1 });
const matWhite = () => std({ side: THREE.DoubleSide, color: 0xf0f0ea, roughness: 0.62, emissive: 0x8f8cff, emissiveIntensity: 0 });
const matTopWhite = matWhite(), matBellyWhite = matWhite();
const topMesh = new THREE.Mesh(planarGeo(topTris), matTopSilver), bellyMesh = new THREE.Mesh(planarGeo(bellyTris, true), matBellyWhite);
saucer.add(topMesh); saucer.add(bellyMesh);
function applySkin() {
  topMesh.material = S.skin === "silver" ? matTopSilver : S.skin === "white" ? matTopWhite : matTop;
  bellyMesh.material = S.skin === "print" ? matBelly : matBellyWhite;
}
const rimGeo = new THREE.BufferGeometry(); rimGeo.setAttribute("position", new THREE.Float32BufferAttribute(rimTris.flat(), 3)); rimGeo.computeVertexNormals();
saucer.add(new THREE.Mesh(rimGeo, std({ color: 0x8d8f94, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide })));
// hub cap, riser, port
const hubShape = new THREE.Shape(); for (let k = 0; k < 8; k++) { const [x, z] = corner(k, G.Ri); k ? hubShape.lineTo(x, z) : hubShape.moveTo(x, z); }
const hubCap = new THREE.Mesh(new THREE.ShapeGeometry(hubShape), M.black); hubCap.rotation.x = -Math.PI / 2; hubCap.position.y = G.hub + 0.02; saucer.add(hubCap);
const riser = new THREE.Mesh(new THREE.CylinderGeometry(G.domeR, G.domeR + 0.4, G.riser, 40), std({ color: 0x17171a, roughness: 0.5, metalness: 0.4 }));
riser.position.y = G.hub + G.riser / 2; saucer.add(riser);
const port = new THREE.Mesh(new THREE.CylinderGeometry(G.portR, G.portR, 1.4, 32, 1, true), std({ color: 0x050505, side: THREE.DoubleSide }));
port.position.y = G.portY + 0.7; saucer.add(port);
const irisBack = new THREE.Mesh(new THREE.CircleGeometry(G.portR, 32), std({ color: 0x030303 })); irisBack.rotation.x = Math.PI / 2; irisBack.position.y = G.portY + 1.35; saucer.add(irisBack);
// glass dome
const domeG = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2); domeG.scale(G.domeR, G.domeH, G.domeR);
const dome = new THREE.Mesh(domeG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.03, thickness: 0.4, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true }));
dome.position.y = G.hub + G.riser; saucer.add(dome);
// the alien
const alien = new THREE.Group(); alien.position.y = G.hub + G.riser; saucer.add(alien);
const skin = std({ color: 0x5fb33a, roughness: 0.45, emissive: 0x0c2a08 });
const headPts = [[0, 0], [1.1, 0.15], [1.5, 0.8], [2.0, 2.1], [2.9, 3.9], [3.55, 5.4], [3.7, 6.6], [3.3, 7.7], [2.3, 8.45], [0.9, 8.8], [0, 8.85]].map(([x, y]) => new THREE.Vector2(x, y));
const head = new THREE.Group(); head.position.y = 3.2; head.scale.setScalar(0.85); alien.add(head);
const headM = new THREE.Mesh(new THREE.LatheGeometry(headPts, 40), skin); head.add(headM); headM.scale.set(1, 1, 0.92);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3.6, 20), skin); neck.position.y = 1.8; alien.add(neck);
const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin); shoulders.scale.set(5.2, 2.2, 3.4); alien.add(shoulders);
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.08, clearcoat: 1, emissive: 0x000000 });
const eyes = [];
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), eyeMat); e.scale.set(1.35, 0.62, 0.55);
  e.position.set(s * 1.45, 4.5, 2.85); e.rotation.set(-0.15, s * 0.32, s * -0.5); head.add(e); eyes.push(e);
}

// ---------------------------------------------------------------------------------------------------------- LEDs
const LED = {};
function ledMesh(name, positions, radius, parent) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), positions.length);
  const mat = new THREE.Matrix4();
  positions.forEach((p, k) => { m.setMatrixAt(k, mat.makeTranslation(p[0], p[1], p[2])); m.setColorAt(k, new THREE.Color(0, 0, 0)); });
  m.frustumCulled = false; parent.add(m); LED[name] = { mesh: m, n: positions.length, pos: positions }; return m;
}
{ // rim: perimeter from the aft flat centre, clockwise from above (aft, port, fore, starboard)
  const poly = [[0, -G.apo]]; for (let k = 0; k < 8; k++) poly.push(corner((k + 6) % 8, G.Ro)); poly.push([0, -G.apo]);
  const segL = [], P = []; let tot = 0;
  for (let k = 0; k < poly.length - 1; k++) { const l = Math.hypot(poly[k + 1][0] - poly[k][0], poly[k + 1][1] - poly[k][1]); segL.push(l); tot += l; }
  for (let i = 0; i < 500; i++) {
    let d = (i / 500) * tot, k = 0; while (d > segL[k]) { d -= segL[k]; k++; }
    const f = d / segL[k], x = poly[k][0] + (poly[k + 1][0] - poly[k][0]) * f, z = poly[k][1] + (poly[k + 1][1] - poly[k][1]) * f, r = Math.hypot(x, z);
    P.push([x * (1 + 0.4 / r), 0, z * (1 + 0.4 / r)]);
  }
  ledMesh("rim", P, 0.42, saucer);
}

// ---------------------------------------------------------------------------------------------------------- 2026 rim
// The outer ring is a 2x4 laid flat, so the rim edge is 1.5" tall. Line A: a slim opal-covered channel (17 mm) on
// that edge. Line B: a second channel on the underside just inside the outer edge, facing down/out (halo + belly
// edge). Portholes: 16 on the top facets (2 per facet, mid-facet), each a frosted 4" window over a 16-LED ring.
const PERIM = (() => {   // perimeter walk, same convention as the rim strip: a = 0 at the aft face centre
  const poly = [[0, -G.apo]]; for (let k = 0; k < 8; k++) poly.push(corner((k + 6) % 8, G.Ro)); poly.push([0, -G.apo]);
  const L = []; let tot = 0; for (let k = 0; k < poly.length - 1; k++) { const l = Math.hypot(poly[k + 1][0] - poly[k][0], poly[k + 1][1] - poly[k][1]); L.push(l); tot += l; }
  return (a) => {
    let d = (((a % 1) + 1) % 1) * tot, k = 0; while (k < L.length - 1 && d > L[k]) { d -= L[k]; k++; }
    const f = d / L[k], x = poly[k][0] + (poly[k + 1][0] - poly[k][0]) * f, z = poly[k][1] + (poly[k + 1][1] - poly[k][1]) * f;
    const tx = (poly[k + 1][0] - poly[k][0]) / L[k], tz = (poly[k + 1][1] - poly[k][1]) / L[k];
    const face = (k === 0 || k === 8) ? 0 : k;                     // pieces 0 and 8 are the two halves of the aft face
    return { x, z, tx, tz, nx: tz, nz: -tx, face };                 // walk is clockwise from above: outward = (tz, -tx)
  };
})();
const band = new THREE.Group(); saucer.add(band);
const CH = { w: 0.67, d: 0.4 };                                    // 17 mm channel, ~10 mm deep
const LINES = {};
// a channel as a rectangular diffuser tube per straight run, vertex colours per pixel (smooth, no dots)
function buildLine(name, R, y, horiz, halo) {
  const n = SH.COUNTS[name], k = R / G.Ro, pos = [], idx = [], hpos = [], hidx = [];
  const P = []; for (let i = 0; i < n; i++) P.push(PERIM((i + 0.5) / n));
  const hu = horiz ? CH.w / 2 : CH.d / 2, hv = horiz ? CH.d / 2 : CH.w / 2;   // radial / vertical half sizes
  for (let i = 0; i < n; i++) {
    const p = P[i], cx = p.x * k, cz = p.z * k;
    for (const [du, dv] of [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]]) pos.push(cx + p.nx * du, y + dv, cz + p.nz * du);
    if (halo) for (const dr of [-7, 0, 5]) hpos.push(cx + p.nx * dr, y - hv - 0.6, cz + p.nz * dr);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n; if (P[i].face !== P[j].face) continue;     // each straight run ends at a corner
    for (let q = 0; q < 4; q++) { const a = i * 4 + q, b = i * 4 + ((q + 1) % 4), c = j * 4 + ((q + 1) % 4), d = j * 4 + q; idx.push(a, b, c, a, c, d); }
    if (halo) for (let q = 0; q < 2; q++) { const a = i * 3 + q, b = i * 3 + q + 1, c = j * 3 + q + 1, d = j * 3 + q; hidx.push(a, b, c, a, c, d); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const col = new Float32Array(n * 4 * 3); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  band.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })));
  const L = { n, col, g, hcol: null, hg: null };
  if (halo) {   // the light Line B throws on the belly edge: an additive sheet just below it, coloured row in the middle
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(hpos, 3)); hg.setIndex(hidx);
    L.hcol = new Float32Array(n * 3 * 3); hg.setAttribute("color", new THREE.BufferAttribute(L.hcol, 3)); L.hg = hg;
    band.add(new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  }
  LINES[name] = L;
}
buildLine("lineA", G.Ro + 0.25, 0, false, false);
buildLine("lineB", G.Ro - 1.6, G.rimBot - CH.d / 2, true, true);
// portholes on the top facets: frame (t along the facet, u up-slope to the hub, n out of the skin)
const crewTex = (crew) => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "#c8c8c8"); gr.addColorStop(0.62, "#ffffff"); gr.addColorStop(0.8, "#ffffff"); gr.addColorStop(1, "#8a8a8a");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (crew) {
    g.filter = "blur(2.5px)"; g.fillStyle = "rgba(0,0,0,0.88)";
    g.beginPath(); g.ellipse(64, 50, 21, 27, 0, 0, Math.PI * 2); g.fill();          // the big head
    g.beginPath(); g.moveTo(58, 72); g.lineTo(70, 72); g.lineTo(72, 92); g.lineTo(56, 92); g.fill();   // neck
    g.beginPath(); g.ellipse(64, 122, 44, 30, 0, Math.PI, 0); g.fill();              // shoulders
    g.filter = "none";
  }
}, null);
const WINR = 2.0, WIN_OFF = 6.5;
function winFrame(w) {
  const m = w >> 1, side = w & 1 ? 1 : -1, p = PERIM(m / 8), r = Math.hypot(p.x, p.z), ox = p.x / r, oz = p.z / r;
  const outer = new THREE.Vector3(ox * G.apo, G.rimTop, oz * G.apo), inner = new THREE.Vector3(ox * (G.apo * G.Ri / G.Ro), G.hub, oz * (G.apo * G.Ri / G.Ro));
  const t = new THREE.Vector3(p.tx, 0, p.tz), u = inner.clone().sub(outer).normalize(), n = new THREE.Vector3().crossVectors(t, u).normalize();
  if (n.y < 0) n.negate();
  const c = outer.clone().lerp(inner, 0.42).addScaledVector(t, side * WIN_OFF).addScaledVector(n, 0.12);
  return { c, t, u, n };
}
const WIN = { meshes: [] };
for (const crew of [false, true]) {
  const ws = []; for (let w = 0; w < 16; w++) if (SH.CREW.includes(w) === crew) ws.push(w);
  const pos = [], uv = [], idx = [], col = new Float32Array(ws.length * 17 * 3);
  ws.forEach((w, m) => {
    const { c, t, u } = winFrame(w), base = m * 17;
    pos.push(c.x, c.y, c.z); uv.push(0.5, 0.5);
    for (let j = 0; j < 16; j++) { const th = (j / 16) * Math.PI * 2, a = Math.cos(th), b = Math.sin(th); pos.push(c.x + (t.x * a + u.x * b) * WINR, c.y + (t.y * a + u.y * b) * WINR, c.z + (t.z * a + u.z * b) * WINR); uv.push(0.5 + 0.5 * a, 0.5 + 0.5 * b); }
    for (let j = 0; j < 16; j++) idx.push(base, base + 1 + j, base + 1 + ((j + 1) % 16));
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  band.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: crewTex(crew), vertexColors: true, toneMapped: false, side: THREE.DoubleSide })));
  WIN.meshes.push({ ws, col, g });
}
{ // porthole rims: black bezel ring + 8 bolts, in the facet plane
  const bezelM = std({ color: 0x141416, roughness: 0.35, metalness: 0.6 }), boltM = std({ color: 0x9c9ca0, roughness: 0.3, metalness: 0.9 });
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), boltM, 16 * 8), m4 = new THREE.Matrix4(); let bi = 0;
  for (let w = 0; w < 16; w++) {
    const { c, t, u, n } = winFrame(w), basis = new THREE.Matrix4().makeBasis(t, u, n);
    const ring = new THREE.Mesh(new THREE.RingGeometry(WINR - 0.05, WINR + 0.65, 40), bezelM);
    ring.quaternion.setFromRotationMatrix(basis); ring.position.copy(c).addScaledVector(n, 0.02); band.add(ring);
    for (let j = 0; j < 8; j++) { const th = (j / 8) * Math.PI * 2 + Math.PI / 8, a = Math.cos(th) * (WINR + 0.33), b = Math.sin(th) * (WINR + 0.33);
      bolts.setMatrixAt(bi++, m4.makeTranslation(c.x + t.x * a + u.x * b + n.x * 0.1, c.y + t.y * a + u.y * b + n.y * 0.1, c.z + t.z * a + u.z * b + n.z * 0.1)); }
  }
  band.add(bolts);
}
{ // along each belly seam (ring corner to port corner), riding 0.45" proud of the vinyl
  const yAt = (r) => G.rimBot - G.drop * (G.Ro - r) / (G.Ro - G.portR), P = [];
  for (let s = 0; s < 8; s++) for (let j = 0; j < SH.SPOKE_N; j++) { const r = (G.Ro - 1.2) + ((G.portR + 0.8) - (G.Ro - 1.2)) * (j / (SH.SPOKE_N - 1)), [x, z] = corner(s, r); P.push([x, yAt(r) - 0.45, z]); }
  ledMesh("spokes", P, 0.42, saucer); }
{ const P = SH.IRIS_POS.map(([r, a]) => { const rr = (r / 8) * G.irisR, ph = a * Math.PI * 2; return [rr * Math.cos(ph), G.portY + 0.9, rr * Math.sin(ph)]; }); ledMesh("iris", P, 0.17, saucer); }
{ const P = []; for (let i = 0; i < 100; i++) { const a = (i / 100) * Math.PI * 2; P.push([11.9 * Math.cos(a), G.hub + G.riser + 0.35, 11.9 * Math.sin(a)]); } ledMesh("cockpit", P, 0.3, saucer); }
ledMesh("eyes", [[-1.2, G.hub + G.riser + 6.9, 2.2], [1.2, G.hub + G.riser + 6.9, 2.2]], 0.05, saucer).visible = false;   // drawn as the alien's eye glow

// beam geometry: where the spot (axis = saucer -y) meets the ground
saucer.updateMatrixWorld(true);
const APEX = saucer.localToWorld(new THREE.Vector3(0, G.portY + 0.6, 0));
const AXIS = new THREE.Vector3(0, -1, 0).applyQuaternion(saucer.quaternion).normalize();
const BEAM_LEN = APEX.y / -AXIS.y, HIT = APEX.clone().addScaledVector(AXIS, BEAM_LEN), BEAM_HALF = 10.5 * D2R;

// ---------------------------------------------------------------------------------------------------------- tree + hanger
const BRIDLE = saucer.localToWorld(new THREE.Vector3(0, 36, 0));
const HANG = BRIDLE.clone().add(new THREE.Vector3(0, 4.2, 0));
const branches = [];
branches.push(taperedTube([new THREE.Vector3(8.8, -0.5, 13.2), new THREE.Vector3(8.2, 4, 13.6), new THREE.Vector3(7.0, 8.5, 14.0), new THREE.Vector3(5.6, 12.4, HANG.z), new THREE.Vector3(4.2, 15.0, HANG.z), new THREE.Vector3(HANG.x + 0.3, HANG.y + 0.15, HANG.z), new THREE.Vector3(HANG.x - 2.2, HANG.y + 0.9, HANG.z + 0.3)], 0.75, 0.09, 60, 12, M.bark));
branches.push(taperedTube([new THREE.Vector3(9.2, -0.5, 12.8), new THREE.Vector3(10.4, 6, 12.0), new THREE.Vector3(12.4, 12, 11.0), new THREE.Vector3(13.6, 16.5, 9.8), new THREE.Vector3(14.0, 19.5, 9)], 0.62, 0.08, 50, 10, M.bark));
branches.push(taperedTube([new THREE.Vector3(9.0, -0.5, 13.5), new THREE.Vector3(9.7, 7, 15.2), new THREE.Vector3(9.4, 13, 17.6), new THREE.Vector3(8.2, 16.8, 19.2), new THREE.Vector3(7.0, 18.6, 20)], 0.55, 0.07, 50, 10, M.bark));
branches.push(taperedTube([new THREE.Vector3(7.6, 9.5, 14.0), new THREE.Vector3(7.8, 13.5, 11.5), new THREE.Vector3(8.6, 17.5, 9.5)], 0.22, 0.05, 30, 8, M.bark));
branches.push(taperedTube([new THREE.Vector3(12.0, 11, 11.3), new THREE.Vector3(15, 14, 13), new THREE.Vector3(17.5, 15.5, 15)], 0.2, 0.05, 30, 8, M.bark));
const rigMat = std({ color: 0x050505, roughness: 0.8 });
rod(BRIDLE, HANG, 0.035, rigMat);
for (const k of [1, 4, 6]) { const [x, z] = corner(k, G.Ro - 1); rod(BRIDLE, saucer.localToWorld(new THREE.Vector3(x, G.rimTop, z)), 0.025, rigMat); }
{ const [x, z] = corner(5, G.Ro - 1); rod(saucer.localToWorld(new THREE.Vector3(x, 0, z)), POST_TOP, 0.022, rigMat); }
// foliage: weeping strands + canopy clumps, swaying
const swayU = { uTime: { value: 0 } };
function sway(mat, amp) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = swayU.uTime;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
       float w = (1.0 - uv.y) * ${amp.toFixed(3)};
       transformed.x += sin(uTime * 1.1 + ph) * w; transformed.z += cos(uTime * 0.8 + ph * 1.3) * w * 0.6;`);
  };
  return mat;
}
const strandMat = sway(std({ map: T.strand, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: 0xb9c9a8 }), 0.25);
const clumpMat = sway(std({ map: T.clump, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: 0xaab89a }), 0.08);
{
  const anchors = [];
  for (const b of branches) for (let k = 0; k < 70; k++) { const t = 0.35 + 0.65 * rnd(); anchors.push(b.curve.getPointAt(t).add(new THREE.Vector3((rnd() - 0.5) * 2.5, (rnd() - 0.2) * 1.4, (rnd() - 0.5) * 2.5))); }
  for (let k = 0; k < (MOBILE ? 260 : 520); k++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); anchors.push(new THREE.Vector3(9.5 + Math.cos(a) * r * 7.5, 15.5 + rnd() * 4.5, 14 + Math.sin(a) * r * 7)); }
  const keep = anchors.filter((p) => !(Math.hypot(p.x - saucer.position.x, p.z - saucer.position.z) < 4.8 && p.y < 17.5) && p.x > -0.5);
  const sm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 1).translate(0, -0.5, 0), strandMat, keep.length);
  const cm = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 3.2), clumpMat, keep.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  keep.forEach((p, k) => {
    const near = Math.hypot(p.x - saucer.position.x, p.z - saucer.position.z) < 6.5;
    const len = near ? 1.5 + rnd() * 2 : 3.5 + rnd() * 5.5;
    e.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.12); q.setFromEuler(e); s.set(1 + rnd() * 0.6, len, 1);
    sm.setMatrixAt(k, m4.compose(p, q, s));
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI); q.setFromEuler(e); s.setScalar(0.7 + rnd() * 0.8);
    cm.setMatrixAt(k, m4.compose(p.clone().add(new THREE.Vector3(0, 0.6, 0)), q, s));
  });
  scene.add(sm); scene.add(cm);
}
// shrubs: a dark rounded core wrapped in leafy clump cards, so they read as foliage, not rocks
{
  const geo = new THREE.IcosahedronGeometry(1, 4), p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k), n = 0.86 + 0.16 * Math.sin(v.x * 4.1) * Math.cos(v.y * 3.3 + v.z * 2.7); p.setXYZ(k, v.x * n, v.y * n * 0.8, v.z * n); }
  geo.computeVertexNormals();
  const spots = [];
  for (let k = 0; k < 46; k++) { const x = 5.2 + rnd() * 10, z = 7 + rnd() * 16; if (!(z > 19 && x < 7)) spots.push([x, z, 1.2 + rnd() * 1.6]); }
  for (let x = -0.3; x < 18; x += 1.8) spots.push([x + rnd(), 5.2 + rnd() * 0.4, 1.0 + rnd() * 0.8]);
  const im = new THREE.InstancedMesh(geo, std({ color: 0x1f3518, roughness: 1 }), spots.length);
  const cards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.3), std({ map: T.clump, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0x9fb08e }), spots.length * 14);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(); let c = 0;
  spots.forEach(([x, z, r], k) => {
    im.setMatrixAt(k, m4.compose(new THREE.Vector3(x, r * 0.5, z), q.identity(), new THREE.Vector3(r * 0.85, r * 0.85, r * 0.85)));
    for (let j = 0; j < 14; j++) {
      const a = rnd() * Math.PI * 2, el = rnd() * 1.2, rr = r * (0.75 + rnd() * 0.25);
      const pos = new THREE.Vector3(x + Math.cos(a) * Math.cos(el) * rr, r * 0.5 + Math.sin(el) * rr * 0.8, z + Math.sin(a) * Math.cos(el) * rr);
      e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI); q.setFromEuler(e);
      cards.setMatrixAt(c, m4.compose(pos, q, new THREE.Vector3(r, r, r))); cards.setColorAt(c, col.setHSL(0.25 + rnd() * 0.07, 0.35, 0.5 + rnd() * 0.25)); c++;
    }
  });
  q.identity();
  scene.add(im); scene.add(cards);
}
// fog machine + the two UV floods, tucked in the shrubs
const FOG_SRC = new THREE.Vector3(5.4, 0.45, 12.6);
box(1.1, 0.7, 0.8, M.black, FOG_SRC.x + 0.5, 0.35, FOG_SRC.z);
const FLOODS = [new THREE.Vector3(5.6, 0.35, 16.2), new THREE.Vector3(5.8, 0.35, 10.6)];
FLOODS.forEach((f) => box(0.7, 0.45, 0.35, M.black, f.x, f.y, f.z));

// ---------------------------------------------------------------------------------------------------------- the kid (draggable)
const kid = new THREE.Group();
{
  const suit = std({ color: 0xe9e7e2, roughness: 0.7 }), visor = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.25, 6, 16), suit); body.position.y = 1.55; kid.add(body);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 10), suit); leg.position.set(s * 0.2, 0.55, 0); kid.add(leg); }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), suit); helm.position.y = 3.05; kid.add(helm);
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16, -0.9, 1.8, 0.7, 1.3), visor); vis.position.set(0, 3.05, 0.1); kid.add(vis);
  const pack = box(0.7, 0.9, 0.3, suit, 0, 1.8, -0.45, kid);
  kid.position.set(HIT.x + 1.5, 0, HIT.z + 4.6); kid.rotation.y = Math.PI * 0.9;
}
scene.add(kid);
const PERSON = { left: [-1.5, 0.9], centre: [0, 0.3], right: [1.5, 0.9] };

// ---------------------------------------------------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight(0x2a3550, 0x0d0c0a, 0.4); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb3ff, 0.25); moon.position.set(-40, 60, -30); scene.add(moon);
const sun = new THREE.DirectionalLight(0xfff1dc, 0); sun.position.set(30, 50, 40); scene.add(sun);
const street = new THREE.PointLight(0xffb066, 0, 0, 2); street.position.set(-35.3, 15, 31); scene.add(street);
const winLight = new THREE.PointLight(0xffa04a, 0, 0, 2); winLight.position.set(14, 5, -2.8); scene.add(winLight);
function pl(parent, x, y, z) { const l = new THREE.PointLight(0xffffff, 0, 0, 2); l.position.set(x, y, z); parent.add(l); return l; }
const L = {
  rim: [pl(saucer, 0, 2, -G.apo - 18), pl(saucer, G.apo + 18, 2, 0), pl(saucer, 0, 2, G.apo + 18), pl(saucer, -G.apo - 18, 2, 0)],
  spokes: pl(saucer, 0, G.portY - 30, 0), iris: pl(saucer, 0, G.portY - 6, 0), cockpit: pl(saucer, 0, G.hub + G.riser + 3, 0),
};
const spot = new THREE.SpotLight(0xf2fbff, 0, 0, BEAM_HALF * 1.15, 0.45, 2); spot.position.copy(APEX); scene.add(spot); spot.target.position.copy(HIT); scene.add(spot.target);
const uvSpots = FLOODS.map((f) => { const s = new THREE.SpotLight(0x6a3cff, 0, 0, 0.55, 0.6, 2); s.position.copy(f).add(new THREE.Vector3(0, 0.3, 0)); s.target.position.copy(saucer.position); scene.add(s); scene.add(s.target); return s; });

// ---------------------------------------------------------------------------------------------------------- beam, fog, motes
const NOISE_GLSL = `
float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ return .55*n3(p) + .3*n3(p*2.1) + .15*n3(p*4.3); }`;
const beamU = { uLevel: { value: 0 }, uFog: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0xeaf8ff) } };
const beamGeo = new THREE.ConeGeometry(BEAM_LEN * Math.tan(BEAM_HALF), BEAM_LEN, 64, 24, true); beamGeo.translate(0, -BEAM_LEN / 2, 0);
const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
  uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  vertexShader: `varying vec3 vW; varying vec3 vN; varying float vA; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vA = -position.y/${BEAM_LEN.toFixed(3)}; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uLevel,uFog,uTime; uniform vec3 uColor; varying vec3 vW; varying vec3 vN; varying float vA; ${NOISE_GLSL}
    void main(){ vec3 v = normalize(cameraPosition - vW); float edge = pow(abs(dot(normalize(vN), v)), 1.6);
      float n = fbm(vW*1.3 + vec3(0., uTime*0.55, uTime*0.12));
      float dens = 0.04 + uFog*(0.35 + 0.6*n);
      float a = uLevel * edge * dens * mix(1.25, 0.45, vA) * smoothstep(1.0, 0.92, vA);
      gl_FragColor = vec4(uColor * a * 0.95, a); }`,
}));
beam.position.copy(APEX); beam.quaternion.copy(saucer.quaternion); scene.add(beam);
// a soft pool where the beam lands
const pool = new THREE.Mesh(new THREE.CircleGeometry(BEAM_LEN * Math.tan(BEAM_HALF) * 1.6, 48), new THREE.ShaderMaterial({
  uniforms: { uLevel: beamU.uLevel }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
  fragmentShader: "uniform float uLevel; varying vec2 vU; void main(){ float r = length(vU-.5)*2.; float a = uLevel*exp(-r*r*3.)*.55; gl_FragColor = vec4(vec3(.9,.97,1.)*a, a); }",
}));
pool.rotation.x = -Math.PI / 2; pool.position.set(HIT.x, 0.05, HIT.z); scene.add(pool);

const FOG_N = MOBILE ? 160 : 300;
const fogPos = new Float32Array(FOG_N * 3), fogA = new Float32Array(FOG_N), fogS = new Float32Array(FOG_N), fogV = [], fogAge = new Float32Array(FOG_N).fill(99), fogLife = new Float32Array(FOG_N);
for (let k = 0; k < FOG_N; k++) fogV.push(new THREE.Vector3());
const fogGeo = new THREE.BufferGeometry();
fogGeo.setAttribute("position", new THREE.BufferAttribute(fogPos, 3)); fogGeo.setAttribute("aA", new THREE.BufferAttribute(fogA, 1)); fogGeo.setAttribute("aS", new THREE.BufferAttribute(fogS, 1));
const fogU = { uApex: { value: APEX }, uAxis: { value: AXIS }, uTan: { value: Math.tan(BEAM_HALF) }, uBeam: { value: 0 }, uBeamC: { value: new THREE.Color(0xeaf8ff) },
  uAmb: { value: new THREE.Color(0.02, 0.025, 0.04) },
  uUV: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uRimP: { value: saucer.position.clone() }, uScale: { value: 1 } };
const fog = new THREE.Points(fogGeo, new THREE.ShaderMaterial({
  uniforms: fogU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: `attribute float aA; attribute float aS; uniform vec3 uApex,uAxis,uBeamC,uAmb,uUV,uRim,uRimP; uniform float uTan,uBeam,uScale; varying vec3 vC; varying float vA;
    void main(){ vec3 v = position - uApex; float al = dot(v,uAxis); float pr = length(v - uAxis*al);
      float inside = al > 0. ? smoothstep(al*uTan*1.25, al*uTan*0.55, pr) : 0.;
      float dr = distance(position, uRimP);
      vC = uAmb + uBeamC*uBeam*inside*0.6 + uUV*0.35 + uRim*exp(-dr*dr/30.)*0.5;
      vA = aA; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aS*uScale/(-mv.z); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-.5; float r = dot(d,d)*4.; float a = vA*exp(-r*2.5)*(1.-r); if(a<=0.) discard; gl_FragColor = vec4(vC*a, a); }",
}));
fog.frustumCulled = false; scene.add(fog);

const MOTE_N = 90, motePos = new Float32Array(MOTE_N * 3), moteS = new Float32Array(MOTE_N), moteAng = new Float32Array(MOTE_N), moteR = new Float32Array(MOTE_N);
for (let k = 0; k < MOTE_N; k++) { moteS[k] = rnd(); moteAng[k] = rnd() * Math.PI * 2; moteR[k] = Math.sqrt(rnd()) * 0.85; }
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
const moteMat = new THREE.PointsMaterial({ color: new THREE.Color(3, 3.2, 3.6), size: MOBILE ? 4 : 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; scene.add(motes);

// ---------------------------------------------------------------------------------------------------------- camera + interaction
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.92; controls.minDistance = 4; controls.maxDistance = 90;
const VIEWS = {
  street: { p: [-2.5, 6.4, 41], t: [3.4, 6.2, 13.5], fov: 40 },
  gate: { p: [-2.2, 3.6, 22.0], t: [2.6, 5.8, 12.6], fov: 70 },
  free: { p: [19, 10, 31], t: [3, 7, 13], fov: 40 },
};
let viewName = "street", camAnim = null;
function setView(name, instant) {
  viewName = name; const v = VIEWS[name];
  const to = { p: new THREE.Vector3(...v.p), t: new THREE.Vector3(...v.t), fov: v.fov + (MOBILE ? 10 : 0) };
  if (MOBILE && name === "street") to.p.z += 8;
  if (instant) { camera.position.copy(to.p); controls.target.copy(to.t); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); camAnim = null; }
  else camAnim = { from: { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov }, to, k: 0 };
  syncButtons();
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragging = false;
function pick(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
canvas.addEventListener("pointerdown", (e) => { pick(e); if (ray.intersectObject(kid, true).length) { dragging = true; controls.enabled = false; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener("pointermove", (e) => { if (!dragging) return; pick(e); const p = new THREE.Vector3(); if (ray.ray.intersectPlane(groundPlane, p)) { kid.position.set(THREE.MathUtils.clamp(p.x, -8, 16), 0, THREE.MathUtils.clamp(p.z, 7, 28)); } });
const endDrag = () => { dragging = false; controls.enabled = true; };
canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

// ---------------------------------------------------------------------------------------------------------- UI
const CAP_DEFAULT = { 2025: 0.55, 2026: 0.42 };   // keeps the abduction peak under ~30 A; only FLASH hits the limiter
const S = { band: true, skin: "silver", st: SH.makeState(25), cap: CAP_DEFAULT[2026], night: true, uv: true, fogOn: true, auto: false, autoT: 0, peak: [], pending: {}, fogAmt: 0 };
const $ = (id) => document.getElementById(id);
const B = {};
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function grp(label) { const g = el("div", "grp"); g.append(el("span", "", label)); $("panel").append(g); return g; }
function btn(g, key, label, fn, cls) { const b = el("button", cls || "", label); b.addEventListener("click", fn); g.append(b); B[key] = b; return b; }
{
  const g1 = grp("Show");
  for (const m of ["idle", "approach", "abduction", "cooldown"]) btn(g1, m, m[0].toUpperCase() + m.slice(1), () => { S.pending.mode = m; S.pending.seq = false; S.auto = false; syncButtons(); });
  btn(g1, "go", "Camera: someone at the gate", () => { S.pending.mode = "approach"; S.pending.seq = true; }, "go");
  btn(g1, "auto", "Auto demo", () => { S.auto = !S.auto; S.autoT = 0; syncButtons(); });
  const g2 = grp("Idle events");
  for (const ev of ["sputter", "comms", "search"]) btn(g2, "ev-" + ev, { sputter: "Power sputter", comms: "Comms burst", search: "Search sweep" }[ev], () => { S.pending.event = ev; });
  const g3 = grp("Person");
  for (const k of ["left", "centre", "right"]) btn(g3, "p-" + k, k[0].toUpperCase() + k.slice(1), () => { kid.position.set(HIT.x + PERSON[k][0], 0, HIT.z + PERSON[k][1]); });
  const g4 = grp("View");
  btn(g4, "v-street", "From the street", () => setView("street")); btn(g4, "v-gate", "Below, looking up", () => setView("gate")); btn(g4, "v-free", "Free", () => setView("free"));
  const g5 = grp("Scene");
  btn(g5, "night", "Night", () => { S.night = !S.night; applyScene(); syncButtons(); });
  btn(g5, "uv", "UV floods", () => { S.uv = !S.uv; syncButtons(); });
  btn(g5, "fog", "Fog machine", () => { S.fogOn = !S.fogOn; syncButtons(); });
  btn(g5, "rim", "Rim: 2026 rim", () => { S.band = !S.band; applyRim(); syncButtons(); });
  btn(g5, "skin", "Skin: silver top", () => { S.skin = { silver: "white", white: "print", print: "silver" }[S.skin]; applySkin(); syncButtons(); });
  const g6 = grp("Brightness cap");
  const r = el("input"); r.type = "range"; r.min = "10"; r.max = "100"; r.value = String(S.cap * 100);
  const lab = el("span", "cap", Math.round(S.cap * 100) + "%");
  r.addEventListener("input", () => { S.cap = Number(r.value) / 100; lab.textContent = r.value + "%"; S.peak = []; });
  g6.append(r, lab); S.capEl = r; S.capLab = lab;
}
function syncButtons() {
  for (const m of ["idle", "approach", "abduction", "cooldown"]) B[m].classList.toggle("on", S.st.mode === m);
  B.auto.classList.toggle("on", S.auto);
  for (const v of ["street", "gate", "free"]) B["v-" + v].classList.toggle("on", viewName === v);
  B.night.textContent = S.night ? "Night" : "Day"; B.night.classList.add("on");
  B.uv.classList.toggle("on", S.uv); B.fog.classList.toggle("on", S.fogOn);
  B.rim.textContent = S.band ? "Rim: 2026 rim" : "Rim: 2025 strip"; B.rim.classList.toggle("on", S.band);
  B.skin.textContent = { silver: "Skin: silver top", white: "Skin: white vinyl", print: "Skin: printed (old)" }[S.skin];
}

function applyRim() {
  band.visible = S.band; LED.rim.mesh.visible = !S.band; peakWin.length = 0;
  S.cap = CAP_DEFAULT[S.band ? 2026 : 2025]; S.capEl.value = String(Math.round(S.cap * 100)); S.capLab.textContent = Math.round(S.cap * 100) + "%";
}
function applyScene() {
  const n = S.night;
  skyU.uTop.value.set(n ? 0x03040a : 0x4f8fd6); skyU.uHor.value.set(n ? 0x111628 : 0xcfe2f3); skyU.uGlow.value.set(n ? 0x2a1d18 : 0x000000);
  stars.visible = n;
  hemi.color.set(n ? 0x2a3550 : 0xbfd8ff); hemi.groundColor.set(n ? 0x0d0c0a : 0x4a4436); hemi.intensity = n ? 0.1 : 1.0;
  M.stucco.color.set(n ? 0x8a867e : 0xd8d4cc);
  moon.intensity = n ? 0.14 : 0; sun.intensity = n ? 0 : 1.9;
  street.intensity = n ? 520 : 0; winLight.intensity = n ? 9 : 0; lampHead.visible = true;
  win.material.color.set(n ? 0x8a5420 : 0x1a1d22);
  scene.environment = n ? null : envTex; scene.environmentIntensity = 0.8;   // the room env's light panels show up as squares in the dome at night
  renderer.toneMappingExposure = n ? 1.0 : 0.95;
  bloom.strength = n ? 0.9 : 0.3; bloom.threshold = n ? 0.85 : 1.2;
}

// ---------------------------------------------------------------------------------------------------------- frame
const BUF = {}; for (const s of Object.keys(SH.COUNTS)) BUF[s] = new Float32Array(SH.COUNTS[s] * 3);
const O = [0, 0, 0], tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
function avg(seg, from = 0, to = SH.COUNTS[seg]) { const b = BUF[seg]; let r = 0, g = 0, bl = 0; for (let k = from; k < to; k++) { r += b[k * 3]; g += b[k * 3 + 1]; bl += b[k * 3 + 2]; } const n = to - from; return [r / n / 255, g / n / 255, bl / n / 255]; }

let last = performance.now(), simT = 0;
function step(dt) {
  // inputs to the show: where is the person, in the saucer's frame and as a rim perimeter fraction
  tmpV.copy(kid.position).setY(0); const loc = saucer.worldToLocal(tmpV.clone());
  const look = [THREE.MathUtils.clamp(loc.x / 96, -1, 1), THREE.MathUtils.clamp(loc.z / 96, -1, 1)];
  let personA = 0.5, best = -2; const ln = Math.hypot(loc.x, loc.z) || 1;
  for (let k = 0; k < 96; k++) { const p = PERIM(k / 96), d = (p.x * loc.x + p.z * loc.z) / (Math.hypot(p.x, p.z) * ln); if (d > best) { best = d; personA = k / 96; } }
  const inp = Object.assign({ look, personA }, S.pending); S.pending = {};
  const prevMode = S.st.mode;
  SH.stepState(S.st, dt, inp);
  if (S.st.mode !== prevMode) syncButtons();
  if (S.auto) { if (S.st.mode === "idle" && !S.st.ev) { S.autoT += dt; if (S.autoT > 7) { S.autoT = 0; S.pending.mode = "approach"; S.pending.seq = true; } } else S.autoT = 0; }
  for (const seg of Object.keys(BUF)) { const b = BUF[seg], n = SH.COUNTS[seg]; for (let i = 0; i < n; i++) { SH.px(seg, i, S.st, O); b[i * 3] = O[0]; b[i * 3 + 1] = O[1]; b[i * 3 + 2] = O[2]; } }
}

function render(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt;
  step(dt);
  const st = S.st, n = S.night;
  // cap + limiter on the saucer supply
  let raw = 0; for (const s of SH.SEGS[S.band ? 2026 : 2025]) raw += SH.frameAmps(BUF[s]);
  raw *= S.cap; const scale = raw > LIMIT_A ? (S.cap * LIMIT_A) / raw : S.cap, amps = Math.min(raw, LIMIT_A);
  const gain = n ? 3.2 : 1.6, off = n ? 0.01 : 0.3;
  for (const seg of Object.keys(LED)) {
    const { mesh, n: cnt } = LED[seg], b = BUF[seg], k = scale / 255 * gain;
    for (let i = 0; i < cnt; i++) { tmpC.setRGB(b[i * 3] * k + off, b[i * 3 + 1] * k + off, b[i * 3 + 2] * k + off); mesh.setColorAt(i, tmpC); }
    mesh.instanceColor.needsUpdate = true;
  }
  if (S.band) {
    const k = (scale / 255) * gain * 0.9;
    for (const name of ["lineA", "lineB"]) {
      const { n: cnt, col, g, hcol, hg } = LINES[name], b = BUF[name];
      for (let i = 0; i < cnt; i++) {
        const r = b[i * 3] * k + off, gg = b[i * 3 + 1] * k + off, bb = b[i * 3 + 2] * k + off;
        for (let q = 0; q < 4; q++) { col[(i * 4 + q) * 3] = r; col[(i * 4 + q) * 3 + 1] = gg; col[(i * 4 + q) * 3 + 2] = bb; }
        if (hcol) { const wk = 0.16; hcol[(i * 3 + 1) * 3] = r * wk; hcol[(i * 3 + 1) * 3 + 1] = gg * wk; hcol[(i * 3 + 1) * 3 + 2] = bb * wk; }
      }
      g.attributes.color.needsUpdate = true; if (hg) hg.attributes.color.needsUpdate = true;
    }
    const kw = (scale / 255) * gain * 1.6, b = BUF.ports;
    for (const { ws, col, g } of WIN.meshes) {
      ws.forEach((w, m) => {
        let ar = 0, ag = 0, ab = 0;
        for (let j = 0; j < 16; j++) { const i = (w * 16 + j) * 3, r = b[i] * kw + off, gg = b[i + 1] * kw + off, bb = b[i + 2] * kw + off; col[(m * 17 + 1 + j) * 3] = r; col[(m * 17 + 1 + j) * 3 + 1] = gg; col[(m * 17 + 1 + j) * 3 + 2] = bb; ar += r; ag += gg; ab += bb; }
        col[m * 17 * 3] = ar / 16 * 0.8; col[m * 17 * 3 + 1] = ag / 16 * 0.8; col[m * 17 * 3 + 2] = ab / 16 * 0.8;
      });
      g.attributes.color.needsUpdate = true;
    }
  }
  // light spill from the LEDs onto the vinyl, tree, ground
  const sp = (l, c, I) => { l.color.setRGB(c[0] + 1e-4, c[1] + 1e-4, c[2] + 1e-4); const lum = Math.max(c[0], c[1], c[2]); l.color.multiplyScalar(1 / Math.max(lum, 1e-3)); l.intensity = lum * I; };
  const rs = scale / 0.55;
  if (S.band) {   // quarter-perimeter spill from both lines + the windows
    [[-0.125, 0.125], [0.125, 0.375], [0.375, 0.625], [0.625, 0.875]].forEach(([a, b], k) => {
      const q = (seg) => { const n = SH.COUNTS[seg], i0 = Math.round(a * n), i1 = Math.round(b * n), parts = i0 < 0 ? [avg(seg, n + i0, n), avg(seg, 0, i1)] : [avg(seg, i0, i1)]; return parts.reduce((s, c) => [s[0] + c[0] / parts.length, s[1] + c[1] / parts.length, s[2] + c[2] / parts.length], [0, 0, 0]); };
      const t1 = q("lineA"), t2 = q("lineB"), wn = avg("ports", Math.max(0, Math.round((a + 0.0) * 256)), Math.max(1, Math.round(b * 256)));
      sp(L.rim[k], [(t1[0] + t2[0]) * 0.9 + wn[0] * 0.5, (t1[1] + t2[1]) * 0.9 + wn[1] * 0.5, (t1[2] + t2[2]) * 0.9 + wn[2] * 0.5], 2.6 * rs);
    });
  } else [[0, 63], [63, 188], [188, 313], [313, 438]].forEach(([a, b], k) => sp(L.rim[k], avg("rim", a, b), 2.6 * rs));
  sp(L.spokes, avg("spokes"), 5 * rs); sp(L.iris, avg("iris"), 2.2 * rs); sp(L.cockpit, avg("cockpit"), 1.2 * rs);
  const eyeC = avg("eyes"); eyeMat.emissive.setRGB(eyeC[0] * scale * 4, eyeC[1] * scale * 4, eyeC[2] * scale * 4);
  // beam spot, fog, motes
  const bl = SH.beamLevel(st), relay = SH.fogRelay(st) && S.fogOn;
  spot.intensity = bl * 2600; beamU.uLevel.value = bl; beamU.uTime.value = simT;
  stepFog(dt, relay);
  beamU.uFog.value = S.fogAmt; fogU.uBeam.value = bl;
  const rc = S.band ? avg("lineB") : avg("rim"); fogU.uRim.value.setRGB(rc[0] * rs, rc[1] * rs, rc[2] * rs);
  fogU.uAmb.value.setRGB(n ? 0.012 : 0.25, n ? 0.014 : 0.25, n ? 0.022 : 0.26);
  fogU.uScale.value = renderer.domElement.height * 0.9;
  stepMotes(dt, bl, st);
  // UV floods: the fluorescent print lights up (night only)
  const uvOn = S.uv && n;
  uvSpots.forEach((s) => (s.intensity = uvOn ? 22 : 0));
  matBelly.emissiveIntensity = uvOn ? 0.3 : 0; matTop.emissiveIntensity = uvOn ? 0.05 : 0;
  matBellyWhite.emissiveIntensity = uvOn ? 0.32 : 0; matTopWhite.emissiveIntensity = uvOn ? 0.06 : 0;   // white vinyl glows blue-white under UV
  matTopSilver.envMapIntensity = n ? 0.07 : 1.0;                                                           // at night only stray street light glints on the foil
  fogU.uUV.value.setRGB(uvOn ? 0.05 : 0, 0, uvOn ? 0.12 : 0);
  // alien turns toward the person (needs a small servo; optional)
  const yaw = Math.atan2(saucer.worldToLocal(kid.position.clone()).x, saucer.worldToLocal(kid.position.clone()).z);
  head.rotation.y += (THREE.MathUtils.clamp(yaw, -1.1, 1.1) * (st.mode === "idle" ? 0.35 : 1) - head.rotation.y) * (1 - Math.exp(-dt * 3));
  swayU.uTime.value = simT;
  // camera
  if (camAnim) { camAnim.k = Math.min(1, camAnim.k + dt / 1.2); const e = camAnim.k * camAnim.k * (3 - 2 * camAnim.k); camera.position.lerpVectors(camAnim.from.p, camAnim.to.p, e); controls.target.lerpVectors(camAnim.from.t, camAnim.to.t, e); camera.fov = camAnim.from.fov + (camAnim.to.fov - camAnim.from.fov) * e; camera.updateProjectionMatrix(); if (camAnim.k >= 1) camAnim = null; }
  controls.update();
  composer.render();
  hud(amps, raw, bl);
}

function stepFog(dt, relay) {
  // emit from the machine while the relay is on, drift toward the path, rise a little, fade
  let emit = relay ? dt * 34 : 0;
  for (let k = 0; k < FOG_N; k++) {
    if (fogAge[k] >= fogLife[k]) {
      if (emit >= 1 || (emit > 0 && rnd() < emit)) {
        emit -= 1; fogAge[k] = 0; fogLife[k] = 9 + rnd() * 9;
        fogPos[k * 3] = FOG_SRC.x; fogPos[k * 3 + 1] = FOG_SRC.y; fogPos[k * 3 + 2] = FOG_SRC.z;
        fogV[k].set(-1.6 - rnd() * 1.4, 0.05 + rnd() * 0.25, (rnd() - 0.5) * 1.6);
        fogS[k] = 0;
      } else { fogA[k] = 0; continue; }
    }
    fogAge[k] += dt; const a = fogAge[k] / fogLife[k];
    fogV[k].multiplyScalar(1 - dt * 0.35);
    fogPos[k * 3] += fogV[k].x * dt + Math.sin(simT * 0.3 + k) * 0.05 * dt; fogPos[k * 3 + 1] = Math.min(fogPos[k * 3 + 1] + fogV[k].y * dt, 6); fogPos[k * 3 + 2] += fogV[k].z * dt;
    fogS[k] = 3 + a * 8; fogA[k] = Math.min(1, fogAge[k] * 2) * (1 - a) * 0.15;
  }
  fogGeo.attributes.position.needsUpdate = fogGeo.attributes.aA.needsUpdate = fogGeo.attributes.aS.needsUpdate = true;
  S.fogAmt = Math.max(0, Math.min(1, S.fogAmt + (relay ? dt * 0.55 : -dt * 0.05)));
}
function stepMotes(dt, bl, st) {
  const lift = st.mode === "abduction" && st.ts >= SH.PH.lift && st.ts < SH.PH.flash;
  const v = lift ? 0.55 : 0.16;
  for (let k = 0; k < MOTE_N; k++) {
    moteS[k] += dt * v * (0.6 + 0.8 * ((k * 37) % 10) / 10); if (moteS[k] > 1) { moteS[k] -= 1; moteAng[k] = rnd() * Math.PI * 2; }
    const along = BEAM_LEN * (1 - moteS[k]), r = along * Math.tan(BEAM_HALF) * moteR[k];
    tmpV.copy(APEX).addScaledVector(AXIS, along);
    motePos[k * 3] = tmpV.x + Math.cos(moteAng[k] + simT * 0.8) * r; motePos[k * 3 + 1] = tmpV.y; motePos[k * 3 + 2] = tmpV.z + Math.sin(moteAng[k] + simT * 0.8) * r;
  }
  moteGeo.attributes.position.needsUpdate = true;
  moteMat.opacity = bl > 0 && st.mode === "abduction" && st.ts >= SH.PH.beam ? bl * 0.9 : 0;
}

const peakWin = [];
function hud(amps, raw, bl) {
  const st = S.st, ph = SH.phaseName(st);
  const line = $("stateLine"); line.textContent = "";
  line.append("STATE ", el("i", "", ph.toUpperCase()), ` · ${st.ts.toFixed(1)} s` + (st.mode === "abduction" ? "" : st.ev ? " · idle event" : ""));
  const now = performance.now(); peakWin.push([now, amps]); while (peakWin.length && now - peakWin[0][0] > 10000) peakWin.shift();
  const peak = peakWin.reduce((m, p) => Math.max(m, p[1]), 0);
  const m = $("meter"); m.textContent = "";
  const r1 = el("div"); r1.append(el("b", amps > WARN_A ? "warn" : "", `${amps.toFixed(1)} A`), " now · 5 V saucer");
  const bar = el("div", "bar"), fill = el("i"), pk = el("u"), wl = el("s");
  fill.style.width = `${Math.min(100, (amps / SUPPLY_A) * 100)}%`; pk.style.left = `${Math.min(100, (peak / SUPPLY_A) * 100)}%`; wl.style.left = `${(WARN_A / SUPPLY_A) * 100}%`;
  bar.append(fill, pk, wl);
  const r2 = el("div", "", `peak ${peak.toFixed(1)} A (10 s) / ${SUPPLY_A} A supply`);
  const r3 = el("div", raw > LIMIT_A ? "warn" : "mute", raw > LIMIT_A ? `limiter holding ${LIMIT_A} A (asked ${raw.toFixed(1)} A)` : `limiter at ${LIMIT_A} A · idle`);
  const r4 = el("div", "mute", `beam ${Math.round(bl * 100)}% · fog ${Math.round(S.fogAmt * 100)}%`);
  m.append(r1, bar, r2, r3, r4);
  const w = SH.wallText(st), wall = $("wall");
  if (w) { wall.style.display = "block"; wall.textContent = ""; wall.append(el("small", "", w.k), document.createTextNode(w.v)); } else wall.style.display = "none";
}

function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize(); applyScene(); setView("street", true); syncButtons();
// test hooks for headless checks: ?state=abduction&ts=5.2&view=gate&day=1
{
  const q = new URLSearchParams(location.search);
  if (q.get("view")) setView(q.get("view"), true);
  if (q.get("cam")) { const c = q.get("cam").split(",").map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); controls.update(); }
  if (q.get("day") === "1") { S.night = false; applyScene(); syncButtons(); }
  if (q.get("uv") === "0") { S.uv = false; syncButtons(); }
  if (q.get("rim") === "2025") { S.band = false; }
  if (["silver", "white", "print"].includes(q.get("skin"))) { S.skin = q.get("skin"); applySkin(); }
  if (q.get("person")) { const k = q.get("person"); kid.position.set(HIT.x + PERSON[k][0], 0, HIT.z + PERSON[k][1]); }
  if (q.get("state")) {
    const target = Number(q.get("ts") || 0), mode = q.get("state");
    if (mode === "sputter" || mode === "comms" || mode === "search") S.pending.event = mode; else { S.pending.mode = mode; S.pending.seq = true; }
    for (let k = 0, steps = Math.round(target / 0.02); k < steps; k++) { last = performance.now(); step(0.02); if (SH.fogRelay(S.st) && S.fogOn) stepFog(0.02, true); else stepFog(0.02, false); simT += 0.02; }
  }
}
applyRim(); syncButtons();
window.__ufo = { S, SH, BUF, L, LINES, band, WIN };
renderer.setAnimationLoop(render);

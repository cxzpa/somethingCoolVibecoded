// STRUCTURE — the main menu. A massive abstract chrome megastructure; every room is docked at a far edge,
// and choosing one flies the camera across the structure to it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initShell, audio, hasWebGL, reduceMotion, navigate, clamp, easeInOut } from './shared.js';

initShell({ crumb: 'Structure / <b>構造体</b>' });

const NODES = [
  { id: 'structure', code: 'N-00', name: 'Structure', jp: '構造体', href: null,
    desc: 'A haunted network, built in 1998 and never switched off. Five rooms are docked at the far edges of the structure. Choose one and the network will carry you there.',
    meta: [['Nodes', '5 online'], ['Height', '1,240 m'], ['Signal', 'holy'], ['Built', '1998.11.23']] },
  { id: 'halo', code: 'N-01', name: 'Halo', jp: '光輪', href: 'halo.html', pos: [42, 22, -14], color: 0xff2a33,
    desc: 'The first transmission. A chrome crown of thorns, a seraph made of knives, a heart that wants cables, an old OS, and a name for you.',
    meta: [['Rooms', '6'], ['Mood', 'devotional'], ['Material', 'mercury chrome'], ['Status', 'stable']] },
  { id: 'vessel', code: 'N-02', name: 'Vessel', jp: '容器', href: 'vessel.html', pos: [-46, -16, 10], color: 0x8fe6e8,
    desc: 'Something is sleeping in the water, plugged in at the spine. Tap the glass. Do not drain the chamber.',
    meta: [['Subject', 'NOX-07'], ['Liquid', '94% full'], ['Vitals', 'faint'], ['Status', 'dreaming']] },
  { id: 'signal', code: 'N-03', name: 'Signal', jp: '信号', href: 'signal.html', pos: [10, 46, 34], color: 0x8fe6e8,
    desc: 'A white room of hanging monitors. Every screen is still transmitting something. Pick one and listen.',
    meta: [['Screens', '9'], ['Room', 'white void'], ['Carrier', '432.7 MHz'], ['Status', 'broadcasting']] },
  { id: 'flash', code: 'N-04', name: 'Flash', jp: '刺青', href: 'flash.html', pos: [-18, 32, -44], color: 0xff2a33,
    desc: 'An ink table. Draw once, and the symmetry turns it into something holy. Take your flash home.',
    meta: [['Ink', 'black, red'], ['Symmetry', '2 / 4 / 6 / 8'], ['Paper', 'bone'], ['Status', 'wet']] },
  { id: 'press', code: 'N-05', name: 'Press', jp: '印刷', href: 'press.html', pos: [34, -32, 26], color: 0xff2a33,
    desc: 'A flyer machine from a scene that never existed. Every print is unique and none of them make sense.',
    meta: [['Prints', 'infinite'], ['Paper', 'scanned'], ['Ink', 'red, black'], ['Status', 'jammed, sometimes']] },
];

const stage = document.getElementById('stage');
const bootLine = document.getElementById('boot-line');
if (!hasWebGL()) { document.body.classList.add('no-webgl'); bootLine.remove(); throw new Error('no webgl'); }

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040809);
scene.fog = new THREE.FogExp2(0x061012, 0.0075);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

// ---------------------------------------------------------------- materials
const M = {
  chrome: new THREE.MeshStandardMaterial({ color: 0xa9d6d6, metalness: 1, roughness: 0.08 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x1d2a2c, metalness: 1, roughness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0c0c0f, metalness: 0.6, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8a0a10, metalness: 0.2, roughness: 0.3, emissive: 0x5a0006, emissiveIntensity: 0.6 }),
  glowRed: new THREE.MeshBasicMaterial({ color: 0xff2a33 }),
  glowIce: new THREE.MeshBasicMaterial({ color: 0x8fe6e8 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe9ec, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.6, transparent: true, opacity: 0.35 }),
  cable: new THREE.LineBasicMaterial({ color: 0x3a3c42, transparent: true, opacity: 0.8 }),
};

// ---------------------------------------------------------------- deterministic rng
let seed = 1998;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * rnd();

// ---------------------------------------------------------------- instanced beams
const UP = new THREE.Vector3(0, 1, 0);
const beamSets = { chrome: [], steel: [], dark: [] };
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
function beam(a, b, t, set = 'steel') {
  const d = tmpV.subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
  tmpQ.setFromUnitVectors(UP, d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), tmpQ, tmpS.set(t, len, t));
  beamSets[set].push(m);
}
function box(center, size, rot, set = 'dark') {
  const m = new THREE.Matrix4().compose(center, new THREE.Quaternion().setFromEuler(rot), size);
  beamSets[set].push(m);
}
function flushBeams() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (const [k, list] of Object.entries(beamSets)) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(geo, M[k], list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }
}

// a square truss between two points, tapering
function truss(A, B, s0 = 1.6, s1 = 0.8, set = 'steel') {
  const dir = new THREE.Vector3().subVectors(B, A); const L = dir.length(); dir.normalize();
  const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP;
  const u = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const v = new THREE.Vector3().crossVectors(u, dir).normalize();
  const n = Math.max(2, Math.round(L / 2.6));
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const at = (i, k) => {
    const t = i / n, s = (s0 + (s1 - s0) * t) / 2;
    return A.clone().addScaledVector(dir, L * t).addScaledVector(u, corners[k][0] * s).addScaledVector(v, corners[k][1] * s);
  };
  for (let k = 0; k < 4; k++) beam(at(0, k), at(n, k), 0.14, set);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      beam(at(i, k), at(i + 1, k2), 0.05, set);
      if (i % 3 === 0) beam(at(i, k), at(i, k2), 0.06, set);
    }
  }
  // greeble plates along the truss
  for (let i = 1; i < n; i += 2 + Math.floor(rnd() * 3)) {
    if (rnd() < 0.5) continue;
    const c = at(i, Math.floor(rnd() * 4));
    box(c, new THREE.Vector3(R(0.6, 2.2), R(0.1, 0.3), R(0.6, 1.8)), new THREE.Euler(R(0, 3), R(0, 3), R(0, 3)), rnd() < 0.3 ? 'chrome' : 'dark');
  }
}

// ---------------------------------------------------------------- the structure: a metalheart knot
// Liquid-chrome tentacles converge on a cluster of chrome spheres; glass shards orbit; grid panels,
// scan rings and lightning hang behind it like layers in a 2001 desktop wallpaper.
const world = new THREE.Group();
scene.add(world);
const arcs = []; // things that spin slowly (shard rings)

// a tube whose radius tapers along its length (TubeGeometry can't)
function taperTube(curve, r0, r1, segs = 96, radial = 14, ease = 1.4) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, P = curve.getPointAt(t);
    const r = r1 + (r0 - r1) * Math.pow(1 - t, ease) * (1 + 0.06 * Math.sin(t * 40));
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(P.x + r * (c * N.x + s * B.x), P.y + r * (c * N.y + s * B.y), P.z + r * (c * N.z + s * B.z));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const randDir = () => new THREE.Vector3(R(-1, 1), R(-0.8, 0.8), R(-1, 1)).normalize();
// keep loose tentacles out of the docks' sightlines so no camera ends up inside chrome
const dockDirs = NODES.filter(n => n.pos).map(n => new THREE.Vector3(...n.pos).normalize());
const freeDir = () => { for (let k = 0; k < 40; k++) { const d = randDir(); if (dockDirs.every(v => v.dot(d) < 0.78)) return d; } return randDir(); };
// a sweeping curve from near the core out to `end`, bending sideways like the references
function sweep(start, end, bend = 0.5) {
  const d = end.clone().sub(start), L = d.length();
  const side = new THREE.Vector3().crossVectors(d, UP).normalize();
  const c1 = start.clone().addScaledVector(d, 0.3).addScaledVector(side, L * bend * R(-1, 1)).addScaledVector(UP, L * R(-0.3, 0.3));
  const c2 = start.clone().addScaledVector(d, 0.7).addScaledVector(side, L * bend * R(-0.6, 0.6)).addScaledVector(UP, L * R(-0.25, 0.25));
  return new THREE.CatmullRomCurve3([start, c1, c2, end], false, 'catmullrom', 0.5);
}
const tips = []; // tentacle ends, used by the lightning

(function knot() {
  // the cluster of chrome spheres at the heart
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(R(1.2, 4.2), 40, 28), i % 5 === 0 ? M.steel : M.chrome);
    s.position.copy(randDir().multiplyScalar(R(0, 6)));
    world.add(s);
  }
  // spikes bursting out of the cluster
  const spikeGeo = new THREE.ConeGeometry(0.35, 1, 10); spikeGeo.translate(0, 0.5, 0);
  const spikes = new THREE.InstancedMesh(spikeGeo, M.chrome, 34);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) { const d = randDir(); m.compose(d.clone().multiplyScalar(R(3, 6)), new THREE.Quaternion().setFromUnitVectors(UP, d), new THREE.Vector3(1, R(4, 14), 1)); spikes.setMatrixAt(i, m); }
  world.add(spikes);
  // coils wrapped around the knot
  for (let k = 0; k < 7; k++) {
    const pts = [], r = R(6, 11), tilt = new THREE.Euler(R(0, 3), R(0, 3), R(0, 3)), turns = R(0.6, 1.4);
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2 * turns; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 2, Math.sin(a) * r).applyEuler(tilt)); }
    world.add(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(pts), R(0.5, 1.1), 0.08, 120, 12, 0.6), k % 3 ? M.chrome : M.steel));
  }
  // thick tentacles sweeping into the dark, thinner wires between them
  for (let i = 0; i < 26; i++) {
    const d = freeDir(); const start = d.clone().multiplyScalar(4);
    const end = d.clone().multiplyScalar(R(55, 140)).add(new THREE.Vector3(R(-6, 6), R(-8, 8), R(-6, 6)));
    world.add(new THREE.Mesh(taperTube(sweep(start, end, R(0.3, 0.8)), R(1.4, 3.2), R(0.05, 0.3)), i % 4 === 0 ? M.steel : M.chrome));
    tips.push(end);
    if (R(0, 1) < 0.35) { const drop = new THREE.Mesh(new THREE.SphereGeometry(R(0.6, 1.6), 24, 16), M.chrome); drop.position.copy(end); world.add(drop); }
  }
  for (let i = 0; i < 60; i++) {
    const d = freeDir(); const end = d.clone().multiplyScalar(R(30, 110));
    world.add(new THREE.Mesh(taperTube(sweep(d.clone().multiplyScalar(3), end, R(0.4, 1)), R(0.12, 0.4), 0.03, 80, 6), M.chrome));
  }
})();

// glass shards and droplets orbiting in rings
(function shards() {
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fe8ea, metalness: 0, roughness: 0.04, transmission: 0.9, thickness: 1.2, ior: 1.45, transparent: true, opacity: 0.9, envMapIntensity: 1.5 });
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Group(); ring.rotation.set(R(-1, 1), R(0, 3), R(-0.5, 0.5)); ring.userData.spin = R(-0.05, 0.05);
    for (let i = 0; i < 26; i++) {
      const a = R(0, Math.PI * 2), rad = R(16, 46);
      const geo = R(0, 1) < 0.6 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(0.6, 1);
      const s = new THREE.Mesh(geo, glass);
      s.position.set(Math.cos(a) * rad, R(-4, 4), Math.sin(a) * rad);
      s.scale.set(R(0.3, 1.2), R(1, 6), R(0.3, 1.2)); s.rotation.set(R(0, 3), R(0, 3), R(0, 3));
      ring.add(s);
    }
    world.add(ring); arcs.push(ring);
  }
})();

// flat graphic layers behind the knot: grids, scan rings, data strips, captions
function layerTex(draw, w = 1024, h = 1024) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEAL = 'rgba(120,230,225,';
const layers = [];
function addLayer(tex, w, h, pos, rotY, opacity = 0.55) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); p.position.copy(pos); p.rotation.y = rotY; world.add(p); layers.push(p); return p;
}
const gridTex = layerTex((x, w, h) => {
  x.strokeStyle = TEAL + '0.5)'; x.lineWidth = 1;
  for (let i = 0; i <= w; i += 16) { x.globalAlpha = i % 128 ? 0.35 : 0.9; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  x.globalAlpha = 1; x.fillStyle = TEAL + '0.25)'; for (let k = 0; k < 40; k++) x.fillRect(Math.floor(Math.random() * 64) * 16, Math.floor(Math.random() * 64) * 16, 16 * (1 + Math.floor(Math.random() * 6)), 16);
});
const scanTex = layerTex((x, w, h) => {
  x.translate(w / 2, h / 2); x.strokeStyle = TEAL + '0.8)';
  for (let r = 60; r < 500; r += 38) { x.lineWidth = r % 3 ? 1 : 3; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
  for (let a = 0; a < 120; a++) { const t = a / 120 * Math.PI * 2; x.lineWidth = 1; x.beginPath(); x.moveTo(Math.cos(t) * 120, Math.sin(t) * 120); x.lineTo(Math.cos(t) * 500, Math.sin(t) * 500); x.globalAlpha = a % 10 ? 0.25 : 0.9; x.stroke(); }
});
const stripTex = layerTex((x, w, h) => {
  x.fillStyle = TEAL + '0.18)'; x.fillRect(0, h * 0.35, w, h * 0.3);
  x.fillStyle = TEAL + '0.9)';
  for (let i = 0; i < 70; i++) x.fillRect(i * 30 + 10, h * 0.47, 18, 10);
  x.font = '700 64px "Syncopate", sans-serif'; x.fillText('ANGEL LINE', 30, h * 0.44);
  x.font = '22px "Space Mono", monospace'; x.fillText('METALHEART EXPERIMENT // NODE 00 // 構造体 // EXCLUSIVELY TRANSMITTED SINCE 1998', 30, h * 0.6);
  x.fillText('> structure.core  > tentacles: 26  > wires: 60  > halo uplink: holy', 30, h * 0.64);
}, 2048, 512);
addLayer(gridTex, 120, 120, new THREE.Vector3(10, 4, -60), 0.2, 0.32);
addLayer(gridTex, 90, 90, new THREE.Vector3(-55, -10, -20), 1.2, 0.25);
addLayer(scanTex, 110, 110, new THREE.Vector3(-6, 2, -38), 0.05, 0.5);
addLayer(scanTex, 70, 70, new THREE.Vector3(40, 20, 30), -2.2, 0.35);
addLayer(stripTex, 140, 35, new THREE.Vector3(0, -8, -28), 0, 0.7);
addLayer(stripTex, 100, 25, new THREE.Vector3(-30, 26, 40), 2.6, 0.4);

// lightning between tentacle tips and the knot, redrawn every few frames
const bolts = [];
const boltMat = new THREE.LineBasicMaterial({ color: 0xbff7f4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
for (let i = 0; i < 7; i++) { const l = new THREE.Line(new THREE.BufferGeometry(), boltMat); l.frustumCulled = false; world.add(l); bolts.push(l); }
function zap() {
  bolts.forEach((b) => {
    if (Math.random() < 0.55) { b.visible = false; return; }
    b.visible = true;
    const a = tips[Math.floor(Math.random() * tips.length)].clone().multiplyScalar(R(0.2, 0.6));
    const z = Math.random() < 0.5 ? new THREE.Vector3() : tips[Math.floor(Math.random() * tips.length)].clone().multiplyScalar(R(0.2, 0.6));
    const pts = []; const n = 22;
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(z, k / n); if (k && k < n) p.add(randDir().multiplyScalar(R(0.5, 3.5))); pts.push(p); }
    b.geometry.dispose(); b.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  });
}

// ---------------------------------------------------------------- docks (one sculpture per room)
const docks = {};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function dockHalo(g) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.32, 16, 96), M.chrome);
  ring.rotation.x = Math.PI / 2.4; g.add(ring);
  const spikeGeo = new THREE.ConeGeometry(0.16, 1, 8); spikeGeo.translate(0, 0.5, 0);
  const spikes = new THREE.InstancedMesh(spikeGeo, M.chrome, 40);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4);
    const d = new THREE.Vector3(Math.cos(a), R(-0.8, 1.2), Math.sin(a)).normalize();
    m.compose(p, new THREE.Quaternion().setFromUnitVectors(UP, d), new THREE.Vector3(1, R(0.8, 2.6), 1));
    spikes.setMatrixAt(i, m);
  }
  spikes.rotation.x = Math.PI / 2.4; g.add(spikes);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), M.red); g.add(core);
  g.userData.spin = ring; g.userData.spin2 = spikes; g.userData.bob = core;
}

function dockVessel(g) {
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 40, 1, true), M.glass); g.add(tank);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 6.4, 32), new THREE.MeshBasicMaterial({ color: 0x1d6e74, transparent: true, opacity: 0.35 }));
  liquid.position.y = -0.2; g.add(liquid);
  for (const y of [-3.7, 3.7]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.7, 40), M.chrome); cap.position.y = y; g.add(cap);
  }
  // a tiny curled figure
  const fig = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8e5df, roughness: 0.4, metalness: 0 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), skin); head.position.set(0, 1.1, 0.2); fig.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 12), skin); torso.rotation.x = 0.5; fig.add(torso);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 6, 12), M.dark); legs.position.set(0, -0.6, 0.6); legs.rotation.x = -1.2; fig.add(legs);
  g.add(fig); g.userData.bob = fig;
  for (let i = 0; i < 6; i++) {
    const pts = [new THREE.Vector3(R(-1.5, 1.5), 3.6, R(-1.5, 1.5)), new THREE.Vector3(R(-0.6, 0.6), 2, R(-0.6, 0.6)), new THREE.Vector3(0, 0.6, -0.3)];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(20)), M.cable));
  }
  const glow = new THREE.PointLight(0x8fe6e8, 10, 12, 2); g.add(glow);
}

function screenTex(i) {
  return canvasTex(256, 160, (x, w, h) => {
    x.fillStyle = '#05080a'; x.fillRect(0, 0, w, h);
    x.font = '11px "Space Mono", monospace';
    for (let r = 0; r < 12; r++) {
      x.fillStyle = r === (i * 3) % 12 ? '#ff2a33' : `rgba(143,230,232,${0.35 + rnd() * 0.6})`;
      let s = ''; for (let k = 0; k < 30; k++) s += rnd() < 0.15 ? ' ' : String.fromCharCode(33 + Math.floor(rnd() * 90));
      x.fillText(s, 8, 16 + r * 12);
    }
  });
}
function dockSignal(g) {
  for (let i = 0; i < 7; i++) {
    const mon = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.25), M.steel); mon.add(body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.48), new THREE.MeshBasicMaterial({ map: screenTex(i) }));
    scr.position.z = 0.13; mon.add(scr);
    mon.position.set(R(-5, 5), R(-3, 4), R(-3, 3));
    mon.rotation.set(R(-0.4, 0.4), R(-0.8, 0.8), R(-0.3, 0.3));
    mon.userData.phase = R(0, 6);
    g.add(mon);
    const top = mon.position.clone().add(new THREE.Vector3(R(-2, 2), 14, R(-2, 2)));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([mon.position.clone().add(new THREE.Vector3(0, 0.85, 0)), top]), M.cable));
  }
  g.userData.monitors = g.children.filter(c => c.isGroup);
}

function dockFlash(g) {
  const T = 0.32;
  const parts = [[0, 0, 0, T, 9, T], [0, 2, 0, 5.4, T, T], [0, 2, 0, 1.4, 1.4, 0.2]];
  parts.forEach(([x, y, z, w, h, d], i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i === 2 ? M.red : M.chrome);
    mesh.position.set(x, y, z); if (i === 2) mesh.rotation.z = Math.PI / 4; g.add(mesh);
  });
  // filigree: thin spiky members
  for (let i = 0; i < 26; i++) {
    const a = new THREE.Vector3(0, R(-4, 4), 0);
    const b = a.clone().add(new THREE.Vector3(R(-3, 3), R(-1.5, 2.5), R(-0.3, 0.3)));
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, len, 6), M.steel);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    g.add(m);
  }
  g.userData.spinY = true;
}

function posterTex(i) {
  return canvasTex(256, 384, (x, w, h) => {
    x.fillStyle = i % 2 ? '#e9e7e2' : '#0b0b0c'; x.fillRect(0, 0, w, h);
    const ink = i % 2 ? '#0b0b0c' : '#e9e7e2';
    x.fillStyle = '#c3141b'; x.beginPath(); x.arc(w * 0.62, h * 0.36, 70, 0, Math.PI * 2); x.fill();
    x.fillStyle = ink; x.font = '800 54px "Grenze Gotisch", serif'; x.fillText(['Angel', 'Static', 'Signal', 'Vessel'][i % 4], 16, h - 70);
    x.font = '10px "Space Mono", monospace'; x.fillText('AL-' + (1000 + i * 37) + ' // NOT A REAL HEAVEN', 16, h - 40);
    for (let k = 0, bx = 16; bx < 140; k++) { const bw = 1 + Math.floor(rnd() * 3); if (rnd() > 0.4) x.fillRect(bx, h - 30, bw, 18); bx += bw + 1; }
  });
}
function dockPress(g) {
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.8), new THREE.MeshStandardMaterial({ map: posterTex(i), roughness: 0.8, side: THREE.DoubleSide }));
    p.position.set(R(-3, 3), R(-2, 2), i * 0.6 - 1.5);
    p.rotation.set(R(-0.3, 0.3), R(-0.6, 0.6), R(-0.4, 0.4));
    p.userData.phase = R(0, 6);
    g.add(p);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 3), M.dark); slab.position.y = -3.6; g.add(slab);
  g.userData.posters = g.children.filter(c => c.geometry && c.geometry.type === 'PlaneGeometry');
}

const builders = { halo: dockHalo, vessel: dockVessel, signal: dockSignal, flash: dockFlash, press: dockPress };
NODES.forEach((n) => {
  if (!n.pos) return;
  const p = new THREE.Vector3(...n.pos);
  // a thick tentacle from the knot out to the dock
  const start = p.clone().normalize().multiplyScalar(5);
  world.add(new THREE.Mesh(taperTube(sweep(start, p.clone().multiplyScalar(0.94), 0.08), 2.6, 0.7, 140, 16, 0.9), M.chrome));
  tips.push(p.clone().multiplyScalar(0.9));
  const g = new THREE.Group(); g.position.copy(p); g.scale.setScalar(1.5);
  builders[n.id](g);
  const light = new THREE.PointLight(n.color, 60, 30, 2); light.position.set(0, 3, 4); g.add(light);
  world.add(g);
  docks[n.id] = g;
  n.vec = p;
});

// drifting dust
const dust = (() => {
  const n = 2400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = R(-120, 120); pos[i * 3 + 1] = R(-90, 90); pos[i * 3 + 2] = R(-120, 120); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dx = dot.getContext('2d');
  const rg = dx.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); dx.fillStyle = rg; dx.fillRect(0, 0, 32, 32);
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fe8e4, size: 0.14, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false }));
  scene.add(p); return p;
})();

flushBeams();

// light
scene.add(new THREE.AmbientLight(0x2a4446, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(30, 60, 40); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fe6e8, 1.4); rim.position.set(-40, -10, -30); scene.add(rim);
const coreGlow = new THREE.PointLight(0x8fe6e8, 600, 90, 1.6); scene.add(coreGlow);

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- camera poses
function poseFor(n) {
  if (!n.pos) return { pos: new THREE.Vector3(0, 8, 118), look: new THREE.Vector3(0, 4, 0) };
  const p = n.vec;
  const out = new THREE.Vector3(p.x, 0, p.z).normalize();
  const side = new THREE.Vector3().crossVectors(UP, out).normalize();
  const narrow = innerWidth < 820;
  const pos = p.clone().addScaledVector(out, narrow ? 20 : 17).addScaledVector(UP, 2.5).addScaledVector(side, narrow ? 0 : 2);
  // keep the dock left of centre so the panel sits on the right
  const look = p.clone().addScaledVector(side, narrow ? 0 : 7).addScaledVector(UP, narrow ? -4 : 0.3);
  return { pos, look };
}

let current = 0;
const camState = { pos: new THREE.Vector3(0, 30, 240), look: new THREE.Vector3(0, 0, 0) };
let flight = null;

function flyTo(i, instant = false) {
  i = (i + NODES.length) % NODES.length;
  const from = { pos: camState.pos.clone(), look: camState.look.clone() };
  const to = poseFor(NODES[i]);
  current = i;
  updateUI(i);
  if (instant || reduceMotion) { camState.pos.copy(to.pos); camState.look.copy(to.look); return; }
  // arc out and around the structure rather than through it
  const mid = from.pos.clone().add(to.pos).multiplyScalar(0.5);
  const radial = new THREE.Vector3(mid.x, 0, mid.z);
  const push = Math.max(70, radial.length() + 40);
  radial.setLength(push);
  const curve = new THREE.CatmullRomCurve3([from.pos, new THREE.Vector3(radial.x, mid.y + 18, radial.z), to.pos]);
  const dist = from.pos.distanceTo(to.pos);
  flight = { curve, from, to, t0: performance.now(), dur: clamp(1500 + dist * 9, 1700, 3200) };
  document.getElementById('rstate').textContent = 'in transit';
  panel.classList.add('is-away');
  flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
  audio.glitch(0.3); audio.chime(i ? 330 + i * 55 : 262, 0.08);
}

// ---------------------------------------------------------------- UI
const list = document.getElementById('node-list');
const panel = document.getElementById('node-panel');
const flash = document.createElement('div'); flash.className = 'flight-flash'; document.body.appendChild(flash);
const labelsEl = document.getElementById('labels');

NODES.forEach((n, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<span class="c">${n.code}</span><span>${n.name}</span>`;
  b.addEventListener('click', () => { if (i !== current) flyTo(i); });
  list.appendChild(b);
  if (n.pos) {
    const l = document.createElement('button');
    l.className = 'label'; l.innerHTML = `<span class="c">${n.code}</span>${n.name}`;
    l.tabIndex = -1;
    l.addEventListener('click', () => { if (i !== current) flyTo(i); });
    labelsEl.appendChild(l); n.label = l;
  }
});

function updateUI(i) {
  const n = NODES[i];
  [...list.children].forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  const set = () => {
    document.getElementById('np-code').textContent = n.code;
    document.getElementById('np-status').textContent = n.meta.find(m => m[0] === 'Status')?.[1] || 'online';
    document.getElementById('np-jp').textContent = n.jp;
    document.getElementById('np-name').textContent = n.name;
    document.getElementById('np-desc').textContent = n.desc;
    document.getElementById('np-meta').innerHTML = n.meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const enter = document.getElementById('np-enter');
    enter.hidden = !n.href; if (n.href) { enter.href = n.href; enter.textContent = `Enter ${n.name}`; }
    document.getElementById('np-back').hidden = !n.pos;
    document.title = n.pos ? `Angel Line — ${n.name}` : 'Angel Line — Structure';
  };
  if (flight || panel.classList.contains('is-away')) setTimeout(set, 250); else set();
}
document.getElementById('np-back').addEventListener('click', () => flyTo(0));

// input: keys, wheel, swipe, pointer parallax
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (['ArrowDown', 'ArrowRight', 's', 'S'].includes(e.key)) { e.preventDefault(); flyTo(current + 1); }
  else if (['ArrowUp', 'ArrowLeft', 'w', 'W'].includes(e.key)) { e.preventDefault(); flyTo(current - 1); }
  else if (e.key === 'Escape') flyTo(0);
  else if (e.key === 'Enter' && NODES[current].href && !e.target.closest('a, button')) navigate(NODES[current].href);
});
let wheelLock = 0;
addEventListener('wheel', (e) => {
  const now = performance.now();
  if (now < wheelLock || Math.abs(e.deltaY) < 8) return;
  wheelLock = now + 1100;
  flyTo(current + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });
let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => {
  if (touchY == null) return;
  const dy = touchY - e.changedTouches[0].clientY; touchY = null;
  if (Math.abs(dy) > 50 && !e.target.closest('.node-list')) flyTo(current + (dy > 0 ? 1 : -1));
}, { passive: true });
const par = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => { par.tx = (e.clientX / innerWidth - 0.5) * 2; par.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

// click a dock in 3D
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (let i = 1; i < NODES.length; i++) {
    const g = docks[NODES[i].id];
    if (ray.intersectObject(g, true).length) { if (i === current && NODES[i].href) navigate(NODES[i].href); else flyTo(i); return; }
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  if (!flight) { const p = poseFor(NODES[current]); camState.pos.copy(p.pos); camState.look.copy(p.look); }
});

// ---------------------------------------------------------------- loop
const rx = document.getElementById('rx'), ry = document.getElementById('ry'), rz = document.getElementById('rz');
const clock = new THREE.Clock();
const projV = new THREE.Vector3();
let started = false;

function frame() {
  const t = clock.getElapsedTime();
  if (flight) {
    const k = clamp((performance.now() - flight.t0) / flight.dur, 0, 1);
    const e = easeInOut(k);
    camState.pos.copy(flight.curve.getPoint(e));
    camState.look.lerpVectors(flight.from.look, flight.to.look, easeInOut(clamp(k * 1.15 - 0.05, 0, 1)));
    camera.fov = 55 + Math.sin(k * Math.PI) * 16;
    camera.updateProjectionMatrix();
    bloom.strength = 0.42 + Math.sin(k * Math.PI) * 0.5;
    if (k >= 1) {
      flight = null; panel.classList.remove('is-away');
      document.getElementById('rstate').textContent = NODES[current].pos ? 'docked' : 'holding';
    }
  }
  par.x += (par.tx - par.x) * 0.04; par.y += (par.ty - par.y) * 0.04;
  camera.position.copy(camState.pos);
  if (!reduceMotion) { camera.position.x += par.x * 1.2 + Math.sin(t * 0.3) * 0.4; camera.position.y += -par.y * 0.8 + Math.sin(t * 0.23) * 0.3; }
  camera.lookAt(camState.look);

  // motion
  if (!reduceMotion) {
    world.rotation.y = Math.sin(t * 0.03) * 0.04;
    arcs.forEach(a => { a.rotation.y += a.userData.spin * 0.016; });
    dust.rotation.y = t * 0.004;
    if (Math.floor(t * 12) !== zap.last) { zap.last = Math.floor(t * 12); zap(); }
    layers.forEach((l, i) => { l.material.opacity = l.userData.o ?? (l.userData.o = l.material.opacity); l.material.opacity = l.userData.o * (0.85 + 0.15 * Math.sin(t * 2 + i)); });
    const h = docks.halo; if (h) { h.userData.spin.rotation.z = t * 0.3; h.userData.spin2.rotation.y = t * 0.3; h.userData.bob.rotation.y = t; h.userData.bob.position.y = Math.sin(t * 1.4) * 0.3; }
    const v = docks.vessel; if (v) { v.userData.bob.position.y = Math.sin(t * 0.8) * 0.25; v.userData.bob.rotation.y = t * 0.2; }
    const s = docks.signal; if (s) s.userData.monitors.forEach(m => { m.rotation.y += Math.sin(t * 0.5 + m.userData.phase) * 0.0015; m.position.y += Math.sin(t + m.userData.phase) * 0.004; });
    const f = docks.flash; if (f) f.rotation.y = t * 0.25;
    const p = docks.press; if (p) p.userData.posters.forEach(q => { q.rotation.z += Math.sin(t * 0.6 + q.userData.phase) * 0.001; });
  }

  // labels for docks (hidden for the docked node)
  NODES.forEach((n, i) => {
    if (!n.label) return;
    projV.copy(n.vec).applyMatrix4(world.matrixWorld).project(camera);
    const vis = projV.z < 1 && Math.abs(projV.x) < 1.1 && Math.abs(projV.y) < 1.1 && i !== current && !flight;
    n.label.classList.toggle('is-hidden', !vis);
    if (vis) n.label.style.transform = `translate(${(projV.x * 0.5 + 0.5) * innerWidth + 14}px, ${(-projV.y * 0.5 + 0.5) * innerHeight - 10}px)`;
  });

  rx.textContent = camera.position.x.toFixed(1).padStart(6, '0');
  ry.textContent = camera.position.y.toFixed(1).padStart(6, '0');
  rz.textContent = camera.position.z.toFixed(1).padStart(6, '0');

  composer.render();
  if (!started) { started = true; bootLine.classList.add('is-done'); }
  requestAnimationFrame(frame);
}

// open: fly in from far away to the overview, or straight to ?node=
const want = new URLSearchParams(location.search).get('node');
const startIdx = Math.max(0, NODES.findIndex(n => n.id === want));
document.fonts.ready.then(() => {
  // poster/screen textures were drawn before fonts loaded on some browsers; that's fine, they're tiny
});
requestAnimationFrame(frame);
setTimeout(() => flyTo(startIdx), 120);

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
scene.background = new THREE.Color(0x070708);
scene.fog = new THREE.FogExp2(0x070708, 0.0085);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

// ---------------------------------------------------------------- materials
const M = {
  chrome: new THREE.MeshStandardMaterial({ color: 0xe8eaee, metalness: 1, roughness: 0.14 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 1, roughness: 0.38 }),
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

// ---------------------------------------------------------------- the structure
const world = new THREE.Group();
scene.add(world);

// central spine: stacked rings, ribs, and a chrome core
(function core() {
  const ringGeo = new THREE.TorusGeometry(3.2, 0.22, 10, 48);
  const n = 54;
  const rings = new THREE.InstancedMesh(ringGeo, M.chrome, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const y = -75 + i * 2.8;
    const s = 1 + 0.25 * Math.sin(i * 0.7) + (i % 9 === 0 ? 0.6 : 0);
    m.compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(s, s, 1));
    rings.setMatrixAt(i, m);
  }
  world.add(rings);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, r = 2.6;
    beam(new THREE.Vector3(Math.cos(a) * r, -78, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r, 78, Math.sin(a) * r), k % 2 ? 0.18 : 0.32, k % 2 ? 'steel' : 'chrome');
  }
  const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 160, 24, 1, true), M.dark);
  world.add(coreMesh);
  // glowing seams on the core
  for (let i = 0; i < 18; i++) {
    const y = R(-70, 70);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.035, 6, 40), rnd() < 0.3 ? M.glowRed : M.glowIce);
    seam.rotation.x = Math.PI / 2; seam.position.y = y;
    world.add(seam);
  }
})();

// abstract chrome arcs orbiting the spine (the Metalheart forms)
const arcs = [];
for (let i = 0; i < 7; i++) {
  const r = R(14, 58);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(r, R(0.12, 0.6), 8, 160, R(1.2, 4.2)), i % 3 ? M.chrome : M.steel);
  arc.rotation.set(R(-1.2, 1.2), R(0, Math.PI * 2), R(-0.6, 0.6));
  arc.position.y = R(-30, 30);
  arc.userData.spin = R(-0.04, 0.04);
  world.add(arc); arcs.push(arc);
}

// decoy arms reaching into the dark
for (let i = 0; i < 16; i++) {
  const a = R(0, Math.PI * 2), y = R(-60, 60);
  const L = R(25, 70);
  const A = new THREE.Vector3(Math.cos(a) * 3, y, Math.sin(a) * 3);
  const B = new THREE.Vector3(Math.cos(a) * L, y + R(-20, 20), Math.sin(a) * L);
  truss(A, B, R(1, 2), R(0.4, 1));
  if (rnd() < 0.6) box(B, new THREE.Vector3(R(2, 7), R(2, 9), R(2, 7)), new THREE.Euler(0, R(0, 3), 0), 'dark');
  if (rnd() < 0.35) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R(2, 5), 0.15, 8, 48), M.chrome);
    ring.position.copy(B); ring.lookAt(A); world.add(ring);
  }
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
  const glow = new THREE.PointLight(0x8fe6e8, 30, 18, 2); g.add(glow);
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
  // the long arm from the spine out to the dock
  const A = new THREE.Vector3(0, p.y * 0.6, 0);
  truss(A, p.clone().multiplyScalar(0.93), 2.4, 1.2, 'steel');
  const g = new THREE.Group(); g.position.copy(p);
  builders[n.id](g);
  const light = new THREE.PointLight(n.color, 60, 30, 2); light.position.set(0, 3, 4); g.add(light);
  world.add(g);
  docks[n.id] = g;
  n.vec = p;
});

// hanging cables between arms
for (let i = 0; i < 70; i++) {
  const a = new THREE.Vector3(R(-50, 50), R(-40, 60), R(-50, 50));
  const b = a.clone().add(new THREE.Vector3(R(-18, 18), R(-4, 4), R(-18, 18)));
  const sag = R(4, 20);
  const pts = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.cable));
}

// drifting dust
const dust = (() => {
  const n = 2400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = R(-120, 120); pos[i * 3 + 1] = R(-90, 90); pos[i * 3 + 2] = R(-120, 120); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc9ccd2, size: 0.18, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
  scene.add(p); return p;
})();

flushBeams();

// light
scene.add(new THREE.AmbientLight(0x404048, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(30, 60, 40); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fe6e8, 0.8); rim.position.set(-40, -10, -30); scene.add(rim);

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
  const pos = p.clone().addScaledVector(out, narrow ? 19 : 16).addScaledVector(UP, 2.5).addScaledVector(side, narrow ? 0 : 2);
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

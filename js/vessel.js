// VESSEL — a porcelain cyborg doll asleep in a water chamber. Tap the glass; hold to drain.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initShell, audio, hasWebGL, reduceMotion, clamp, lerp } from './shared.js';

initShell({ crumb: 'Structure / <b>Vessel 容器</b>' });
const bootLine = document.getElementById('boot-line');
if (!hasWebGL()) { document.body.classList.add('no-webgl'); bootLine.remove(); throw new Error('no webgl'); }

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050607);
scene.fog = new THREE.FogExp2(0x050607, 0.045);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 200);

const TANK_R = 1.25, TANK_H = 4.2, TANK_Y = 2.45, BOTTOM = TANK_Y - TANK_H / 2;
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- materials
const M = {
  porcelain: new THREE.MeshPhysicalMaterial({ color: 0xece8e1, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: 0xffffff }),
  armor: new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }),
  joint: new THREE.MeshStandardMaterial({ color: 0xd9dce2, metalness: 1, roughness: 0.18 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.12 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 1, roughness: 0.4 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 0.6, roughness: 0.32 }),
  cable: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.35, clearcoat: 0.8 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff2a33 }),
  ice: new THREE.MeshBasicMaterial({ color: 0x8fe6e8 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a1d20 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xe6f7f8, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.06, ior: 1.5, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.4 }),
  liquid: new THREE.MeshPhysicalMaterial({ color: 0x9fe3e7, metalness: 0, roughness: 0.08, transmission: 0.92, thickness: 2.2, ior: 1.33, attenuationColor: new THREE.Color(0x2f9aa2), attenuationDistance: 3.2, transparent: true }),
  hair: new THREE.LineBasicMaterial({ color: 0xc9ced6 }),
  bubble: new THREE.MeshBasicMaterial({ color: 0xbfeef0 }),
};

// ---------------------------------------------------------------- room
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), M.floor);
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(40, 40, 0x1c1e22, 0x121316); grid.position.y = 0.002; scene.add(grid);

// pedestal, caps, bolts, pipes
function ringOfBolts(y, r, n) {
  const g = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8);
  const im = new THREE.InstancedMesh(g, M.chrome, n); const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); im.setMatrixAt(i, m); }
  scene.add(im);
}
const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.32, 48), M.steel); base.position.y = 0.16; scene.add(base);
const capB = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.55, 0.36, 48), M.chrome); capB.position.y = BOTTOM - 0.02; scene.add(capB);
const capT = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.48, 0.42, 48), M.chrome); capT.position.y = BOTTOM + TANK_H + 0.18; scene.add(capT);
ringOfBolts(BOTTOM + 0.17, 1.42, 24); ringOfBolts(BOTTOM + TANK_H - 0.02, 1.42, 24);
const glowRingB = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.018, 6, 64), M.ice); glowRingB.rotation.x = Math.PI / 2; glowRingB.position.y = BOTTOM + 0.17; scene.add(glowRingB);
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + 0.4;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 12, 12), i % 2 ? M.steel : M.chrome);
  pipe.position.set(Math.cos(a) * 0.95, BOTTOM + TANK_H + 6.3, Math.sin(a) * 0.95); scene.add(pipe);
}
// struts around the tank
for (let i = 0; i < 3; i++) {
  const a = (i / 3) * Math.PI * 2 + 2.25;
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, TANK_H + 0.4, 0.14), M.steel);
  s.position.set(Math.cos(a) * 1.5, TANK_Y, Math.sin(a) * 1.5); s.lookAt(0, TANK_Y, 0); scene.add(s);
}
// distant light strips (for reflections) and hanging cables
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 7, 0.06), new THREE.MeshBasicMaterial({ color: i % 4 ? 0x3c4249 : 0x2f6e72 }));
  strip.position.set(Math.cos(a) * 11, 4, Math.sin(a) * 11); scene.add(strip);
}
for (let i = 0; i < 26; i++) {
  const a = new THREE.Vector3((Math.random() - 0.5) * 20, 12, (Math.random() - 0.5) * 20 - 4);
  if (a.length() < 4) continue;
  const b = a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
  const sag = 3 + Math.random() * 8; const pts = [];
  for (let k = 0; k <= 20; k++) { const t = k / 20; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x22242a })));
}

// caustics on the floor
const caustic = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uLevel: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float uT; uniform float uLevel; varying vec2 vUv;
    float c(vec2 p){ p *= 7.; float v = 0.; for(int i=0;i<4;i++){ p += vec2(sin(p.y*1.1 + uT*.6), cos(p.x*.9 - uT*.5)); v += abs(sin(p.x) * cos(p.y)); } return v; }
    void main(){ vec2 q = vUv - .5; float r = length(q); float k = pow(clamp(1. - c(vUv)/2.6, 0., 1.), 4.);
      float fall = smoothstep(.5, .12, r); gl_FragColor = vec4(vec3(.45,.92,.96) * k * fall * uLevel * 0.8, 1.); }`,
}));
caustic.rotation.x = -Math.PI / 2; caustic.position.y = 0.33; scene.add(caustic);

// ---------------------------------------------------------------- the chamber
const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R - 0.04, TANK_R - 0.04, 1, 48), M.liquid);
scene.add(liquid);
const surface = new THREE.Mesh(new THREE.CircleGeometry(TANK_R - 0.05, 48), new THREE.MeshBasicMaterial({ color: 0x8fe6e8, transparent: true, opacity: 0.16, depthWrite: false }));
surface.rotation.x = -Math.PI / 2; scene.add(surface);
const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xdffbfc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
ripple.rotation.x = -Math.PI / 2; scene.add(ripple);
const glass = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 64, 1, true), M.glass);
glass.position.y = TANK_Y; scene.add(glass);
// a decal on the glass
const decal = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(233,231,226,0.85)'; x.font = '700 30px "Space Mono", monospace'; x.fillText('NOX-07', 10, 44);
  x.font = '16px "Space Mono", monospace'; x.fillText('VESSEL / DO NOT DRAIN / 容器', 10, 80);
  x.fillStyle = '#ff2a33'; x.fillRect(10, 96, 120, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.004, TANK_R + 0.004, 0.5, 48, 1, true, -0.55, 1.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.position.y = BOTTOM + 0.55; scene.add(m); return m;
})();

// lights
scene.add(new THREE.AmbientLight(0x40464c, 0.25));
const inner = new THREE.PointLight(0x8fe6e8, 18, 7, 1.6); inner.position.set(0, BOTTOM + 0.4, 0); scene.add(inner);
const top = new THREE.SpotLight(0xffffff, 60, 14, 0.42, 0.6, 1.4); top.position.set(0, 9, 0.5); top.target.position.set(0, TANK_Y, 0); scene.add(top, top.target);
const key = new THREE.DirectionalLight(0xe8eef4, 0.9); key.position.set(-4, 5, 6); scene.add(key);
const rim = new THREE.PointLight(0x8fe6e8, 25, 10, 2); rim.position.set(2.5, 4, -3); scene.add(rim);
const alarmLight = new THREE.PointLight(0xff1a24, 0, 14, 1.5); alarmLight.position.set(0, 6, 2.5); scene.add(alarmLight);

// bubbles
const NB = 140;
const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.bubble, NB);
const bState = Array.from({ length: NB }, () => ({ x: 0, y: 0, z: 0, s: 0, v: 0, w: 0 }));
function resetBubble(b, anywhere) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (TANK_R - 0.15);
  b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = anywhere ? BOTTOM + Math.random() * TANK_H : BOTTOM + 0.1;
  b.s = 0.008 + Math.random() * 0.025; b.v = 0.25 + Math.random() * 0.5; b.w = Math.random() * 6;
}
bState.forEach(b => resetBubble(b, true));
scene.add(bubbles);

// ---------------------------------------------------------------- the doll
function cap(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat); return m; }
function joint(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function ball(parent, r) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M.joint); parent.add(b); return b; }

const doll = new THREE.Group(); scene.add(doll);
const J = {};
(function buildDoll() {
  const pelvis = J.pelvis = joint(doll, 0, 0, 0);
  const pel = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), M.porcelain); pel.scale.set(1.15, 0.8, 0.9); pelvis.add(pel);
  const brief = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.armor); brief.scale.set(1.16, 0.82, 0.92); pelvis.add(brief);

  const spine = J.spine = joint(pelvis, 0, 0.08, 0);
  const torso = cap(0.14, 0.26, M.porcelain); torso.position.y = 0.2; torso.scale.set(1.1, 1, 0.82); spine.add(torso);
  const chest = J.chest = joint(spine, 0, 0.38, 0);
  const ch = cap(0.17, 0.14, M.porcelain); ch.position.y = 0.1; ch.scale.set(1.15, 1, 0.85); chest.add(ch);
  // black segmented armor over the chest and back
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.2 - i * 0.012, 0.205 - i * 0.012, 0.05, 28, 1, true, Math.PI * 0.62, Math.PI * 1.76), M.armor);
    seg.position.y = -0.18 + i * 0.065; seg.scale.z = 0.8; spine.add(seg); seg.position.y += 0.22;
  }
  const plate = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), M.armor); plate.position.y = 0.06; plate.scale.set(1.12, 1, 0.86); chest.add(plate);
  // spinal ports with red lights
  J.ports = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group(); p.position.set(0, -0.12 + i * 0.1, -0.135); chest.add(p);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), M.chrome); ring.rotation.x = Math.PI / 2; p.add(ring);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), M.red); led.position.z = -0.017; led.rotation.y = Math.PI; p.add(led);
    J.ports.push(p);
  }

  const neck = J.neck = joint(chest, 0, 0.27, 0);
  ball(neck, 0.05);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 12), M.porcelain); nk.position.y = 0.05; neck.add(nk);
  const head = J.head = joint(neck, 0, 0.1, 0.01);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), M.porcelain); hd.position.y = 0.12; hd.scale.set(0.92, 1.12, 0.98); head.add(hd);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), M.porcelain); jaw.position.set(0, 0.05, 0.03); jaw.scale.set(0.95, 0.9, 1); head.add(jaw);
  // a black visor band across the brow and a chrome circlet
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 48), M.joint); band.position.y = 0.17; band.rotation.x = Math.PI / 2 - 0.1; head.add(band);
  J.eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), M.eye);
    e.position.set(s * 0.042, 0.125, 0.118); e.scale.set(1.5, 0.18, 0.6); head.add(e); return e;
  });
  J.hairRoots = [];
  for (let i = 0; i < 260; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - Math.random() * 1.15);
    const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    if (d.z > 0.55 && d.y < 0.6) { i--; continue; } // keep the face clear
    J.hairRoots.push({ p: new THREE.Vector3(d.x * 0.12, 0.12 + d.y * 0.145, d.z * 0.125), d, len: 0.5 + Math.random() * 0.55, ph: Math.random() * 6, ph2: Math.random() * 6 });
  }

  // arms
  J.arms = [-1, 1].map((s) => {
    const sh = joint(chest, s * 0.22, 0.2, 0); ball(sh, 0.06);
    const up = cap(0.05, 0.22, M.porcelain); up.position.y = -0.15; sh.add(up);
    const el = joint(sh, 0, -0.31, 0); ball(el, 0.045);
    const fo = cap(0.044, 0.2, M.porcelain); fo.position.y = -0.14; el.add(fo);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.05, 0.17, 16), M.armor); guard.position.y = -0.16; el.add(guard);
    const hand = joint(el, 0, -0.29, 0);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), M.armor); palm.position.y = -0.03; hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.09, 6), M.joint);
      claw.position.set(-0.022 + f * 0.015, -0.11, 0.008); claw.rotation.x = Math.PI + 0.35; hand.add(claw);
    }
    return { sh, el, hand };
  });
  // legs
  J.legs = [-1, 1].map((s) => {
    const hip = joint(pelvis, s * 0.1, -0.06, 0); ball(hip, 0.07);
    const th = cap(0.08, 0.32, M.porcelain); th.position.y = -0.22; hip.add(th);
    const kn = joint(hip, 0, -0.44, 0); ball(kn, 0.06);
    const sn = cap(0.06, 0.32, M.porcelain); sn.position.y = -0.21; kn.add(sn);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.3, 18, 1, true, -Math.PI * 0.65, Math.PI * 1.3), M.armor); shell.position.y = -0.22; kn.add(shell);
    const ft = joint(kn, 0, -0.43, 0);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), M.armor); foot.rotation.x = Math.PI / 2 - 0.5; foot.position.set(0, -0.03, 0.05); ft.add(foot);
    return { hip, kn, ft };
  });
  // decal on the thigh: graphic-realism serial
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#0b0b0c'; x.font = '700 30px "Space Mono", monospace'; x.fillText('07', 6, 34); x.fillStyle = '#c3141b'; x.fillRect(6, 44, 60, 6);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  dec.position.set(0.082, -0.2, 0.02); dec.rotation.y = Math.PI / 2; J.legs[1].hip.add(dec);
})();

// poses: fetal (floating) and slumped (drained)
const POSE = {
  float: { root: [0.25, -0.5, 0.05], spine: 0.42, chest: 0.22, neck: 0.25, head: 0.35, hip: [-2.0, 0.1], knee: 2.35, sh: [-1.0, 0.28], el: -1.55, ft: 0.4 },
  slump: { root: [0.55, -0.5, 0.2], spine: 0.7, chest: 0.35, neck: 0.5, head: 0.65, hip: [-1.1, 0.25], knee: 1.3, sh: [-0.25, 0.1], el: -0.35, ft: 0.2 },
};
function applyPose(k, t) {
  const A = POSE.float, B = POSE.slump, L = (a, b) => lerp(a, b, k);
  const br = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.03 * (1 - k);
  doll.rotation.set(L(A.root[0], B.root[0]) + br, L(A.root[1], B.root[1]) + Math.sin(t * 0.13) * 0.25 * (1 - k), L(A.root[2], B.root[2]));
  J.spine.rotation.x = L(A.spine, B.spine) + br;
  J.chest.rotation.x = L(A.chest, B.chest);
  J.neck.rotation.x = L(A.neck, B.neck);
  J.head.rotation.x = L(A.head, B.head);
  J.legs.forEach((g, i) => { const s = i ? 1 : -1; g.hip.rotation.x = L(A.hip[0], B.hip[0]); g.hip.rotation.z = s * L(A.hip[1], B.hip[1]) * -1; g.kn.rotation.x = L(A.knee, B.knee); g.ft.rotation.x = L(A.ft, B.ft); });
  J.arms.forEach((g, i) => { const s = i ? 1 : -1; g.sh.rotation.x = L(A.sh[0], B.sh[0]) + br; g.sh.rotation.z = -s * L(A.sh[1], B.sh[1]); g.el.rotation.x = L(A.el, B.el); });
}

// hair: line segments updated every frame
const hairGeo = new THREE.BufferGeometry();
const HS = 12;
const hairPos = new Float32Array(J.hairRoots.length * (HS - 1) * 2 * 3);
hairGeo.setAttribute('position', new THREE.BufferAttribute(hairPos, 3));
const hair = new THREE.LineSegments(hairGeo, M.hair); hair.frustumCulled = false; scene.add(hair);
const _r = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
function updateHair(t, submerged) {
  const hq = new THREE.Quaternion(); J.head.getWorldQuaternion(hq);
  let o = 0;
  J.hairRoots.forEach((h) => {
    _r.copy(h.p); J.head.localToWorld(_r);
    _d.copy(h.d).applyQuaternion(hq);
    const float = submerged; // 1 in water: drifting outward and up; 0 drained: hanging down
    const dir = _q.set(_d.x * 0.85 * float, lerp(-1, _d.y * 0.25 + 0.05, float), _d.z * 0.85 * float + (1 - float) * -0.05).normalize();
    const seg = h.len / (HS - 1);
    _p.copy(_r);
    for (let k = 1; k < HS; k++) {
      const prev = [_p.x, _p.y, _p.z];
      const w = (k / HS) * float;
      _p.x += dir.x * seg + Math.sin(t * 0.6 + h.ph + k * 0.55) * 0.045 * w;
      _p.y += dir.y * seg + Math.sin(t * 0.4 + h.ph2 + k * 0.35) * 0.03 * w;
      _p.z += dir.z * seg + Math.cos(t * 0.5 + h.ph + k * 0.5) * 0.045 * w;
      // keep the hair inside the glass
      const rr = Math.hypot(_p.x, _p.z); if (rr > TANK_R - 0.06) { _p.x *= (TANK_R - 0.06) / rr; _p.z *= (TANK_R - 0.06) / rr; }
      if (_p.y < BOTTOM + 0.2) _p.y = BOTTOM + 0.2;
      hairPos[o++] = prev[0]; hairPos[o++] = prev[1]; hairPos[o++] = prev[2];
      hairPos[o++] = _p.x; hairPos[o++] = _p.y; hairPos[o++] = _p.z;
    }
  });
  hairGeo.attributes.position.needsUpdate = true;
}

// cables from the top cap into the spinal ports
const cables = J.ports.map((p, i) => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), M.cable); scene.add(mesh);
  const a = (i / 4) * Math.PI * 2 + 0.8;
  return { mesh, port: p, top: new THREE.Vector3(Math.cos(a) * 0.75, BOTTOM + TANK_H - 0.05, Math.sin(a) * 0.75), sway: Math.random() * 6 };
});
const portV = new THREE.Vector3();
function updateCables(t) {
  cables.forEach((c) => {
    c.port.getWorldPosition(portV);
    const mid = c.top.clone().lerp(portV, 0.55); mid.y += 0.35; mid.x += Math.sin(t * 0.5 + c.sway) * 0.12; mid.z += Math.cos(t * 0.4 + c.sway) * 0.12;
    const back = portV.clone().add(new THREE.Vector3(0, 0.25, 0));
    const curve = new THREE.CatmullRomCurve3([c.top, c.top.clone().add(new THREE.Vector3(0, -0.4, 0)), mid, back, portV.clone()]);
    c.mesh.geometry.dispose();
    c.mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.018, 6, false);
  });
}

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- state & UI
const S = { level: 0.94, mode: 'idle', modeT: 0, eyes: 0, eyesUntil: 0, look: 0, ripple: -10, slump: 0 };
const $ = (id) => document.getElementById(id);
const logEl = $('v-log');
function log(text, cls = '') {
  const d = document.createElement('div'); if (cls) d.className = cls;
  d.textContent = `${new Date().toTimeString().slice(0, 8)}  ${text}`;
  logEl.appendChild(d); while (logEl.children.length > 6) logEl.firstChild.remove();
}
const IDLE_LOG = ['dream activity: shallow', 'port 3: packet received from Node 01', 'hair drift nominal', 'she is counting something in her sleep',
  'O₂ exchange stable', 'port 1: carrier holding at 432.7 MHz', 'REM burst, 0.4 s', 'faint pressure on the glass from inside', 'liquid clarity 98%'];
log('chamber online', 'c'); log('subject NOX-07 dreaming');
let idleTimer = setInterval(() => { if (S.mode === 'idle') log(IDLE_LOG[Math.floor(Math.random() * IDLE_LOG.length)]); }, 4200);

function tap() {
  audio.chime(740, 0.1);
  S.ripple = clock.getElapsedTime();
  if (S.level < 0.3) { log('no response. there is no water to carry the touch.', 'r'); return; }
  S.eyesUntil = clock.getElapsedTime() + 6;
  for (let i = 0; i < 30; i++) { const b = bState[Math.floor(Math.random() * NB)]; resetBubble(b, false); b.y = doll.position.y - 0.3 + Math.random() * 0.4; b.x = (Math.random() - 0.5) * 0.5; b.z = (Math.random() - 0.5) * 0.5; b.v = 0.8 + Math.random(); }
  log(['her eyes opened', 'she is looking at you', 'heart rate spike, 41 → 63', 'she remembers this'][Math.floor(Math.random() * 4)], 'c');
}
$('v-tap').addEventListener('click', tap);

// hold to drain
const drainBtn = $('v-drain');
let holdTimer = null, stopSwell = null;
const startHold = (e) => {
  if (drainBtn.disabled || holdTimer) return; e.preventDefault();
  drainBtn.classList.add('is-holding'); stopSwell = audio.swell(1.6);
  holdTimer = setTimeout(() => { holdTimer = null; drainBtn.classList.remove('is-holding'); if (stopSwell) stopSwell(); drain(); }, 1600);
};
const cancelHold = () => { if (!holdTimer) return; clearTimeout(holdTimer); holdTimer = null; drainBtn.classList.remove('is-holding'); if (stopSwell) stopSwell(); };
drainBtn.addEventListener('pointerdown', startHold);
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => drainBtn.addEventListener(ev, cancelHold));
drainBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
drainBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancelHold(); });
drainBtn.addEventListener('contextmenu', (e) => e.preventDefault());

function drain() {
  S.mode = 'draining'; S.modeT = clock.getElapsedTime();
  drainBtn.disabled = true; drainBtn.querySelector('.txt').textContent = 'Draining…';
  $('alarm').classList.add('is-on'); $('v-alert').textContent = 'warning'; $('v-state').textContent = 'draining';
  log('MANUAL DRAIN ENGAGED', 'r'); log('warning: subject cannot survive outside the liquid', 'r');
  audio.glitch(0.6);
}

// orbit camera by drag
const orbit = { yaw: 0.3, pitch: 0.06, ty: 0.3, tp: 0.06, dist: 8.6, td: 8.6, vy: 0 };
let dragging = false, lastX = 0, lastY = 0, downAt = 0, moved = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = performance.now(); moved = 0; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  orbit.ty = clamp(orbit.ty - dx * 0.006, -1.2, 1.6); orbit.tp = clamp(orbit.tp + dy * 0.004, -0.15, 0.45);
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
cv.addEventListener('pointerup', (e) => {
  dragging = false;
  if (moved < 6 && performance.now() - downAt < 400) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (ray.intersectObjects([glass, liquid], false).length) tap();
  }
});
cv.addEventListener('wheel', (e) => { orbit.td = clamp(orbit.td + e.deltaY * 0.004, 4, 11); }, { passive: true });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ECG
const ecg = $('v-ecg'), ex = ecg.getContext('2d');
const ecgBuf = new Array(150).fill(0); let ecgPhase = 0;
function drawEcg(bpm, dt, alarm) {
  ecgPhase += dt * bpm / 60;
  const f = ecgPhase % 1;
  let v = 0;
  if (f > 0.1 && f < 0.14) v = -0.2; else if (f >= 0.14 && f < 0.18) v = 1; else if (f >= 0.18 && f < 0.22) v = -0.35; else if (f > 0.4 && f < 0.5) v = 0.18;
  ecgBuf.push(v + (Math.random() - 0.5) * 0.04); ecgBuf.shift();
  ex.clearRect(0, 0, ecg.width, ecg.height);
  ex.strokeStyle = alarm ? '#ff2a33' : '#8fe6e8'; ex.lineWidth = 2; ex.beginPath();
  ecgBuf.forEach((y, i) => { const X = (i / (ecgBuf.length - 1)) * ecg.width, Y = ecg.height * 0.6 - y * ecg.height * 0.45; i ? ex.lineTo(X, Y) : ex.moveTo(X, Y); });
  ex.stroke();
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let frameN = 0, lastBeat = 0, started = false;
const headTarget = new THREE.Vector3();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.getElapsedTime();

  // drain cycle
  const since = t - S.modeT;
  if (S.mode === 'draining') { S.level = lerp(0.94, 0.04, clamp(since / 4.2, 0, 1)); if (since > 4.2) { S.mode = 'empty'; S.modeT = t; log('chamber empty', 'r'); log('vitals failing', 'r'); } }
  else if (S.mode === 'empty') { if (since > 3.2) { S.mode = 'refill'; S.modeT = t; log('emergency refill', 'c'); audio.chime(330, 0.12); } }
  else if (S.mode === 'refill') {
    S.level = lerp(0.04, 0.94, clamp(since / 4.6, 0, 1));
    if (since > 4.6) {
      S.mode = 'idle'; drainBtn.disabled = false; drainBtn.querySelector('.txt').textContent = 'Hold to drain';
      $('alarm').classList.remove('is-on'); $('v-alert').textContent = 'nominal'; $('v-state').textContent = 'dreaming';
      log('subject stable. she will not forgive you.', 'c');
    }
  }
  const lv = S.level;
  const liquidH = (TANK_H - 0.1) * lv;
  liquid.scale.y = Math.max(0.001, liquidH); liquid.position.y = BOTTOM + 0.05 + liquidH / 2;
  surface.position.y = BOTTOM + 0.05 + liquidH;
  liquid.visible = lv > 0.02;

  // the doll floats in the middle of the water, or sinks when it drains
  const sub = clamp((lv - 0.18) / 0.6, 0, 1);
  S.slump = lerp(S.slump, 1 - sub, 0.05);
  const floatY = TANK_Y - 0.2 + (reduceMotion ? 0 : Math.sin(t * 0.7) * 0.06);
  doll.position.set(0, lerp(BOTTOM + 0.72, floatY, sub), 0);
  applyPose(S.slump, t);

  // eyes open when tapped, and the head turns toward the camera
  const awake = t < S.eyesUntil && lv > 0.3;
  S.eyes = lerp(S.eyes, awake ? 1 : 0, 0.08);
  J.eyes.forEach(e => { e.scale.y = lerp(0.18, 0.75, S.eyes); });
  M.eye.color.setRGB(lerp(0.1, 0.56, S.eyes), lerp(0.11, 0.9, S.eyes), lerp(0.12, 0.92, S.eyes));
  if (S.eyes > 0.02) {
    J.head.getWorldPosition(headTarget);
    const dx = camera.position.x - headTarget.x, dz = camera.position.z - headTarget.z;
    J.neck.rotation.y = lerp(0, clamp(Math.atan2(dx, dz) - doll.rotation.y, -0.9, 0.9), S.eyes * 0.8);
    J.head.rotation.x -= 0.3 * S.eyes;
  } else J.neck.rotation.y = 0;

  // ripple on tap
  const ra = t - S.ripple;
  ripple.visible = ra < 1.4;
  if (ripple.visible) { ripple.position.y = surface.position.y + 0.005; ripple.scale.setScalar(0.1 + ra * 0.9); ripple.material.opacity = 0.6 * (1 - ra / 1.4); }

  // bubbles only in the water
  const m = new THREE.Matrix4(); const top = surface.position.y;
  bState.forEach((b, i) => {
    b.y += b.v * dt * (reduceMotion ? 0.2 : 1); b.x += Math.sin(t * 2 + b.w) * 0.0015;
    if (b.y > top - 0.02) resetBubble(b, false);
    const vis = lv > 0.06 ? b.s : 0;
    m.makeScale(vis, vis, vis).setPosition(b.x, b.y, b.z); bubbles.setMatrixAt(i, m);
  });
  bubbles.instanceMatrix.needsUpdate = true;

  updateHair(t, sub);
  if (frameN % 2 === 0) updateCables(t);
  caustic.material.uniforms.uT.value = t; caustic.material.uniforms.uLevel.value = lv;
  inner.intensity = 2 + 8 * lv;
  const alarmOn = S.mode !== 'idle';
  alarmLight.intensity = alarmOn ? 40 * (0.5 + 0.5 * Math.sin(t * 6)) : 0;
  glowRingB.material = alarmOn ? M.red : M.ice;

  // camera
  orbit.yaw = lerp(orbit.yaw, orbit.ty + (reduceMotion || dragging ? 0 : Math.sin(t * 0.08) * 0.25), 0.06);
  orbit.pitch = lerp(orbit.pitch, orbit.tp, 0.06); orbit.dist = lerp(orbit.dist, orbit.td, 0.08);
  const narrow = innerWidth < 900;
  const dist = orbit.dist * (narrow ? 1.35 : 1);
  camera.position.set(Math.sin(orbit.yaw) * dist, TANK_Y + 0.3 + Math.sin(orbit.pitch) * dist, Math.cos(orbit.yaw) * dist);
  camera.lookAt(0, TANK_Y - (narrow ? 0.35 : 0.1), 0);

  // vitals
  const bpm = Math.round(S.mode === 'idle' ? 41 + S.eyes * 22 + Math.sin(t * 0.3) * 2 : S.mode === 'empty' ? 128 + Math.sin(t * 9) * 6 : lerp(41, 112, 1 - lv));
  if (frameN % 6 === 0) {
    $('v-bpm').textContent = bpm;
    $('v-o2').textContent = Math.round(lerp(61, 97, sub)) + '%';
    $('v-level').textContent = Math.round(lv * 100) + '%';
    $('v-temp').textContent = (4.2 + (1 - lv) * 14).toFixed(1) + ' °C';
    $('v-neural').style.width = Math.round(20 + S.eyes * 60 + (1 - sub) * 70 + Math.random() * 8) + '%';
  }
  drawEcg(bpm, dt, alarmOn);
  if (t - lastBeat > 60 / bpm && alarmOn) { lastBeat = t; audio.tick(0.5); }

  composer.render();
  frameN++;
  if (!started) { started = true; bootLine.classList.add('is-done'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

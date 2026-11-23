// SIGNAL — a white void of hanging monitors. Each screen runs its own transmission; click one to listen and reply.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initShell, audio, hasWebGL, reduceMotion, clamp, lerp, easeInOut } from './shared.js';

initShell({ crumb: 'Structure / <b>Signal 信号</b>' });
const bootLine = document.getElementById('boot-line');
if (!hasWebGL()) { document.body.classList.add('no-webgl'); bootLine.remove(); throw new Error('no webgl'); }

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f0);
scene.fog = new THREE.FogExp2(0xf2f2f0, 0.032);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d4, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-4, 10, 8); scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);

// ---------------------------------------------------------------- channels
const W = 320, H = 240;
const CH = [
  { name: 'Eye', text: 'It has been watching the room since the power came back.\nIt is not angry. It just wants to be seen back.', replies: ['the eye blinks once. that means yes.', 'the pupil widens. it heard you.', 'it looks at you for a long time.'] },
  { name: 'Static', text: 'ARE YOU STILL CONNECTED\nARE YOU STILL CONNECTED\nARE YOU STILL\n\nthe message repeats every 3.4 seconds. nobody has answered it in years.', replies: ['the static quiets for a moment.', 'connected. connected. connected.', 'a voice under the noise says your name, wrong.'] },
  { name: 'Choir', text: 'A column of names falling forever.\nEvery name is someone who was plugged in and never unplugged.\nYours is not on the list yet.', replies: ['your name was added, then removed.', 'the column pauses where your name would be.', 'the choir hums a single note.'] },
  { name: 'Carrier', text: 'A pure tone at 432.7 MHz, shaped like a heartbeat.\nIt slows down when nobody is listening.', replies: ['the wave spikes red, then settles.', 'carrier holding.', 'the heartbeat matches yours for a second.'] },
  { name: 'Log', text: 'An operator\'s log, still typing.\nThe operator left in 1999. The typing did not.', replies: ['> received. logging.', '> who is this?', '> do not stay in this room too long.'] },
  { name: 'Halo', text: 'A ring of characters, spinning.\nIt is the same halo as the one at Node 01, seen from very far away.', replies: ['the ring tilts toward you.', 'spin rate increased.', 'the halo flickers, red for a frame.'] },
  { name: 'Pulse', text: 'Four ports, four lines.\nSomewhere a metal heart is waiting for its cables.', replies: ['one port lit up.', 'link 1/4.', 'the pulse skips, then continues.'] },
  { name: 'Sweep', text: 'A radar sweep over a map of nothing.\nEvery few turns, something answers from the north edge.', replies: ['contact. bearing 004.', 'the blip moved closer.', 'no contact. try again later.'] },
  { name: 'Angel', text: 'A face made of large pixels, trying to resolve.\nIt has wings in some frames and not in others.', replies: ['the face resolves for one frame. it was smiling.', 'wings: present.', 'it turns away.'] },
];
const NAMES = ['ISOLDE', 'NOX-07', 'AZRAEL.EXE', 'SAELITH', 'VEY', 'MORA', 'ITHRA', 'KAEL', 'SERA', 'LUNE', 'OPHAN', 'CAEL-9', 'YSE', 'ORIVA'];
const LOGS = ['packet lost', 'retrying handshake', 'node 02 dreaming', 'halo spin nominal', 'cable 3 cut at sublevel 9', 'who left the light on', 'do not unplug', 'wings: 6', 'signal: holy', 'end of shift', 'the room is listening'];

const screens = CH.map((c, i) => {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return { ...c, i, cv, x: cv.getContext('2d'), tex, state: { rows: Array.from({ length: 14 }, () => Math.random() * H), lines: [], wave: [], t: 0 } };
});

function frameBg(x, alpha = 1) { x.fillStyle = `rgba(4,8,10,${alpha})`; x.fillRect(0, 0, W, H); }
function scan(x) { x.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1); }
const DRAW = [
  (s, t) => { // eye
    const x = s.x; frameBg(x);
    const open = Math.max(0.05, 1 - Math.pow(Math.max(0, Math.sin(t * 0.7)), 60));
    x.save(); x.translate(W / 2, H / 2);
    x.beginPath(); x.moveTo(-110, 0); x.quadraticCurveTo(0, -95 * open, 110, 0); x.quadraticCurveTo(0, 95 * open, -110, 0); x.closePath();
    x.fillStyle = '#e9e7e2'; x.fill(); x.save(); x.clip();
    const lx = Math.sin(t * 0.4) * 30 + s.look * 28, ly = Math.cos(t * 0.3) * 10;
    x.fillStyle = '#0b0b0c'; x.beginPath(); x.arc(lx, ly, 44, 0, 7); x.fill();
    x.fillStyle = '#c3141b'; x.beginPath(); x.arc(lx, ly, 16, 0, 7); x.fill();
    x.fillStyle = '#e9e7e2'; x.beginPath(); x.arc(lx - 14, ly - 14, 6, 0, 7); x.fill();
    x.restore(); x.restore(); scan(x);
  },
  (s, t) => { // static
    const x = s.x; const img = x.createImageData(W / 2, H / 2);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 1.05; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0); x.drawImage(x.canvas, 0, 0, W / 2, H / 2, 0, 0, W, H);
    if ((t % 3.4) < 1.6) { x.fillStyle = 'rgba(4,8,10,0.8)'; x.fillRect(20, H / 2 - 26, W - 40, 50); x.fillStyle = '#ff2a33'; x.font = '700 17px "Space Mono", monospace'; x.textAlign = 'center'; x.fillText('ARE YOU STILL CONNECTED', W / 2, H / 2 + 6); x.textAlign = 'left'; }
  },
  (s, t) => { // choir: falling names in vertical columns
    const x = s.x; frameBg(x, 0.25); x.font = '13px "Space Mono", monospace';
    s.state.rows.forEach((y, k) => {
      const nm = NAMES[(k + Math.floor(t * 0.5)) % NAMES.length];
      x.fillStyle = k % 5 === 0 ? '#ff2a33' : '#8fe6e8';
      for (let c = 0; c < nm.length; c++) x.fillText(nm[c], 10 + k * 22, (y + c * 14) % (H + 40) - 20);
      s.state.rows[k] = (y + 1.6 + (k % 3)) % (H + 40);
    });
  },
  (s, t) => { // carrier wave
    const x = s.x; frameBg(x);
    x.strokeStyle = 'rgba(143,230,232,0.18)'; x.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 32) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
    for (let gy = 0; gy < H; gy += 32) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
    x.strokeStyle = '#ff2a33'; x.lineWidth = 2.5; x.beginPath();
    for (let i = 0; i <= W; i += 2) {
      const ph = i / W * 12 - t * 4; const beat = Math.exp(-Math.pow(((ph % 6) + 6) % 6 - 3, 2) * 4);
      const y = H / 2 + Math.sin(ph * 2.2) * 14 - beat * 70 * (0.6 + s.boost);
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke(); x.fillStyle = '#8fe6e8'; x.font = '12px "Space Mono", monospace'; x.fillText('432.7 MHz', 12, 22); scan(x);
  },
  (s, t) => { // operator log typing
    const x = s.x; frameBg(x); const st = s.state;
    if (!st.cur || st.cur.done >= st.cur.text.length + 20) { st.cur = { text: '> ' + LOGS[Math.floor(Math.random() * LOGS.length)], done: 0 }; st.lines.push(st.cur); if (st.lines.length > 11) st.lines.shift(); }
    st.cur.done += 0.6;
    x.font = '13px "Space Mono", monospace';
    st.lines.forEach((l, k) => { x.fillStyle = l === st.cur ? '#e9e7e2' : 'rgba(143,230,232,0.7)'; x.fillText(l.text.slice(0, Math.floor(l.done)) + (l === st.cur && (t * 2) % 1 < 0.5 ? '█' : ''), 12, 24 + k * 19); });
    scan(x);
  },
  (s, t) => { // ascii halo
    const x = s.x; frameBg(x); x.font = '12px "Space Mono", monospace'; x.textAlign = 'center';
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2 + t * 0.8;
      const px = W / 2 + Math.cos(a) * 110, py = H / 2 + Math.sin(a) * 30 * Math.cos(t * 0.3) - 10;
      const front = Math.sin(a) > 0;
      x.fillStyle = (i % 9 === 0) ? '#ff2a33' : front ? '#e9e7e2' : 'rgba(143,230,232,0.5)';
      x.fillText('.:-=+*#%@'[Math.floor((Math.sin(a) * 0.5 + 0.5) * 8.99)], px, py);
      if (i % 4 === 0) x.fillText('|', px, py + (front ? 14 : -14));
    }
    x.textAlign = 'left'; scan(x);
  },
  (s, t) => { // four-port pulse
    const x = s.x; frameBg(x); x.font = '11px "Space Mono", monospace';
    for (let k = 0; k < 4; k++) {
      const y0 = 30 + k * 52; const lit = k < 1 + Math.floor((t * 0.25) % 4) || s.boost > 0.5;
      x.fillStyle = lit ? '#ff2a33' : 'rgba(143,230,232,0.6)'; x.fillText('PORT ' + (k + 1), 10, y0 + 4);
      x.strokeStyle = lit ? '#ff2a33' : 'rgba(143,230,232,0.4)'; x.lineWidth = 2; x.beginPath();
      for (let i = 70; i < W - 10; i += 2) { const f = ((i / W) * 3 - t * 0.9 + k * 0.2) % 1; const fy = f > 0.45 && f < 0.5 ? -18 : f > 0.5 && f < 0.53 ? 10 : 0; i === 70 ? x.moveTo(i, y0 + fy) : x.lineTo(i, y0 + fy); }
      x.stroke();
    }
    scan(x);
  },
  (s, t) => { // radar
    const x = s.x; frameBg(x, 0.18);
    x.save(); x.translate(W / 2, H / 2);
    x.strokeStyle = 'rgba(143,230,232,0.35)'; x.lineWidth = 1;
    [40, 75, 105].forEach(r => { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); });
    const a = t * 1.6; x.strokeStyle = '#8fe6e8'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 110, Math.sin(a) * 110); x.stroke();
    const ba = -Math.PI / 2 + 0.07, near = Math.abs(((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) < 0.3;
    if (near || s.boost > 0.5) { x.fillStyle = '#ff2a33'; x.beginPath(); x.arc(Math.cos(ba) * (90 - s.boost * 30), Math.sin(ba) * (90 - s.boost * 30), 5, 0, 7); x.fill(); }
    x.restore();
  },
  (s, t) => { // pixel angel
    const x = s.x; frameBg(x); const px = 16;
    const res = 0.5 + 0.5 * Math.sin(t * 0.5);
    for (let gy = 0; gy < H / px; gy++) for (let gx = 0; gx < W / px; gx++) {
      const u = (gx - W / px / 2) / 6, v = (gy - H / px / 2) / 6;
      const head = Math.hypot(u, v + 0.6) < 0.45, body = Math.abs(u) < 0.32 - v * 0.1 && v > -0.2 && v < 1.4;
      const wing = (Math.abs(u) > 0.4 && Math.abs(u) < 2.2 && v > -0.7 + Math.abs(u) * 0.2 && v < 0.6 - Math.abs(u) * 0.15) && Math.sin(t * 2) > -0.6;
      const halo = Math.abs(Math.hypot(u * 0.6, (v + 1.35) * 2.2) - 0.5) < 0.12;
      let on = head || body || wing || halo;
      if (Math.random() > res * 0.6 + 0.4) on = !on && Math.random() < 0.1;
      if (on) { x.fillStyle = halo ? '#ff2a33' : wing ? 'rgba(143,230,232,0.8)' : '#e9e7e2'; x.fillRect(gx * px + 1, gy * px + 1, px - 2, px - 2); }
    }
  },
];

// ---------------------------------------------------------------- monitors
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf4f4f2, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  black: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.3, clearcoat: 0.6 }),
  cable: new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.4, clearcoat: 0.5 }),
  red: new THREE.MeshPhysicalMaterial({ color: 0xb3121a, roughness: 0.35, clearcoat: 0.6 }),
};
const LAYOUT = [[-4.6, 1.2, -1], [-1.4, 2.6, 0.6], [2.2, 1.6, -0.4], [5.2, 2.9, -2.2], [-3.2, -1.6, 1.2], [0.6, -0.6, 1.8], [3.8, -1.4, 0.8], [-6.4, -0.4, -3], [7, -0.2, -4]];
const monitors = screens.map((s, i) => {
  const g = new THREE.Group();
  const sz = 0.85 + (i % 3) * 0.22;
  const crt = i % 3 === 1;
  const body = new THREE.Mesh(crt ? new THREE.BoxGeometry(2.0 * sz, 1.55 * sz, 1.3 * sz) : new THREE.BoxGeometry(2.1 * sz, 1.45 * sz, 0.16), i % 4 === 3 ? M.black : M.white);
  if (crt) body.position.z = -0.55 * sz;
  g.add(body);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.94 * sz, 1.32 * sz, 0.04), M.black); bezel.position.z = crt ? 0.12 : 0.085; g.add(bezel);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.76 * sz, 1.2 * sz), new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
  scr.position.z = (crt ? 0.12 : 0.085) + 0.022; g.add(scr);
  // a decal: graphic-realism serial
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 32; const dx = dc.getContext('2d');
  dx.fillStyle = i % 4 === 3 ? '#e9e7e2' : '#0b0b0c'; dx.font = '700 18px "Space Mono", monospace'; dx.fillText(`CH-0${i + 1} // ${s.name.toUpperCase()}`, 4, 22);
  const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * sz, 0.11 * sz), new THREE.MeshBasicMaterial({ map: dt, transparent: true }));
  decal.position.set(-0.45 * sz, -0.69 * sz, (crt ? 0.12 : 0.085) + 0.001); g.add(decal);
  const [x, y, z] = LAYOUT[i];
  g.position.set(x, y, z);
  g.rotation.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.7 - x * 0.04, (Math.random() - 0.5) * 0.2);
  g.userData = { base: g.position.clone(), rot: g.rotation.clone(), phase: Math.random() * 6, i, scr };
  scene.add(g);
  // cables up into the white, plus one or two loose ones
  const top = new THREE.Vector3(x + (Math.random() - 0.5) * 2, 16, z + (Math.random() - 0.5) * 2);
  g.userData.cable = { top, mesh: new THREE.Mesh(new THREE.BufferGeometry(), M.cable) };
  scene.add(g.userData.cable.mesh);
  s.mon = g; s.look = 0; s.boost = 0;
  return g;
});
// red threads between neighbours (the wound in the white)
const threads = [[0, 1], [1, 5], [5, 6], [2, 3]].map(([a, b]) => ({ a: monitors[a], b: monitors[b], mesh: new THREE.Mesh(new THREE.BufferGeometry(), M.red) }));
threads.forEach(t => scene.add(t.mesh));
// loose cables hanging in the distance
for (let i = 0; i < 40; i++) {
  const x = (Math.random() - 0.5) * 50, z = -6 - Math.random() * 30;
  const len = 6 + Math.random() * 18;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 18, z), new THREE.Vector3(x + (Math.random() - 0.5), 18 - len * 0.5, z), new THREE.Vector3(x + (Math.random() - 0.5) * 2, 18 - len, z + (Math.random() - 0.5))]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.03, 5), M.cable));
}
// soft floor shadow plane, very faint
const shadow = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshBasicMaterial({ color: 0xdedfdc, transparent: true, opacity: 0.6 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = -5.5; scene.add(shadow);

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function updateCables(t) {
  monitors.forEach((g) => {
    const c = g.userData.cable; _a.set(0, 0.7, -0.05).applyMatrix4(g.matrixWorld);
    const mid = _a.clone().lerp(c.top, 0.5); mid.x += Math.sin(t * 0.3 + g.userData.phase) * 0.3;
    c.mesh.geometry.dispose(); c.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([_a.clone(), mid, c.top]), 24, 0.035, 6);
  });
  threads.forEach((th) => {
    _a.set(0.8, -0.5, 0).applyMatrix4(th.a.matrixWorld); _b.set(-0.8, -0.5, 0).applyMatrix4(th.b.matrixWorld);
    const mid = _a.clone().lerp(_b, 0.5); mid.y -= 1.2 + Math.sin(t * 0.5) * 0.1;
    th.mesh.geometry.dispose(); th.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([_a.clone(), mid, _b.clone()]), 24, 0.015, 5);
  });
}

// ---------------------------------------------------------------- camera & interaction
const HOME = { pos: new THREE.Vector3(0, 0.6, 13.5), look: new THREE.Vector3(0, 0.4, 0) };
const cam = { pos: HOME.pos.clone(), look: HOME.look.clone() };
let fly = null, focus = -1;
if (innerWidth < 860) { cam.pos.set(0, 0.3, 21); cam.look.set(0, 0.6, 0); }
const drift = { x: 0, y: 0, tx: 0, ty: 0 };

function poseFor(i) {
  if (i < 0) return innerWidth < 860 ? { pos: new THREE.Vector3(0, 0.3, 21), look: new THREE.Vector3(0, 0.6, 0) } : HOME;
  const g = monitors[i]; g.updateMatrixWorld();
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
  const narrow = innerWidth < 860;
  const center = g.position.clone();
  const right = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize().negate();
  const pos = center.clone().addScaledVector(normal, narrow ? 4.4 : 3.6).addScaledVector(right, narrow ? 0 : 1.1).addScaledVector(new THREE.Vector3(0, 1, 0), narrow ? -1.1 : 0);
  const look = center.clone().addScaledVector(right, narrow ? 0 : 1.1).addScaledVector(new THREE.Vector3(0, 1, 0), narrow ? -1.0 : 0);
  return { pos, look };
}
function go(i) {
  focus = i;
  const to = poseFor(i);
  fly = { from: { pos: cam.pos.clone(), look: cam.look.clone() }, to, t0: performance.now(), dur: reduceMotion ? 1 : 1300 };
  audio.glitch(0.12);
  const intro = document.getElementById('s-intro'), panel = document.getElementById('s-focus');
  if (i < 0) { panel.hidden = true; intro.classList.remove('is-away'); return; }
  intro.classList.add('is-away');
  const s = screens[i];
  panel.hidden = false; panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
  document.getElementById('sf-code').textContent = `CH-0${i + 1}`;
  document.getElementById('sf-name').textContent = s.name;
  document.getElementById('sf-out').innerHTML = '';
  typeText(document.getElementById('sf-text'), s.text);
  audio.chime(392 + i * 40, 0.06);
}
let typeTimer = null;
function typeText(el, text) {
  clearInterval(typeTimer); el.textContent = '';
  if (reduceMotion) { el.textContent = text; return; }
  let k = 0; typeTimer = setInterval(() => { k += 2; el.textContent = text.slice(0, k); if (k >= text.length) clearInterval(typeTimer); }, 16);
}
document.getElementById('sf-back').addEventListener('click', () => go(-1));
document.getElementById('sf-prev').addEventListener('click', () => go((focus + screens.length - 1) % screens.length));
document.getElementById('sf-next').addEventListener('click', () => go((focus + 1) % screens.length));
document.getElementById('sf-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = document.getElementById('sf-in'); const msg = inp.value.trim(); if (!msg || focus < 0) return;
  inp.value = '';
  const s = screens[focus]; s.boost = 1;
  const out = document.getElementById('sf-out');
  const reply = s.replies[Math.floor(Math.random() * s.replies.length)];
  out.innerHTML = '';
  const me = document.createElement('div'); me.className = 'me'; me.textContent = '> ' + msg; out.appendChild(me);
  const it = document.createElement('div'); out.appendChild(it);
  setTimeout(() => { typeText(it, reply); audio.tick(1.3); }, 500);
});
addEventListener('keydown', (e) => {
  if (e.target.closest('input')) return;
  if (e.key === 'Escape') go(-1);
  if (e.key === 'ArrowRight') go((focus + 1) % screens.length);
  if (e.key === 'ArrowLeft') go((focus + screens.length - 1) % screens.length);
});

const cv = renderer.domElement;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null, hover = -1;
cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointermove', (e) => {
  drift.tx = (e.clientX / innerWidth - 0.5) * 2; drift.ty = (e.clientY / innerHeight - 0.5) * 2;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(monitors, true)[0];
  hover = hit ? monitors.findIndex(g => g === hit.object.parent) : -1;
  dispatchEvent(new CustomEvent('cursorhover', { detail: hover >= 0 }));
});
cv.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(monitors, true)[0];
  if (hit) { const i = monitors.findIndex(g => g === hit.object.parent); if (i >= 0 && i !== focus) go(i); }
  else if (focus >= 0) go(-1);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let lastDraw = 0, frameN = 0, started = false;
function frame() {
  const t = clock.getElapsedTime();
  monitors.forEach((g) => {
    const u = g.userData; const k = reduceMotion ? 0 : 1;
    g.position.y = u.base.y + Math.sin(t * 0.5 + u.phase) * 0.12 * k;
    g.rotation.y = u.rot.y + Math.sin(t * 0.3 + u.phase) * 0.06 * k;
    g.rotation.z = u.rot.z + Math.sin(t * 0.4 + u.phase) * 0.02 * k;
  });
  if (t - lastDraw > 1 / 15) {
    lastDraw = t;
    screens.forEach((s, i) => {
      s.boost = Math.max(0, s.boost - 0.02);
      s.look = lerp(s.look, (drift.x), 0.2);
      // only redraw screens that matter more often
      if (i === focus || i === hover || frameN % 2 === i % 2) { DRAW[i](s, t); s.tex.needsUpdate = true; }
    });
  }
  if (frameN % 2 === 0) updateCables(t);

  drift.x += (drift.tx - drift.x) * 0.04; drift.y += (drift.ty - drift.y) * 0.04;
  if (fly) {
    const k = clamp((performance.now() - fly.t0) / fly.dur, 0, 1), e = easeInOut(k);
    cam.pos.lerpVectors(fly.from.pos, fly.to.pos, e); cam.look.lerpVectors(fly.from.look, fly.to.look, e);
    if (k >= 1) fly = null;
  } else if (focus >= 0) { const p = poseFor(focus); cam.pos.lerp(p.pos, 0.1); cam.look.lerp(p.look, 0.1); }
  const amp = focus >= 0 ? 0.25 : 1;
  camera.position.copy(cam.pos);
  if (!reduceMotion) { camera.position.x += drift.x * 1.4 * amp; camera.position.y += -drift.y * 0.8 * amp; }
  camera.lookAt(cam.look);
  renderer.render(scene, camera);
  frameN++;
  if (!started) { started = true; bootLine.classList.add('is-done'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__signalGo = go; // test hook

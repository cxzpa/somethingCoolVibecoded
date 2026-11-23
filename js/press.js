// PRESS — a flyer machine. Seeded generator in the board's print language: red sun, chrome forms,
// vertical Japanese, barcodes, warning stamps, technical diagrams, glitch slices, scanned paper.
import { initShell, audio, reduceMotion } from './shared.js';

initShell({ crumb: 'Structure / <b>Press 印刷</b>' });

const cv = document.getElementById('poster');
const x = cv.getContext('2d', { willReadFrequently: true });
const W = cv.width, H = cv.height;
const INK = '#0b0b0c', BONE = '#e9e7e2', RED = '#c3141b', ICE = '#8fe6e8';

const TITLES = ['Not A Real Heaven', 'Static Choir', 'Wired Angel', 'Disconnect', 'Vessel 07', 'Halo Protocol', 'Sublevel 9', 'Seraph.exe',
  'Lonely Signal', 'Thorn Network', 'After Hours', 'Ghost Carrier', 'Porcelain', 'Six Wings', 'Unplugged', 'Holy Static', 'Dead Channel', 'Glass Saint'];
const JP = ['天使回線', '信号', '容器', '光輪', '刺青', '構造体', '接続', '切断', '祈り', '静電気', '聖なる', '翼'];
const SMALL = ['DOORS 23:00 / NO ENTRY AFTER THE SIGNAL', 'ALL AGES / NO HALOS AT THE DOOR', 'LIVE FROM SUBLEVEL 9', 'BROADCAST ONLY, NEVER RECORDED',
  'BRING YOUR OWN CABLE', 'ADMISSION: ONE NAME', 'IF YOU CAN READ THIS YOU ARE ALREADY CONNECTED', 'DO NOT LOOK DIRECTLY AT THE CHOIR'];
const LAYOUTS = ['Red sun', 'Chrome form', 'Technical', 'Dead channel'];

function rng(seed) { let s = seed >>> 0 || 7; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
let R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const rr = (a, b) => a + (b - a) * R();

// ---------------------------------------------------------------- primitives
function paper(dark) {
  x.fillStyle = dark ? '#0d0d0f' : '#e6e3dc'; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * (dark ? 14 : 18); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
function fold() {
  x.strokeStyle = 'rgba(0,0,0,0.08)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, H / 2 + rr(-20, 20)); x.lineTo(W, H / 2 + rr(-20, 20)); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 + rr(-10, 10), 0); x.lineTo(W / 2 + rr(-10, 10), H); x.stroke();
}
function barcode(bx, by, w, h, color) {
  x.fillStyle = color; let cx = bx;
  while (cx < bx + w) { const bw = 2 + Math.floor(R() * 6); if (R() > 0.4) x.fillRect(cx, by, bw, h); cx += bw + 2; }
}
function smallPrint(px, py, w, color, lines = 5) {
  x.fillStyle = color; x.font = '16px "Space Mono", monospace';
  for (let i = 0; i < lines; i++) { let s = ''; while (x.measureText(s).width < w * rr(0.5, 1)) s += pick(['DATA', '0x7F', 'NODE', 'SIG', 'HALO', '////', 'AL', '98', 'TX', 'RX', '+++', 'NULL']) + ' '; x.fillText(s.trim(), px, py + i * 22); }
}
function vertJP(text, px, py, size, color) {
  x.fillStyle = color; x.font = `${size}px "DotGothic16", monospace`; x.textAlign = 'center';
  [...text].forEach((ch, i) => x.fillText(ch, px, py + i * size * 1.08)); x.textAlign = 'left';
}
function stamp(px, py, rot, label) {
  x.save(); x.translate(px, py); x.rotate(rot);
  x.strokeStyle = RED; x.fillStyle = RED; x.lineWidth = 6; x.globalAlpha = 0.86;
  x.font = '700 46px "Syncopate", sans-serif'; const w = x.measureText(label).width + 60;
  x.strokeRect(-w / 2, -44, w, 84); x.lineWidth = 2; x.strokeRect(-w / 2 + 10, -34, w - 20, 64);
  x.textAlign = 'center'; x.fillText(label, 0, 16); x.restore(); x.globalAlpha = 1; x.textAlign = 'left';
}
function regMarks(color) {
  x.strokeStyle = color; x.lineWidth = 2;
  [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 14, 0, 7); x.moveTo(a - 24, b); x.lineTo(a + 24, b); x.moveTo(a, b - 24); x.lineTo(a, b + 24); x.stroke(); });
}
function tape(px, py, rot) {
  x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = 'rgba(230,226,210,0.55)'; x.fillRect(-90, -26, 180, 52);
  x.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = -90; i < 90; i += 9) x.fillRect(i, -26, 2, 52); x.restore();
}
function halftone(cxp, cyp, r, color) {
  x.fillStyle = color;
  for (let gy = cyp - r; gy < cyp + r; gy += 14) for (let gx = cxp - r; gx < cxp + r; gx += 14) {
    const d = Math.hypot(gx - cxp, gy - cyp) / r; if (d > 1) continue;
    x.beginPath(); x.arc(gx, gy, (1 - d) * 6, 0, 7); x.fill();
  }
}
function title(text, px, py, size, color, font = 'goth', maxW = W - 140) {
  x.fillStyle = color;
  const f = font === 'goth' ? `800 ${size}px "Grenze Gotisch", serif` : `700 ${size}px "Syncopate", sans-serif`;
  x.font = f; while (x.measureText(text).width > maxW && size > 30) { size -= 4; x.font = font === 'goth' ? `800 ${size}px "Grenze Gotisch", serif` : `700 ${size}px "Syncopate", sans-serif`; }
  x.fillText(text, px, py); return size;
}
function wrapTitle(text, px, py, size, color, maxW) {
  const words = text.split(' '); const lines = []; let line = '';
  x.font = `800 ${size}px "Grenze Gotisch", serif`;
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  lines.push(line);
  x.fillStyle = color; lines.forEach((l, i) => x.fillText(l, px, py + i * size * 0.86)); return lines.length;
}
function chromeBlob(cxp, cyp, r) {
  // a chrome form: lumpy closed curve filled with banded metal gradient
  const n = 9, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rad = r * rr(0.6, 1.15); pts.push([cxp + Math.cos(a) * rad, cyp + Math.sin(a) * rad * rr(0.7, 1.2)]); }
  x.save(); x.beginPath();
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; i ? x.quadraticCurveTo(p[0], p[1], mx, my) : x.moveTo(mx, my); }
  x.closePath();
  const g = x.createLinearGradient(cxp - r, cyp - r, cxp + r * 0.6, cyp + r);
  [[0, '#f8f9fb'], [0.12, '#8b9099'], [0.22, '#141518'], [0.38, '#e6e8ec'], [0.5, '#5b5f68'], [0.62, '#0d0e10'], [0.78, '#c9ccd2'], [1, '#2a2c31']].forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g; x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 40; x.shadowOffsetY = 20; x.fill();
  x.shadowBlur = 0; x.shadowOffsetY = 0;
  x.clip(); const s = x.createLinearGradient(cxp - r, cyp, cxp + r, cyp);
  s.addColorStop(0.45, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.7)'); s.addColorStop(0.55, 'rgba(255,255,255,0)');
  x.fillStyle = s; x.fillRect(cxp - r * 1.3, cyp - r * 1.3, r * 2.6, r * 2.6);
  x.restore();
}
function thornRing(cxp, cyp, rx, ry, color, n = 34) {
  x.strokeStyle = color; x.lineWidth = 7; x.beginPath(); x.ellipse(cxp, cyp, rx, ry, 0, 0, 7); x.stroke();
  x.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, px = cxp + Math.cos(a) * rx, py = cyp + Math.sin(a) * ry, L = i % 3 ? 26 : 54;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L * (ry / rx) * 2.2); x.stroke();
  }
}
function glitchSlices(amount) {
  for (let i = 0; i < amount; i++) {
    const sy = Math.floor(rr(0, H - 60)), sh = Math.floor(rr(4, 40)), dx = Math.floor(rr(-90, 90));
    const slice = x.getImageData(0, sy, W, sh); x.putImageData(slice, dx, sy);
  }
}
function wingDiagram(cxp, cyp, s, color) {
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 3;
  [1, -1].forEach((side) => {
    for (let k = 0; k < 9; k++) {
      const a = -0.5 + k * 0.17, L = s * (0.45 + k * 0.07);
      x.save(); x.translate(cxp + side * 30, cyp); x.scale(side, 1); x.rotate(a - Math.PI / 2 + 1.2);
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * 0.3, -14, L, 0); x.quadraticCurveTo(L * 0.6, 8, 0, 0);
      k % 3 ? x.stroke() : x.fill(); x.restore();
    }
  });
  x.beginPath(); x.ellipse(cxp, cyp - s * 0.55, s * 0.28, s * 0.07, 0, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(cxp, cyp - s * 0.35); x.lineTo(cxp, cyp + s * 0.7); x.stroke();
}
function leader(px, py, tx, ty, label, color) {
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 2;
  x.beginPath(); x.arc(px, py, 7, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(px, py); x.lineTo(tx, ty); x.lineTo(tx + (tx > px ? 120 : -120), ty); x.stroke();
  x.font = '18px "Space Mono", monospace'; x.textAlign = tx > px ? 'left' : 'right'; x.fillText(label, tx + (tx > px ? 6 : -6), ty - 8); x.textAlign = 'left';
}

// ---------------------------------------------------------------- layouts
const L = [
  function redSun(seed) { // red sun, thorn halo, vertical Japanese, blackletter
    const dark = R() < 0.35; paper(dark); const ink = dark ? BONE : INK;
    const sx = rr(500, 800), sy = rr(480, 700), sr = rr(250, 380);
    x.fillStyle = RED; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill();
    halftone(sx - sr * 0.4, sy + sr * 0.5, sr * 0.7, dark ? 'rgba(233,231,226,0.15)' : 'rgba(11,11,12,0.12)');
    thornRing(sx, sy - sr * 0.15, sr * 0.75, sr * 0.2, ink);
    vertJP(pick(JP) + pick(JP), 110, 160, 74, ink);
    const t = pick(TITLES); const lines = wrapTitle(t, 80, H - 470, 190, ink, W - 160);
    x.fillStyle = ink; x.fillRect(80, H - 300 + (lines - 2) * 20, W - 160, 4);
    smallPrint(80, H - 250, 640, ink, 4); barcode(W - 380, H - 250, 300, 90, ink);
    x.font = '22px "Space Mono", monospace'; x.fillText(pick(SMALL), 80, H - 120);
    regMarks(dark ? 'rgba(233,231,226,0.4)' : 'rgba(11,11,12,0.4)');
    if (R() < 0.6) stamp(rr(780, 960), rr(1050, 1180), rr(-0.3, 0.2), pick(['WARNING', 'BLESSED', 'NO SIGNAL', 'SOLD OUT']));
  },
  function chrome(seed) { // chrome form + exploded wide type + grid
    paper(true);
    x.strokeStyle = 'rgba(143,230,232,0.14)'; x.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 60) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
    for (let gy = 0; gy < H; gy += 60) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
    x.strokeStyle = 'rgba(233,231,226,0.25)'; x.lineWidth = 2;
    for (let k = 0; k < 6; k++) { const o = rr(-400, 400); x.beginPath(); x.moveTo(0, H / 2 + o); x.lineTo(W, H / 2 + o - W); x.stroke(); }
    chromeBlob(rr(450, 750), rr(650, 900), rr(260, 360));
    if (R() < 0.6) chromeBlob(rr(200, 1000), rr(300, 1300), rr(80, 140));
    const word = pick(TITLES).split(' ')[0].toUpperCase();
    x.font = '700 120px "Syncopate", sans-serif'; x.fillStyle = BONE;
    const step = (W - 160) / Math.max(1, word.length - 1);
    [...word].forEach((ch, i) => x.fillText(ch, 60 + i * step - 30, 230 + Math.sin(i * 1.3) * 30));
    x.fillStyle = ICE; x.font = '22px "Space Mono", monospace'; x.fillText(`${pick(JP)} // ${pick(SMALL)}`, 80, H - 200);
    smallPrint(80, H - 160, 700, 'rgba(233,231,226,0.6)', 3); barcode(W - 360, H - 190, 280, 80, BONE);
    x.fillStyle = RED; x.fillRect(80, 300, rr(120, 300), 18);
    regMarks('rgba(233,231,226,0.35)');
  },
  function technical(seed) { // vectorheart diagram: wings, halo, leaders, big number
    paper(false);
    x.strokeStyle = 'rgba(11,11,12,0.12)'; x.lineWidth = 1;
    for (let k = -H; k < W; k += 70) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + H, H); x.stroke(); }
    x.fillStyle = RED; x.fillRect(rr(60, 600), rr(100, 300), rr(200, 500), rr(120, 260));
    wingDiagram(W / 2, 820, 520, INK);
    leader(W / 2, 820 - 286, 860, 380, 'HALO / THORNED', INK);
    leader(W / 2 - 300, 760, 180, 1140, 'PRIMARY BLADE 0' + Math.floor(rr(1, 9)), INK);
    leader(W / 2 + 40, 980, 900, 1180, 'SPINAL PORT 4/6', INK);
    x.font = '800 380px "Syncopate", sans-serif'; x.fillStyle = 'rgba(11,11,12,0.9)'; x.fillText(String(Math.floor(rr(1, 99))).padStart(2, '0'), 70, H - 240);
    title(pick(TITLES).toUpperCase(), 80, H - 170, 64, INK, 'wide');
    smallPrint(80, H - 120, 600, INK, 3); barcode(W - 360, H - 150, 280, 80, INK);
    vertJP(pick(JP), W - 90, 140, 56, RED);
    regMarks('rgba(11,11,12,0.4)');
  },
  function deadChannel(seed) { // glitched teal "photo", white condensed caption, stamp
    paper(true);
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f3a3f'); g.addColorStop(0.5, '#5fb7bd'); g.addColorStop(1, '#091a1d');
    x.fillStyle = g; x.fillRect(70, 120, W - 140, 1160);
    // a ghostly figure: blurred shapes
    x.save(); x.beginPath(); x.rect(70, 120, W - 140, 1160); x.clip();
    x.filter = 'blur(18px)'; x.fillStyle = 'rgba(233,247,248,0.75)';
    x.beginPath(); x.ellipse(W / 2 + rr(-80, 80), 520, 120, 150, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(W / 2 + rr(-80, 80), 980, 260, 360, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(11,30,32,0.8)'; x.beginPath(); x.ellipse(W / 2 + rr(-120, 120), 430, 160, 120, 0, 0, 7); x.fill();
    x.filter = 'none';
    for (let i = 0; i < 26; i++) { const ly = 120 + R() * 1160; x.fillStyle = `rgba(233,247,248,${R() * 0.25})`; x.fillRect(70, ly, W - 140, rr(1, 4)); }
    x.restore();
    glitchSlices(16);
    x.fillStyle = BONE; x.font = '700 92px "Syncopate", sans-serif'; x.textAlign = 'center';
    x.fillText(pick(['DISCONNECTED', 'AM I FADING', 'NO CARRIER', 'STILL HERE', 'UNPLUGGED']), W / 2, 1230); x.textAlign = 'left';
    title(pick(TITLES), 80, H - 330, 140, BONE);
    x.fillStyle = ICE; x.font = '22px "Space Mono", monospace'; x.fillText(pick(SMALL), 80, H - 250);
    smallPrint(80, H - 210, 640, 'rgba(233,231,226,0.55)', 3); barcode(W - 360, H - 230, 280, 80, BONE);
    vertJP(pick(JP), W - 40, 160, 40, BONE);
    if (R() < 0.7) stamp(rr(260, 520), rr(260, 420), rr(-0.25, 0.25), pick(['WARNING', 'NO SIGNAL', 'DO NOT OPEN']));
  },
];

// ---------------------------------------------------------------- printing
const history = [];
let count = 0;
function render(seed, layout) {
  R = rng(seed);
  L[layout](seed);
  fold();
  if (R() < 0.5) tape(rr(200, 400), 40, rr(-0.2, 0.2));
  if (R() < 0.4) tape(rr(800, 1000), 40, rr(-0.2, 0.2));
  // serial at the very bottom edge
  x.fillStyle = 'rgba(128,128,128,0.8)'; x.font = '14px "Space Mono", monospace';
  x.fillText(`AL-PRESS 98 // ${String(seed).padStart(10, '0')} // ${LAYOUTS[layout].toUpperCase()}`, 70, H - 22);
  document.getElementById('p-layout').textContent = LAYOUTS[layout];
  document.getElementById('p-seed').textContent = String(seed).padStart(10, '0');
  cv.setAttribute('aria-label', `A generated flyer, layout ${LAYOUTS[layout]}, seed ${seed}.`);
}
let lastLayout = -1;
function print(seed = (Math.random() * 4294967295) >>> 0, layout = (lastLayout + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length, feed = true) {
  lastLayout = layout;
  history.push({ seed, layout }); count++;
  document.getElementById('p-count').textContent = 'print ' + String(count).padStart(3, '0');
  render(seed, layout);
  if (feed && !reduceMotion) {
    cv.classList.remove('is-feeding'); void cv.offsetWidth; cv.classList.add('is-feeding');
    for (let i = 0; i < 12; i++) setTimeout(() => audio.tick(0.4 + (i % 2) * 0.2), i * 100);
  }
}
document.getElementById('p-print').addEventListener('click', () => print());
document.getElementById('p-prev').addEventListener('click', () => {
  if (history.length < 2) return; history.pop(); const h = history.pop(); count -= 2; print(h.seed, h.layout, false);
});
document.getElementById('p-save').addEventListener('click', () => {
  const h = history[history.length - 1];
  cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `angel-line-press-${h.seed}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
});
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.target.closest('button, input')) { e.preventDefault(); print(); } });

Promise.all(['800 80px "Grenze Gotisch"', '700 40px "Syncopate"', '16px "Space Mono"', '40px "DotGothic16"'].map(f => document.fonts.load(f).catch(() => {})))
  .then(() => print(undefined, 0));

// FLASH — a symmetry ink table. Every stroke is mirrored into a gothic sigil; "Bless it" draws one for you.
import { initShell, audio, reduceMotion, clamp } from './shared.js';

initShell({ crumb: 'Structure / <b>Flash 刺青</b>' });

const INK = '#0b0b0c', RED = '#b3121a', PAPER = '#ecebe6';
const paper = document.getElementById('paper'), px = paper.getContext('2d');
const inkCv = document.getElementById('ink'), ix = inkCv.getContext('2d');
let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, S = 1;
const strokes = [];
let sym = 6, brush = 'ink', current = null, sheetNo = 100 + Math.floor(Math.random() * 900);

function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  [paper, inkCv].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
  const narrow = W < 860;
  const panelRight = narrow ? 0 : document.querySelector('.f-tools').getBoundingClientRect().right;
  cx = narrow ? W / 2 : (panelRight + W) / 2;
  cy = narrow ? H * 0.36 : H / 2;
  S = Math.min(narrow ? W : W - panelRight, narrow ? H * 0.62 : H) * 0.4;
  drawPaper(); redraw();
}

function drawPaper() {
  const x = px; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(60,50,40,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
  const v = x.createRadialGradient(cx, cy, S * 0.4, cx, cy, Math.max(W, H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,50,40,0.12)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  // drafting guides
  x.strokeStyle = 'rgba(11,11,12,0.12)'; x.lineWidth = 1;
  x.beginPath(); x.arc(cx, cy, S, 0, Math.PI * 2); x.stroke();
  x.setLineDash([3, 6]); x.beginPath(); x.arc(cx, cy, S * 0.62, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  x.beginPath(); x.moveTo(cx - S * 1.12, cy); x.lineTo(cx + S * 1.12, cy); x.moveTo(cx, cy - S * 1.12); x.lineTo(cx, cy + S * 1.12); x.stroke();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, L = i % 6 ? 5 : 11;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * S, cy + Math.sin(a) * S); x.lineTo(cx + Math.cos(a) * (S + L), cy + Math.sin(a) * (S + L)); x.stroke();
  }
  // print furniture
  x.fillStyle = 'rgba(11,11,12,0.55)'; x.font = '10px "Space Mono", monospace';
  x.fillText(`FLASH SHEET No. ${sheetNo}`, cx - S, cy + S + 34);
  x.textAlign = 'right'; x.fillText('ANGEL LINE / 天使回線 / N-04', cx + S, cy + S + 34); x.textAlign = 'left';
  [[cx - S - 24, cy - S - 24], [cx + S + 24, cy - S - 24], [cx - S - 24, cy + S + 24], [cx + S + 24, cy + S + 24]].forEach(([a, b]) => {
    x.beginPath(); x.arc(a, b, 6, 0, Math.PI * 2); x.moveTo(a - 10, b); x.lineTo(a + 10, b); x.moveTo(a, b - 10); x.lineTo(a, b + 10); x.stroke();
  });
}

// ---------------------------------------------------------------- symmetry
function transforms(n) {
  const out = [];
  const rots = n === 2 ? 1 : n;
  for (let k = 0; k < rots; k++) {
    const a = (k / rots) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    out.push((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, w: p.w }));
    out.push((p) => ({ x: -p.x * c - p.y * s, y: -p.x * s + p.y * c, w: p.w }));
  }
  return out;
}
const toScreen = (p) => ({ x: cx + p.x * S, y: cy + p.y * S, w: p.w });

// ---------------------------------------------------------------- brushes (draw one copy of a stroke in screen space)
function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }
function walk(pts, step, fn) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const d = Math.hypot(b.x - a.x, b.y - a.y); if (!d) continue;
    while (acc <= d) { const t = acc / d; fn({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, (b.x - a.x) / d, (b.y - a.y) / d); acc += step; }
    acc -= d;
  }
}
function line(x, pts, color, scale) {
  x.strokeStyle = color; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    x.lineWidth = Math.max(0.6, pts[i].w * scale);
    x.beginPath(); x.moveTo(pts[i - 1].x, pts[i - 1].y); x.lineTo(pts[i].x, pts[i].y); x.stroke();
  }
}
const BRUSH = {
  ink(x, pts) { line(x, pts, INK, S / 300); },
  blood(x, pts) {
    line(x, pts, RED, S / 230);
    x.fillStyle = RED; walk(pts, 60 * S / 300, (p) => { if (Math.random() < 0.0) return; x.beginPath(); x.arc(p.x, p.y + 3, 1.6 * S / 300, 0, 7); x.fill(); });
  },
  thorn(x, pts) {
    line(x, pts.map(p => ({ ...p, w: 1.1 })), INK, S / 300);
    let side = 1; const k = S / 300;
    x.fillStyle = INK;
    walk(pts, 16 * k, (p, tx, ty) => {
      const nx = -ty * side, ny = tx * side; side *= -1;
      x.beginPath(); x.moveTo(p.x - tx * 3 * k, p.y - ty * 3 * k); x.lineTo(p.x + tx * 3 * k, p.y + ty * 3 * k);
      x.lineTo(p.x + nx * 11 * k + tx * 5 * k, p.y + ny * 11 * k + ty * 5 * k); x.closePath(); x.fill();
    });
  },
  chain(x, pts) {
    const k = S / 300; x.strokeStyle = INK; x.lineWidth = 1.1 * k;
    line(x, pts.map(p => ({ ...p, w: 0.5 })), INK, k);
    walk(pts, 9 * k, (p) => { x.beginPath(); x.arc(p.x, p.y, 3.2 * k, 0, Math.PI * 2); x.fillStyle = PAPER; x.fill(); x.stroke(); });
  },
};

function drawStroke(x, st, upto = Infinity) {
  const pts = st.pts.slice(0, Math.min(st.pts.length, upto));
  if (pts.length < 2) return;
  transforms(st.sym).forEach((T) => BRUSH[st.brush](x, pts.map(T).map(toScreen)));
}
function redraw() {
  ix.setTransform(dpr, 0, 0, dpr, 0, 0); ix.clearRect(0, 0, W, H);
  ix.shadowColor = 'rgba(11,11,12,0.35)'; ix.shadowBlur = 0.8;
  strokes.forEach(st => drawStroke(ix, st, st.reveal ?? Infinity));
  if (current) drawStroke(ix, current);
  document.getElementById('f-count').textContent = `${strokes.length} stroke${strokes.length === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- drawing input
let last = null;
inkCv.addEventListener('pointerdown', (e) => {
  inkCv.setPointerCapture(e.pointerId);
  const p = { x: (e.clientX - cx) / S, y: (e.clientY - cy) / S, w: 2.4 };
  current = { sym, brush, pts: [p] }; last = { x: e.clientX, y: e.clientY, t: performance.now() };
  audio.tick(0.6);
});
inkCv.addEventListener('pointermove', (e) => {
  if (!current) return;
  const now = performance.now(), d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
  if (d < 2) return;
  const speed = d / Math.max(1, now - last.t);
  const w = clamp(3.4 - speed * 1.6, 0.7, 3.4) * (e.pressure && e.pointerType === 'pen' ? e.pressure * 1.6 : 1);
  const prevW = current.pts[current.pts.length - 1].w;
  current.pts.push({ x: (e.clientX - cx) / S, y: (e.clientY - cy) / S, w: prevW + (w - prevW) * 0.35 });
  last = { x: e.clientX, y: e.clientY, t: now };
  redraw();
});
const end = () => {
  if (!current) return;
  if (current.pts.length > 1) { current.pts[current.pts.length - 1].w *= 0.4; strokes.push(current); audio.tick(0.9); }
  current = null; redraw();
};
inkCv.addEventListener('pointerup', end);
inkCv.addEventListener('pointercancel', end);

// ---------------------------------------------------------------- tools
function radio(sel, attr, set) {
  document.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll(sel).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    set(b.dataset[attr]); audio.tick(1.2);
  }));
}
radio('[data-sym]', 'sym', (v) => { sym = +v; });
radio('[data-brush]', 'brush', (v) => { brush = v; });
const undo = () => { strokes.pop(); redraw(); };
const clear = () => { strokes.length = 0; sheetNo++; drawPaper(); redraw(); audio.glitch(0.12); };
document.getElementById('f-undo').addEventListener('click', undo);
document.getElementById('f-clear').addEventListener('click', clear);
addEventListener('keydown', (e) => { if (e.key === 'z' || e.key === 'Z') undo(); if (e.key === 'c' || e.key === 'C') clear(); });
document.getElementById('f-save').addEventListener('click', () => {
  const out = document.createElement('canvas'); out.width = paper.width; out.height = paper.height;
  const o = out.getContext('2d'); o.drawImage(paper, 0, 0); o.drawImage(inkCv, 0, 0);
  out.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `angel-line-flash-${sheetNo}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
});

// ---------------------------------------------------------------- bless: a procedural gothic ornament, drawn stroke by stroke
function bless() {
  strokes.length = 0; sheetNo++; drawPaper();
  const R = Math.random, n = [4, 6, 6, 8][Math.floor(R() * 4)];
  document.querySelectorAll('[data-sym]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.sym === n)));
  sym = n;
  const half = Math.PI / n; // draw inside one wedge; symmetry does the rest
  const polar = (r, a, w = 1.6) => ({ x: Math.sin(a) * r, y: -Math.cos(a) * r, w });
  const out = [];
  const add = (brushName, pts) => out.push({ sym: n, brush: brushName, pts });
  // spine
  add(R() < 0.5 ? 'thorn' : 'ink', Array.from({ length: 30 }, (_, i) => polar(0.08 + i * 0.03, 0, 2.6 - i * 0.06)));
  // rings
  [0.3 + R() * 0.1, 0.62 + R() * 0.12].forEach((r, i) => add(i ? 'chain' : 'ink', Array.from({ length: 16 }, (_, k) => polar(r, (k / 15) * half, 1.4))));
  // curling branches with thorns
  for (let b = 0; b < 2 + Math.floor(R() * 2); b++) {
    const r0 = 0.2 + R() * 0.55, a0 = 0, curl = 0.6 + R() * 0.9, len = 0.25 + R() * 0.3;
    add(R() < 0.6 ? 'thorn' : 'ink', Array.from({ length: 28 }, (_, k) => {
      const t = k / 27; const r = r0 + Math.sin(t * Math.PI * 0.8) * len * 0.6 + t * len * 0.3;
      return polar(r, a0 + t * half * 0.95 + Math.sin(t * Math.PI * curl) * 0.08, 2 - t * 1.6);
    }));
  }
  // crossbar near the tip, like a gothic cross
  const ct = 0.72 + R() * 0.1; add('ink', [polar(ct, 0, 2.2), polar(ct + 0.02, half * 0.6, 1.6), polar(ct - 0.04, half * 0.85, 0.6)]);
  // a diamond and dots
  const dr = 0.5 + R() * 0.2; add('ink', [polar(dr - 0.05, 0, 1.4), polar(dr, half * 0.3, 1.4), polar(dr + 0.05, 0, 1.4)]);
  // blood at the heart
  add('blood', Array.from({ length: 10 }, (_, k) => polar(0.05 + k * 0.012, (k / 9) * half, 2.8 - k * 0.2)));
  if (reduceMotion) { strokes.push(...out); redraw(); return; }
  let i = 0;
  const step = () => {
    if (i >= out.length) return;
    const st = out[i++]; st.reveal = 1; strokes.push(st);
    const grow = () => { st.reveal += 2; redraw(); if (st.reveal < st.pts.length) requestAnimationFrame(grow); else { delete st.reveal; redraw(); setTimeout(step, 40); } };
    grow(); audio.tick(0.7 + i * 0.05);
  };
  step();
}
document.getElementById('f-bless').addEventListener('click', () => { bless(); audio.chime(523, 0.08); });

addEventListener('resize', layout);
document.fonts.ready.then(() => { layout(); bless(); });
layout();

// Be named: hold to receive a procedurally drawn angel identity card.
import { audio } from './audio.js';

const RANKS = [
  ['Seraph', '熾天使'], ['Cherub', '智天使'], ['Throne', '座天使'], ['Dominion', '主天使'], ['Virtue', '力天使'],
  ['Power', '能天使'], ['Principality', '権天使'], ['Archangel', '大天使'], ['Angel', '天使'],
];
const HALOS = ['Mercury chrome', 'Barbed steel', 'Liquid static', 'Bone and wire', 'Black glass', 'Fiber optic', 'Thorned silver', 'Cracked porcelain'];
const VIRTUES = ['Cannot be lied to', 'Sees in the dark', 'Remembers everything', 'Glows when sad', 'Fixes broken things', 'Speaks in static', 'Always comes back', 'Unbreakable, mostly'];
const VICES = ['Overthinking', 'Awake until 4am', 'Collecting rings', 'Nostalgia for 1999', 'Loving too loudly', 'Ignoring messages', 'Melancholy as a hobby', 'Too many piercings'];
const A = ['Az', 'Sar', 'Vey', 'Lun', 'Kae', 'Ith', 'Mor', 'Sael', 'Eph', 'Nym', 'Ori', 'Thal', 'Zeph', 'Cael', 'Ilu', 'Rem', 'Yse', 'Xan', 'Vol', 'Aur'];
const B = ['a', 'e', 'i', 'o', 'ra', 'ri', 'le', 'va', 'na', '', '', 'th'];
const C = ['iel', 'ael', 'ion', 'ith', 'ys', 'ra', 'el', 'eth', 'iah', 'os', 'iel', 'ael'];
const WINGS = [2, 4, 6, 6, 6, 8, 12];

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function makeAngel(seed) {
  const r = rng(seed);
  const name = pick(r, A) + pick(r, B) + pick(r, C);
  const rank = pick(r, RANKS);
  return {
    seed, r, name: name.charAt(0).toUpperCase() + name.slice(1), rank,
    wings: rank[0] === 'Seraph' ? 6 : pick(r, WINGS),
    halo: pick(r, HALOS), virtue: pick(r, VIRTUES), vice: pick(r, VICES),
    freq: (100 + r() * 800).toFixed(1) + ' MHz',
    serial: 'AL-' + String(Math.floor(r() * 9000) + 1000) + '-' + rank[0].slice(0, 3).toUpperCase(),
  };
}

function drawCard(cv, a) {
  const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const r = rng(a.seed ^ 0x9e3779b9);
  const INK = '#0b0b0c', PAPER = '#ecebe6', RED = '#c3141b';

  // paper
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
  x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(22, 22, W - 44, H - 44);
  x.lineWidth = 1; x.strokeRect(30, 30, W - 60, H - 60);

  // header
  x.fillStyle = INK; x.font = '700 15px "Space Mono", monospace'; x.textBaseline = 'top';
  x.textAlign = 'left'; x.fillText('ANGEL LINE / IDENTITY', 52, 50);
  x.textAlign = 'right'; x.fillText(a.serial, W - 52, 50);

  // portrait panel
  const px = 52, py = 82, pw = W - 104, ph = 520;
  x.fillStyle = INK; x.fillRect(px, py, pw, ph);
  const cx = px + pw / 2, cy = py + ph * 0.55;
  x.save();
  x.beginPath(); x.rect(px, py, pw, ph); x.clip();

  // drafting circles
  x.strokeStyle = 'rgba(236,235,230,0.18)'; x.lineWidth = 1;
  [210, 160, 110].forEach((rad, i) => { x.setLineDash(i === 1 ? [4, 8] : []); x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.stroke(); });
  x.setLineDash([]);
  x.beginPath(); x.moveTo(px, cy); x.lineTo(px + pw, cy); x.moveTo(cx, py); x.lineTo(cx, py + ph); x.stroke();

  // wings: mirrored blade fans
  const pairs = Math.max(1, a.wings / 2);
  for (let p = 0; p < pairs; p++) {
    const base = -0.9 + (p / Math.max(1, pairs - 1 || 1)) * 1.5 + (pairs === 1 ? 0.6 : 0);
    const n = 7 + Math.floor(r() * 5);
    const len = 120 + r() * 70;
    for (let i = 0; i < n; i++) {
      const ang = base + (i / n) * 0.75;
      const L = len * (0.55 + 0.45 * (i / n)) * (0.9 + r() * 0.2);
      const w = 5 + r() * 5;
      const red = r() < 0.08;
      [1, -1].forEach((s) => {
        const a0 = s === 1 ? ang : Math.PI - ang;
        const bx = cx + Math.cos(a0) * 26, by = cy - 30 + Math.sin(a0) * 26;
        const c = Math.cos(a0), sn = Math.sin(a0);
        const P = (u, v) => [bx + c * u - sn * v, by + sn * u + c * v];
        const m1 = P(L * 0.35, -w), tip = P(L, 0), m2 = P(L * 0.62, w * 0.5);
        x.beginPath(); x.moveTo(bx, by);
        x.quadraticCurveTo(m1[0], m1[1], tip[0], tip[1]);
        x.quadraticCurveTo(m2[0], m2[1], bx, by);
        if (red) { x.fillStyle = RED; x.fill(); }
        else if (i % 3 === 0) { x.strokeStyle = PAPER; x.lineWidth = 1.2; x.stroke(); }
        else { x.fillStyle = PAPER; x.fill(); }
      });
    }
  }

  // body: spine + cross
  x.fillStyle = PAPER;
  x.beginPath(); x.moveTo(cx, cy - 120); x.quadraticCurveTo(cx + 18, cy - 40, cx + 10, cy); x.quadraticCurveTo(cx + 4, cy + 90, cx, cy + 170);
  x.quadraticCurveTo(cx - 4, cy + 90, cx - 10, cy); x.quadraticCurveTo(cx - 18, cy - 40, cx, cy - 120); x.fill();
  x.strokeStyle = INK; x.lineWidth = 1;
  for (let i = 0; i < 12; i++) { const yy = cy - 95 + i * 20; x.beginPath(); x.moveTo(cx - 6, yy); x.lineTo(cx + 6, yy); x.stroke(); }

  // halo with thorns
  const hy = cy - 158;
  x.strokeStyle = PAPER; x.lineWidth = 3;
  x.beginPath(); x.ellipse(cx, hy, 62, 15, 0, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.2;
  const thorns = 14 + Math.floor(r() * 12);
  for (let i = 0; i < thorns; i++) {
    const t = (i / thorns) * Math.PI * 2;
    const ex = Math.cos(t) * 62, ey = Math.sin(t) * 15;
    const L = i % 3 ? 9 : 18;
    x.beginPath(); x.moveTo(cx + ex, hy + ey); x.lineTo(cx + ex * (1 + L / 62), hy + ey * (1 + L / 9)); x.stroke();
  }

  // the eye
  x.fillStyle = PAPER; x.beginPath();
  x.moveTo(cx - 22, cy - 60); x.quadraticCurveTo(cx, cy - 80, cx + 22, cy - 60); x.quadraticCurveTo(cx, cy - 40, cx - 22, cy - 60); x.fill();
  x.fillStyle = INK; x.beginPath(); x.arc(cx, cy - 60, 9, 0, Math.PI * 2); x.fill();
  x.fillStyle = RED; x.beginPath(); x.arc(cx, cy - 60, 3.5, 0, Math.PI * 2); x.fill();

  // mirrored marks
  for (let i = 0; i < 10; i++) {
    const mx = 70 + r() * (pw / 2 - 90), my = py + 30 + r() * (ph - 60);
    const kind = Math.floor(r() * 3);
    [cx - mx, cx + mx].forEach((xx) => {
      x.strokeStyle = 'rgba(236,235,230,0.55)'; x.fillStyle = 'rgba(236,235,230,0.55)'; x.lineWidth = 1;
      if (kind === 0) { x.beginPath(); x.arc(xx, my, 3, 0, Math.PI * 2); x.stroke(); }
      else if (kind === 1) { x.beginPath(); x.moveTo(xx - 5, my); x.lineTo(xx + 5, my); x.moveTo(xx, my - 5); x.lineTo(xx, my + 5); x.stroke(); }
      else { x.fillRect(xx - 1.5, my - 1.5, 3, 3); }
    });
  }
  // scanlines
  x.fillStyle = 'rgba(0,0,0,0.22)';
  for (let yy = py; yy < py + ph; yy += 3) x.fillRect(px, yy, pw, 1);
  x.restore();

  x.fillStyle = 'rgba(236,235,230,0.6)'; x.font = '12px "Space Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'top';
  x.fillText('FIG. ' + String(a.seed % 1000).padStart(3, '0') + ' / SIGIL, TRUE FORM', px + 14, py + 14);
  x.textAlign = 'right'; x.fillText(a.wings + ' WINGS', px + pw - 14, py + 14);

  // name
  x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  let fs = 108;
  x.font = `800 ${fs}px "Grenze Gotisch", serif`;
  while (x.measureText(a.name).width > W - 120 && fs > 60) { fs -= 4; x.font = `800 ${fs}px "Grenze Gotisch", serif`; }
  x.fillText(a.name, W / 2, py + ph + 108);
  x.fillStyle = RED; x.font = '22px "DotGothic16", monospace';
  x.fillText(a.rank[1] + '  ·  ' + a.rank[0].toUpperCase(), W / 2, py + ph + 146);

  // fields
  const fields = [['Rank', a.rank[0]], ['Wings', String(a.wings)], ['Halo', a.halo], ['Frequency', a.freq], ['Virtue', a.virtue], ['Vice', a.vice]];
  const fy = py + ph + 186;
  fields.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const fx = 52 + col * ((W - 104) / 2), yy = fy + row * 62;
    x.strokeStyle = 'rgba(11,11,12,0.25)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(fx, yy); x.lineTo(fx + (W - 104) / 2 - 16, yy); x.stroke();
    x.textAlign = 'left'; x.textBaseline = 'top';
    x.fillStyle = '#6b6b70'; x.font = '12px "Space Mono", monospace'; x.fillText(k.toUpperCase(), fx, yy + 8);
    x.fillStyle = INK; x.font = '700 19px "Space Mono", monospace'; x.fillText(v, fx, yy + 26);
  });

  // barcode
  const by = H - 92;
  let bx = 52;
  const br = rng(a.seed ^ 0x1234567);
  x.fillStyle = INK;
  while (bx < 300) { const w = 1 + Math.floor(br() * 4); if (br() > 0.4) x.fillRect(bx, by, w, 40); bx += w + 1; }
  x.font = '11px "Space Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'top';
  x.fillText(a.serial + '  ' + String(a.seed).slice(0, 8), 52, by + 46);
  x.textAlign = 'right'; x.fillStyle = '#6b6b70';
  x.fillText('VALID UNTIL THE END OF THE SIGNAL', W - 52, by + 46);

  // stamp
  x.save(); x.translate(W - 150, H - 90); x.rotate(-0.18);
  x.strokeStyle = 'rgba(195,20,27,0.85)'; x.fillStyle = 'rgba(195,20,27,0.85)'; x.lineWidth = 3;
  x.strokeRect(-92, -28, 184, 50);
  x.font = '700 22px "Syncopate", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('BLESSED', 0, -3);
  x.restore();
}

export function initCard() {
  const section = document.getElementById('named');
  const btn = document.getElementById('hold-btn');
  const txt = btn.querySelector('.hold-txt');
  const cv = document.getElementById('card-canvas');
  const ph = document.getElementById('card-ph');
  const actions = document.getElementById('card-actions');
  const nameIn = document.getElementById('name-in');
  const HOLD = 1600;
  let timer = null, stopSwell = null, current = null;

  const fontsReady = Promise.all([
    '800 40px "Grenze Gotisch"', '700 16px "Space Mono"', '16px "Space Mono"', '20px "DotGothic16"', '700 20px "Syncopate"',
  ].map(f => document.fonts.load(f).catch(() => {})));

  function begin(e) {
    if (timer) return;
    if (e) e.preventDefault();
    btn.classList.add('is-holding'); section.classList.add('is-holding');
    txt.textContent = 'Keep holding';
    stopSwell = audio.swell(HOLD / 1000);
    timer = setTimeout(complete, HOLD);
  }
  function cancel() {
    if (!timer) return;
    clearTimeout(timer); timer = null;
    btn.classList.remove('is-holding'); section.classList.remove('is-holding');
    txt.textContent = 'Hold to be named';
    if (stopSwell) stopSwell();
  }
  async function complete() {
    timer = null;
    if (stopSwell) stopSwell();
    btn.classList.remove('is-holding'); section.classList.remove('is-holding');
    const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
    audio.chime(523, 0.2); setTimeout(() => audio.chime(784, 0.16), 120); setTimeout(() => audio.chime(1046, 0.12), 260);

    await fontsReady;
    const typed = nameIn.value.trim().toLowerCase();
    const seed = typed ? hashStr(typed) : (Math.random() * 4294967295) >>> 0;
    current = makeAngel(seed);
    cv.classList.remove('is-shown');
    void cv.offsetWidth;
    drawCard(cv, current);
    cv.classList.add('is-shown');
    ph.classList.add('is-hidden');
    actions.hidden = false;
    txt.textContent = 'Hold to be renamed';
    cv.setAttribute('aria-label', `Angel identity card: ${current.name}, ${current.rank[0]}, ${current.wings} wings, halo of ${current.halo}.`);
    if (innerWidth < 860) cv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  btn.addEventListener('pointerdown', begin);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, cancel));
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  document.getElementById('card-dl').addEventListener('click', () => {
    if (!current) return;
    cv.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `angel-${current.name.toLowerCase()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  });
  document.getElementById('card-again').addEventListener('click', () => { nameIn.value = ''; btn.focus(); txt.textContent = 'Hold to be renamed'; });
}

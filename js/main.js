// ANGEL LINE — entry point: boot sequence, HUD, cursor, and scene init.
import { audio } from './audio.js';
import { initHalo } from './halo.js';
import { initWings } from './wings.js';
import { initWires } from './wires.js';
import { initOS } from './os.js';
import { initCard } from './card.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

/* ---------------- boot ---------------- */
async function asciiLogo() {
  try { await Promise.race([document.fonts.load('800 80px "Grenze Gotisch"'), sleep(1500)]); } catch (e) { /* ok */ }
  const cols = innerWidth < 600 ? 64 : 92, rows = innerWidth < 600 ? 18 : 24;
  const c = document.createElement('canvas');
  c.width = cols * 4; c.height = rows * 8;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#fff'; x.lineWidth = c.height * 0.035;
  x.beginPath(); x.ellipse(c.width / 2, c.height * 0.2, c.width * 0.2, c.height * 0.07, 0, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${c.height * 0.5}px "Grenze Gotisch", serif`;
  x.fillText('Angel Line', c.width / 2, c.height * 0.64);
  const data = x.getImageData(0, 0, c.width, c.height).data;
  const ramp = ' .:-=+*#%@';
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let s = '';
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) sum += data[((r * 8 + yy) * c.width + col * 4 + xx) * 4];
      s += ramp[Math.min(ramp.length - 1, Math.floor((sum / (32 * 255)) * ramp.length))];
    }
    lines.push(s);
  }
  return lines;
}

async function boot() {
  const bootEl = document.getElementById('boot');
  const art = document.getElementById('boot-ascii');
  const log = document.getElementById('boot-log');
  const bar = document.querySelector('#boot-bar span');
  const actions = document.getElementById('boot-actions');
  let skip = false;
  bootEl.addEventListener('click', () => { skip = true; }, { once: true });

  const lines = await asciiLogo();
  for (let i = 0; i < lines.length; i++) {
    art.textContent = lines.slice(0, i + 1).join('\n');
    if (!skip) await sleep(28);
  }
  const L = [
    ['ANGEL_OS BIOS v2.0.98   (c) 1998 天使回線', ''],
    ['memory test ............ 640K of grace', 'ok'],
    ['detecting halo ......... crown, thorned', 'ok'],
    ['mounting /dev/wings .... 6 found', 'ok'],
    ['calibrating eyes ....... 11 of 11 open', 'ok'],
    ['cardiac link ........... waiting for you', 'bad'],
    ['signal ................. holy', 'ok'],
  ];
  for (let i = 0; i < L.length; i++) {
    const [t, s] = L[i];
    const span = document.createElement('div');
    span.innerHTML = '';
    span.textContent = t + ' ';
    if (s) { const b = document.createElement('span'); b.className = s; b.textContent = s === 'ok' ? '[ OK ]' : '[ -- ]'; span.appendChild(b); }
    log.appendChild(span);
    bar.style.width = ((i + 1) / L.length * 100) + '%';
    if (!skip) await sleep(170 + Math.random() * 120);
  }
  actions.hidden = false;
  actions.querySelector('button').focus({ preventScroll: true });

  await new Promise((res) => {
    actions.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.sound === '1') audio.set(true);
      res();
    });
  });
  bootEl.classList.add('is-gone');
  document.body.classList.remove('is-booting');
  setTimeout(() => bootEl.remove(), 1000);
  if (audio.on) audio.chime(330, 0.15);
}

/* ---------------- cursor ---------------- */
function cursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const el = document.getElementById('cursor');
  const ring = el.querySelector('.ring'), dot = el.querySelector('.dot');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, canvasHover = false;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  addEventListener('cursorhover', (e) => { canvasHover = e.detail; el.classList.toggle('is-hover', canvasHover); });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const hover = !!t.closest('a, button, .win-bar, [role="radio"]');
    el.classList.toggle('is-hover', hover || canvasHover);
    el.classList.toggle('is-text', !!t.closest('input'));
  });
  (function loop() {
    rx += (x - rx) * 0.22; ry += (y - ry) * 0.22;
    dot.style.translate = `${x}px ${y}px`;
    ring.style.translate = `${rx}px ${ry}px`;
    requestAnimationFrame(loop);
  })();
}

/* ---------------- HUD ---------------- */
function hud() {
  const clock = document.getElementById('hud-clock');
  const tick = () => { clock.textContent = new Date().toTimeString().slice(0, 8); };
  tick(); setInterval(tick, 1000);

  const btn = document.getElementById('sound-toggle');
  const lbl = btn.querySelector('.lbl');
  audio.onChange((on) => { btn.setAttribute('aria-pressed', String(on)); lbl.textContent = on ? 'Sound on' : 'Sound off'; });
  btn.addEventListener('click', () => { audio.toggle(); audio.tick(); });

  const links = [...document.querySelectorAll('.hud-nav a')];
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('main > section').forEach(s => io.observe(s));

  document.addEventListener('click', (e) => { if (e.target.closest('button, a')) audio.tick(); });
}

/* ---------------- small things ---------------- */
function barcode() {
  const svg = document.getElementById('hero-barcode');
  let x = 0, s = '', seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (x < 160) { const w = 1 + Math.floor(r() * 4); if (r() > 0.35) s += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w + 1; }
  svg.innerHTML = s;
}

function reveals() {
  const els = document.querySelectorAll('.os-intro, .named-copy, .cardiac-copy .display, .seraph-copy');
  els.forEach(e => e.classList.add('reveal'));
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: 0.2 });
  els.forEach(e => io.observe(e));
}

function visits() {
  let n = 1;
  try { n = (parseInt(localStorage.getItem('angelline.visits') || '0', 10) || 0) + 1; localStorage.setItem('angelline.visits', String(n)); } catch (e) { /* private mode */ }
  document.getElementById('visits').textContent = n;
  document.getElementById('visits-s').textContent = n === 1 ? '' : 's';
}

/* ---------------- go ---------------- */
barcode();
visits();
hud();
cursor();
reveals();
initHalo();
initWings();
initWires();
initOS();
initCard();
boot();

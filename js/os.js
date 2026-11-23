// ANGEL_OS: draggable windows, a working terminal, and a spinning ASCII relic.
import { audio } from './audio.js';
import { halo } from './halo.js';

export function initOS() {
  const desktop = document.getElementById('desktop');
  const wins = [...desktop.querySelectorAll('.win')];
  const mobile = matchMedia('(max-width: 760px)');
  let z = 10;

  function front(w) {
    wins.forEach(x => x.classList.remove('is-front'));
    desktop.querySelectorAll('.win').forEach(x => x.classList.remove('is-front'));
    w.classList.add('is-front');
    w.style.zIndex = ++z;
  }
  function open(id) {
    const w = document.getElementById(id);
    if (!w) return false;
    w.hidden = false; front(w); audio.tick(1.2);
    if (id === 'win-term') setTimeout(() => input.focus({ preventScroll: true }), 50);
    return true;
  }

  function wire(w) {
    const bar = w.querySelector('.win-bar');
    w.addEventListener('pointerdown', () => front(w));
    w.querySelector('.win-x').addEventListener('click', (e) => { e.stopPropagation(); w.hidden = true; audio.tick(0.7); if (w.dataset.clone) w.remove(); });
    bar.addEventListener('pointerdown', (e) => {
      if (mobile.matches || e.target.closest('button')) return;
      const dr = desktop.getBoundingClientRect(), wr = w.getBoundingClientRect();
      const ox = e.clientX - wr.left, oy = e.clientY - wr.top;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.max(-wr.width + 80, Math.min(dr.width - 80, ev.clientX - dr.left - ox));
        const y = Math.max(0, Math.min(dr.height - 40, ev.clientY - dr.top - oy));
        w.style.left = x + 'px'; w.style.top = y + 'px';
      };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });
  }
  wins.forEach(wire);
  front(document.getElementById('win-term'));

  desktop.querySelectorAll('.desk-icon').forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));

  // ---- the warning that multiplies ----
  const warn = document.getElementById('win-warn');
  let clones = 0;
  desktop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-warn]');
    if (!b) return;
    const host = b.closest('.win');
    audio.glitch(0.08);
    if (clones >= 7) {
      desktop.querySelectorAll('.win[data-clone]').forEach(c => c.remove());
      warn.hidden = true; clones = 0;
      print('fine. the halo has been pinned. stop clicking OK.', 't-red');
      return;
    }
    clones++;
    for (let i = 0; i < 2 && clones < 8; i++) {
      const c = warn.cloneNode(true);
      c.removeAttribute('id'); c.dataset.clone = '1'; c.hidden = false;
      const r = host.getBoundingClientRect(), dr = desktop.getBoundingClientRect();
      c.style.left = Math.min(dr.width - 200, Math.max(0, r.left - dr.left + (i ? 40 : -30) + Math.random() * 30)) + 'px';
      c.style.top = Math.min(dr.height - 160, Math.max(0, r.top - dr.top + 30 + Math.random() * 30)) + 'px';
      desktop.appendChild(c); wire(c); front(c);
    }
  });

  // ---- terminal ----
  const out = document.getElementById('term-out');
  const form = document.getElementById('term-form');
  const input = document.getElementById('term-in');
  const term = document.getElementById('term');
  const hist = []; let hi = 0;

  function print(text, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    out.appendChild(d);
    term.scrollTop = term.scrollHeight;
  }

  const PRAYERS = [
    'may your signal never drop below one bar.',
    'may your rings stay cold and your heart stay loud.',
    'may every wire you touch be a live one.',
    'may you be seen from very far away.',
    'may your static be beautiful.',
    'may the thorns only point outward.',
  ];

  function sigil() {
    const w = 15, h = 9, rows = [];
    const ch = ' ·+x×*#‡';
    for (let y = 0; y < h; y++) {
      let half = '';
      for (let x = 0; x < Math.ceil(w / 2); x++) {
        const edge = Math.abs(y - (h - 1) / 2) / ((h - 1) / 2);
        const p = Math.random() * (1.2 - edge * 0.6);
        half += p > 0.62 ? ch[1 + Math.floor(Math.random() * (ch.length - 1))] : ' ';
      }
      const mid = y === Math.floor(h / 2) ? '+' : (y % 2 ? '|' : '‡');
      rows.push(half.split('').reverse().join('') + mid + half);
    }
    return rows.join('\n');
  }

  const files = {
    'manifesto.txt': () => [...document.querySelectorAll('#win-text p')].map(p => p.textContent).join('\n'),
    'halo.cfg': () => 'material   = mercury chrome\nthorns     = 26\nstrands    = 3\nspin_rate  = 0.12 rad/s\nrender     = chrome | ascii | ink',
    'heart.sys': () => `link       = ${document.getElementById('link-count').textContent}/4\nstatus     = ${document.getElementById('cardiac').classList.contains('is-alive') ? 'ALIVE' : 'waiting'}`,
    'relic.exe': () => 'binary file. try: open relic',
    'do_not_open': () => 'you were told.',
  };

  const cmds = {
    help: () => print('commands:\n  help  whoami  ls  cat <file>  open <app>\n  halo <chrome|ascii|ink>  pray  sigil  wings\n  heart  glitch  sound <on|off>  date  echo  clear', 't-dim'),
    whoami: () => print(`a visitor with an unpinned halo. descended ${document.getElementById('visits').textContent} time(s).`),
    ls: () => print(Object.keys(files).join('   ')),
    cat: (a) => { const f = files[a[0]]; f ? print(f()) : print(`cat: ${a[0] || '?'}: no such file`, 't-red'); },
    open: (a) => {
      const map = { terminal: 'win-term', manifesto: 'win-text', 'manifesto.txt': 'win-text', relic: 'win-relic', 'relic.exe': 'win-relic', do_not_open: 'win-warn', warning: 'win-warn' };
      open(map[a[0]]) ? print(`opening ${a[0]}…`, 't-dim') : print(`open: ${a[0] || '?'}: nothing by that name`, 't-red');
    },
    halo: (a) => {
      const m = { chrome: 0, ascii: 1, ink: 2 }[a[0]];
      if (m == null) return print('usage: halo <chrome|ascii|ink>', 't-red');
      halo.setMode(m); print(`halo now rendering as ${a[0]}. scroll up to look.`, 't-ice');
    },
    pray: () => print(PRAYERS[Math.floor(Math.random() * PRAYERS.length)], 't-ice'),
    sigil: () => print(sigil()),
    wings: () => { print('descending to the seraph…', 't-dim'); document.getElementById('seraph').scrollIntoView({ behavior: 'smooth' }); },
    heart: () => { print('routing you to the cardiac link…', 't-dim'); document.getElementById('cardiac').scrollIntoView({ behavior: 'smooth' }); },
    glitch: () => { document.body.classList.add('glitching'); audio.glitch(0.5); setTimeout(() => document.body.classList.remove('glitching'), 600); print('ḡ̷l̴i̵t̶c̷h̸', 't-red'); },
    sound: (a) => { audio.set(a[0] !== 'off'); print(`sound ${audio.on ? 'on' : 'off'}`, 't-dim'); },
    date: () => print(new Date().toString()),
    echo: (a) => print(a.join(' ')),
    clear: () => { out.innerHTML = ''; },
    sudo: (a) => {
      if (a.join(' ') === 'ascend') { print('permission granted. hold still.', 't-red'); setTimeout(() => document.getElementById('named').scrollIntoView({ behavior: 'smooth' }), 700); }
      else print('sudo: you are not light enough.', 't-red');
    },
    ascend: () => print('try: sudo ascend', 't-dim'),
    exit: () => print('there is no exit. there is only the signal.', 't-dim'),
  };

  print('ANGEL_OS 2.0  (c) 1998 天使回線', 't-ice');
  print('type help and press enter.', 't-dim');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    input.value = '';
    print('choir@angelline:~$ ' + raw, 't-cmd');
    if (!raw) return;
    hist.push(raw); hi = hist.length;
    const [c, ...args] = raw.toLowerCase().split(/\s+/);
    audio.tick(1.4);
    (cmds[c] || (() => print(`${c}: command not found. the choir does not know that word.`, 't-red')))(args);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); input.value = hist[hi]; e.preventDefault(); }
    if (e.key === 'ArrowDown' && hist.length) { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
  });
  term.addEventListener('click', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });

  // ---- ASCII relic: a halo over a cross, z-buffered like the old donut ----
  const pre = document.getElementById('relic-pre');
  const COLS = 46, ROWS = 24, LUM = '.,-~:;=!*#$@';
  const model = [];
  for (let th = 0; th < Math.PI * 2; th += 0.12) {
    for (let ph = 0; ph < Math.PI * 2; ph += 0.035) {
      const R2 = 1.15, R1 = 0.16;
      const cx = R2 + R1 * Math.cos(th);
      const x = cx * Math.cos(ph), z = cx * Math.sin(ph), y = R1 * Math.sin(th) + 1.45;
      const nx = Math.cos(th) * Math.cos(ph), nz = Math.cos(th) * Math.sin(ph), ny = Math.sin(th);
      model.push([x, y, z, nx, ny, nz]);
    }
  }
  function box(cx, cy, cz, sx, sy, sz) {
    const st = 0.07;
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    faces.forEach(([nx, ny, nz]) => {
      for (let a = -1; a <= 1; a += st / Math.max(sx, sy, sz)) {
        for (let b = -1; b <= 1; b += st / Math.max(sx, sy, sz)) {
          let x, y, z;
          if (nx) { x = nx * sx; y = a * sy; z = b * sz; }
          else if (ny) { x = a * sx; y = ny * sy; z = b * sz; }
          else { x = a * sx; y = b * sy; z = nz * sz; }
          model.push([cx + x, cy + y, cz + z, nx, ny, nz]);
        }
      }
    });
  }
  box(0, -0.35, 0, 0.16, 1.2, 0.16);
  box(0, 0.35, 0, 0.7, 0.16, 0.16);

  let A = 0, B = 0.35, relicOn = false;
  new IntersectionObserver(([e]) => { relicOn = e.isIntersecting; }).observe(pre);
  const zbuf = new Float32Array(COLS * ROWS);
  const chars = new Array(COLS * ROWS);
  function relic() {
    if (relicOn && !document.getElementById('win-relic').hidden) {
      zbuf.fill(0); chars.fill(' ');
      const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
      for (const [x, y, z, nx, ny, nz] of model) {
        // rotate around y by A, then tilt around x by B
        const x1 = x * cA + z * sA, z1 = -x * sA + z * cA;
        const y2 = y * cB - z1 * sB, z2 = y * sB + z1 * cB;
        const nx1 = nx * cA + nz * sA, nz1 = -nx * sA + nz * cA;
        const ny2 = ny * cB - nz1 * sB, nz2 = ny * sB + nz1 * cB;
        const ooz = 1 / (z2 + 5);
        const px = Math.floor(COLS / 2 + 25 * ooz * x1 * 2.1);
        const py = Math.floor(ROWS / 2 - 25 * ooz * (y2 - 0.08) * 1.05);
        if (px < 0 || px >= COLS || py < 0 || py >= ROWS) continue;
        const L = nx1 * -0.4 + ny2 * 0.7 + nz2 * -0.6;
        const i = px + py * COLS;
        if (ooz > zbuf[i]) { zbuf[i] = ooz; chars[i] = L > 0 ? LUM[Math.min(LUM.length - 1, Math.floor(L * LUM.length))] : '.'; }
      }
      let s = '';
      for (let r = 0; r < ROWS; r++) s += chars.slice(r * COLS, r * COLS + COLS).join('') + '\n';
      pre.textContent = s;
      A += 0.045; B = 0.35 + Math.sin(A * 0.5) * 0.25;
    }
    setTimeout(relic, 50);
  }
  relic();
}

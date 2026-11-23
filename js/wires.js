// Cardiac link: verlet cables you drag into the sockets of a chrome heart.
import { audio } from './audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initWires() {
  const section = document.getElementById('cardiac');
  const canvas = document.getElementById('wires-canvas');
  const ctx = canvas.getContext('2d');
  const countEl = document.getElementById('link-count');
  const msgEl = document.getElementById('link-msg');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, hx = 0, hy = 0, k = 1, narrow = false;
  let ropes = [], sockets = [];
  let drag = null, pointer = { x: 0, y: 0 }, touched = false;
  let visible = false, t = 0, last = 0, phase = 0, beat = 0, alive = false;
  const SEG = 24;

  function heartPt(a) {
    const s = Math.sin(a);
    return [16 * s * s * s * k, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * k];
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.round(r.width * dpr);
    H = canvas.height = Math.round(r.height * dpr);
    narrow = r.width < 760;
    hx = narrow ? W * 0.5 : W * 0.66;
    hy = narrow ? H * 0.4 : H * 0.56;
    k = Math.min(W, H) * (narrow ? 0.0105 : 0.0098);
    const offs = [[-7.5, -7], [7.5, -7], [-4.5, 3], [4.5, 3]];
    const prevLinked = sockets.map(s => s.rope);
    sockets = offs.map((o, i) => ({ x: hx + o[0] * k, y: hy + o[1] * k, rope: prevLinked[i] ?? null }));

    const ax = narrow ? [0.08, 0.24, 0.76, 0.92] : [0.42, 0.51, 0.84, 0.94];
    const old = ropes;
    ropes = ax.map((fx, i) => {
      const anchor = { x: W * fx, y: -6 * dpr };
      const far = Math.max(...sockets.map(s => Math.hypot(s.x - anchor.x, s.y - anchor.y)));
      const L = Math.max(H * 0.5, far * 1.12);
      const seg = L / SEG;
      const pts = [];
      for (let j = 0; j <= SEG; j++) {
        const x = anchor.x + Math.sin(j * 0.3 + i) * 2, y = anchor.y + j * seg * 0.92;
        pts.push({ x, y, px: x, py: y });
      }
      return { anchor, pts, seg, red: i === 2, socket: old[i]?.socket ?? null, idx: i };
    });
    ropes.forEach((r) => { if (r.socket != null) sockets[r.socket].rope = r.idx; });
  }

  function linkedCount() { return ropes.filter(r => r.socket != null).length; }

  function updateStatus() {
    const n = linkedCount();
    countEl.textContent = n;
    const was = alive;
    alive = n === 4;
    section.classList.toggle('is-alive', alive);
    msgEl.textContent = alive ? 'Link established. You are part of the choir now.' : (n ? 'Pulse detected. Keep going.' : '');
    if (alive && !was) { audio.chime(440, 0.2); setTimeout(() => audio.chime(554, 0.16), 140); setTimeout(() => audio.chime(659, 0.14), 280); }
  }

  // ---- physics ----
  function step() {
    const g = 0.42 * dpr;
    ropes.forEach((r) => {
      const pts = r.pts;
      for (let j = 1; j < pts.length; j++) {
        const p = pts[j];
        const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + g * (j === pts.length - 1 ? 1.8 : 1);
        if (!reduce) p.x += Math.sin(t * 0.8 + r.idx * 1.7 + j * 0.2) * 0.02 * dpr;
      }
      const end = pts[pts.length - 1];
      for (let it = 0; it < 22; it++) {
        pts[0].x = r.anchor.x; pts[0].y = r.anchor.y;
        if (drag && drag.rope === r) { end.x = pointer.x; end.y = pointer.y; }
        else if (r.socket != null) { end.x = sockets[r.socket].x; end.y = sockets[r.socket].y - 2 * dpr; }
        for (let j = 0; j < pts.length - 1; j++) {
          const a = pts[j], b = pts[j + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const diff = (d - r.seg) / d;
          const fa = j === 0 ? 0 : 0.5, fb = j === 0 ? 1 : 0.5;
          a.x += dx * diff * fa; a.y += dy * diff * fa;
          b.x -= dx * diff * fb; b.y -= dy * diff * fb;
        }
      }
      // keep the drag point exact even if the cable is taut
      if (drag && drag.rope === r) {
        const pen = pts[pts.length - 2];
        const dx = end.x - pen.x, dy = end.y - pen.y, d = Math.hypot(dx, dy);
        if (d > r.seg * 1.5) { end.x = pen.x + dx / d * r.seg * 1.5; end.y = pen.y + dy / d * r.seg * 1.5; }
      }
    });
  }

  // ---- drawing ----
  function chromeGrad(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#f5f6f8'); g.addColorStop(0.16, '#9aa0a8'); g.addColorStop(0.3, '#1a1b1f');
    g.addColorStop(0.48, '#dfe1e5'); g.addColorStop(0.62, '#5b5f68'); g.addColorStop(0.8, '#0d0e10'); g.addColorStop(1, '#b6bac1');
    return g;
  }

  function drawHeart(s) {
    ctx.save();
    ctx.translate(hx, hy); ctx.scale(s, s); ctx.translate(-hx, -hy);

    // thorn ring
    const ringR = 22 * k;
    ctx.save(); ctx.translate(hx, hy - 2 * k); ctx.rotate(reduce ? 0 : t * 0.08);
    ctx.strokeStyle = alive ? 'rgba(255,60,70,0.55)' : 'rgba(160,165,175,0.35)'; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, L = (i % 4 === 0 ? 3.2 : 1.4) * k;
      const dir = i % 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * ringR, Math.sin(a) * ringR);
      ctx.lineTo(Math.cos(a) * (ringR + L * dir), Math.sin(a) * (ringR + L * dir)); ctx.stroke();
    }
    ctx.restore();

    // body
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = heartPt((i / 120) * Math.PI * 2);
      i ? ctx.lineTo(hx + p[0], hy + p[1]) : ctx.moveTo(hx + p[0], hy + p[1]);
    }
    ctx.closePath();
    if (alive) { ctx.shadowColor = 'rgba(255,30,40,0.8)'; ctx.shadowBlur = (30 + beat * 50) * dpr; }
    ctx.fillStyle = chromeGrad(hx - 16 * k, hy - 14 * k, hx + 12 * k, hy + 18 * k);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#000'; ctx.stroke();

    // specular sweep
    ctx.save(); ctx.clip();
    const sx = hx - 20 * k + ((t * 0.25) % 1.6) * 40 * k;
    const sg = ctx.createLinearGradient(sx - 6 * k, 0, sx + 6 * k, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(hx - 20 * k, hy - 20 * k, 40 * k, 40 * k);
    if (beat > 0.01) { ctx.fillStyle = `rgba(200,10,20,${beat * 0.35 * (linkedCount() / 4)})`; ctx.fillRect(hx - 20 * k, hy - 20 * k, 40 * k, 40 * k); }
    ctx.restore();

    // rivets + seam
    ctx.fillStyle = '#0b0b0c';
    for (let i = 0; i < 28; i++) {
      const p = heartPt((i / 28) * Math.PI * 2);
      ctx.beginPath(); ctx.arc(hx + p[0] * 0.86, hy + p[1] * 0.86 - k * 0.3, 0.32 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(hx, hy - 5 * k); ctx.bezierCurveTo(hx - 2 * k, hy + 2 * k, hx + 2 * k, hy + 6 * k, hx, hy + 13 * k); ctx.stroke();
    ctx.restore();

    // sockets (not scaled, so plugs stay seated)
    sockets.forEach((so, i) => {
      const lit = so.rope != null;
      const near = drag && Math.hypot(pointer.x - so.x, pointer.y - so.y) < snapR() && so.rope == null;
      ctx.beginPath(); ctx.arc(so.x, so.y, 1.5 * k, 0, Math.PI * 2);
      ctx.fillStyle = chromeGrad(so.x - k, so.y - k, so.x + k, so.y + k); ctx.fill();
      ctx.beginPath(); ctx.arc(so.x, so.y, 0.95 * k, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#ff2a33' : '#050506'; ctx.fill();
      if (lit || near) {
        ctx.beginPath(); ctx.arc(so.x, so.y, (2.2 + (near ? Math.sin(t * 10) * 0.3 : beat * 0.8)) * k, 0, Math.PI * 2);
        ctx.strokeStyle = near ? 'rgba(143,230,232,0.9)' : 'rgba(255,42,51,0.7)'; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
      }
      if (!narrow) {
        const left = so.x < hx, lx = hx + (left ? -1 : 1) * 25 * k, ly = so.y + (i < 2 ? -3 : 3) * k;
        ctx.strokeStyle = 'rgba(163,168,176,0.35)'; ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.moveTo(so.x + (left ? -1.6 : 1.6) * k, so.y); ctx.lineTo(lx + (left ? 2 : -2) * k, ly); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = lit ? '#ff2a33' : 'rgba(163,168,176,0.85)';
        ctx.font = `${9 * dpr}px "Space Mono", monospace`;
        ctx.textAlign = left ? 'right' : 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(['ATRIUM L', 'ATRIUM R', 'VENTRICLE L', 'VENTRICLE R'][i], lx + (left ? -0.6 : 0.6) * k, ly);
      }
    });
  }

  function drawRope(r) {
    const pts = r.pts;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length - 1; j++) {
        const mx = (pts[j].x + pts[j + 1].x) / 2, my = (pts[j].y + pts[j + 1].y) / 2;
        ctx.quadraticCurveTo(pts[j].x, pts[j].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = r.red ? '#5e070b' : '#000'; ctx.lineWidth = 7 * dpr; ctx.stroke();
    path(); ctx.strokeStyle = r.red ? '#b3121a' : '#1c1d21'; ctx.lineWidth = 5 * dpr; ctx.stroke();
    ctx.save(); ctx.translate(-1.2 * dpr, -1.2 * dpr);
    path(); ctx.strokeStyle = r.red ? 'rgba(255,120,120,0.5)' : 'rgba(150,155,165,0.35)'; ctx.lineWidth = 1 * dpr; ctx.stroke();
    ctx.restore();

    // signal pulses when linked
    if (r.socket != null) {
      const n = pts.length - 1;
      for (let q = 0; q < 3; q++) {
        const f = ((t * 0.6 + q / 3 + r.idx * 0.13) % 1);
        const j = Math.floor(f * n), fr = f * n - j;
        const a = pts[j], b = pts[Math.min(j + 1, n)];
        const x = a.x + (b.x - a.x) * fr, y = a.y + (b.y - a.y) * fr;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * dpr);
        g.addColorStop(0, 'rgba(255,80,90,0.95)'); g.addColorStop(1, 'rgba(255,0,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    }

    // plug
    const e = pts[pts.length - 1], p = pts[pts.length - 3];
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
    const L = 2.6 * k, w = 1.1 * k;
    ctx.fillStyle = chromeGrad(0, -w, 0, w);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-L, -w, L, w * 2, 2 * dpr) : ctx.rect(-L, -w, L, w * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * dpr; ctx.stroke();
    ctx.fillStyle = '#c9ccd2';
    ctx.fillRect(0, -w * 0.55, 0.9 * k, w * 0.28); ctx.fillRect(0, w * 0.27, 0.9 * k, w * 0.28);
    ctx.fillStyle = r.red ? '#ff2a33' : '#0b0b0c';
    ctx.fillRect(-L * 0.75, -w, L * 0.12, w * 2);
    ctx.restore();

    // hint ring on the first plug until someone drags one
    if (!touched && r.idx === 0 && r.socket == null) {
      const pr = (t * 0.8) % 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, (14 + pr * 26) * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(143,230,232,${0.8 * (1 - pr)})`; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
      ctx.fillStyle = 'rgba(143,230,232,0.9)'; ctx.font = `${10 * dpr}px "Space Mono", monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('DRAG ME', e.x + 24 * dpr, e.y);
    }
  }

  function hud() {
    const n = linkedCount();
    const bpm = n ? Math.round(44 + n * 7 + beat * 4) : 0;
    ctx.fillStyle = 'rgba(163,168,176,0.9)';
    ctx.font = `${10 * dpr}px "Space Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`BPM ${String(bpm).padStart(3, '0')}  //  LINK ${n}/4`, hx, hy + 25 * k);
    // ECG line
    const w0 = 34 * k, y0 = hy + 30 * k;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = hx - w0 / 2 + (i / 120) * w0;
      const ph = (i / 120 * 3 - t * 0.9 * (n ? 1 : 0.2)) % 1;
      const f = ((ph % 1) + 1) % 1;
      let y = 0;
      if (n) {
        if (f > 0.42 && f < 0.46) y = -(f - 0.42) / 0.04 * 3.2 * k * (n / 4 + 0.3);
        else if (f >= 0.46 && f < 0.5) y = (-1 + (f - 0.46) / 0.04 * 1.6) * 3.2 * k * (n / 4 + 0.3);
        else if (f >= 0.5 && f < 0.53) y = (0.6 - (f - 0.5) / 0.03 * 0.6) * 3.2 * k * (n / 4 + 0.3);
      }
      i ? ctx.lineTo(x, y0 + y) : ctx.moveTo(x, y0 + y);
    }
    ctx.strokeStyle = n ? 'rgba(255,42,51,0.85)' : 'rgba(163,168,176,0.4)'; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
  }

  const snapR = () => 4.2 * k;

  // ---- input ----
  function toLocal(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) * dpr, y: (cy - r.top) * dpr }; }
  function pick(p) {
    let best = null, bd = 46 * dpr;
    ropes.forEach((r) => { const e = r.pts[r.pts.length - 1]; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = r; } });
    return best;
  }
  function start(p) {
    const r = pick(p);
    if (!r) return false;
    if (r.socket != null) { sockets[r.socket].rope = null; r.socket = null; updateStatus(); }
    drag = { rope: r }; touched = true; pointer = p;
    audio.tick(0.8);
    return true;
  }
  function end() {
    if (!drag) return;
    const r = drag.rope; drag = null;
    let best = null, bd = snapR();
    sockets.forEach((s, i) => { if (s.rope != null) return; const d = Math.hypot(s.x - pointer.x, s.y - pointer.y); if (d < bd) { bd = d; best = i; } });
    if (best != null) { r.socket = best; sockets[best].rope = r.idx; audio.plug(best); updateStatus(); }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    if (start(toLocal(e.clientX, e.clientY))) { canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const p = toLocal(e.clientX, e.clientY);
    if (drag) pointer = p;
    const hover = !!drag || !!pick(p);
    window.dispatchEvent(new CustomEvent('cursorhover', { detail: hover }));
  });
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(); });
  canvas.addEventListener('pointerleave', () => window.dispatchEvent(new CustomEvent('cursorhover', { detail: false })));
  canvas.addEventListener('touchstart', (e) => {
    const tt = e.touches[0];
    if (start(toLocal(tt.clientX, tt.clientY))) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!drag) return;
    e.preventDefault();
    const tt = e.touches[0]; pointer = toLocal(tt.clientX, tt.clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', end);

  document.getElementById('wires-reset').addEventListener('click', () => {
    ropes.forEach((r) => {
      if (r.socket != null) { sockets[r.socket].rope = null; r.socket = null; }
      const e = r.pts[r.pts.length - 1]; e.px = e.x - (Math.random() - 0.5) * 40 * dpr; e.py = e.y + 20 * dpr;
    });
    audio.glitch(0.2);
    updateStatus();
  });

  layout();
  window.addEventListener('resize', layout);
  // test hook: positions in viewport pixels
  window.__wiresDebug = () => {
    const r = canvas.getBoundingClientRect();
    const v = (x, y) => ({ x: r.left + x / dpr, y: r.top + y / dpr });
    return { plugs: ropes.map(rp => { const e = rp.pts[rp.pts.length - 1]; return v(e.x, e.y); }), sockets: sockets.map(s => v(s.x, s.y)) };
  };
  new IntersectionObserver(([en]) => {
    const was = visible; visible = en.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(section);

  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt;
    step();

    const n = linkedCount();
    if (n) {
      const prev = phase;
      phase += dt * (44 + n * 7) / 60;
      if (Math.floor(phase) !== Math.floor(prev)) audio.thump(0.25 + n * 0.1);
      const f = phase % 1;
      beat = Math.exp(-f * 9) + 0.6 * Math.exp(-Math.abs(f - 0.2) * 22);
      beat *= n / 4;
    } else beat *= 0.9;

    ctx.clearRect(0, 0, W, H);
    // faint grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
    const gs = 48 * dpr;
    ctx.beginPath();
    for (let x = (hx % gs); x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = (hy % gs); y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    drawHeart(1 + beat * 0.05);
    ropes.forEach(drawRope);
    hud();
    requestAnimationFrame(frame);
  }
}

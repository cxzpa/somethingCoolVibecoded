// The seraph: six blade wings drawn in ink on paper. Scroll unfurls, cursor watches, click molts.
import { audio } from './audio.js';

const INK = '#0b0b0c';
const RED = '#c3141b';
const PAPER = '#ecebe6';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

const PAIRS = [
  { root: [8, 45], size: 0.82, fold: [-1.25, 2.6, -2.5], spread: [0.5, 0.28, 0.35], n: 15, delay: 0.16 },
  { root: [10, -28], size: 1.15, fold: [-1.4, 2.8, -2.7], spread: [-0.1, 0.22, 0.3], n: 19, delay: 0.08 },
  { root: [8, -92], size: 1.0, fold: [-1.45, 2.7, -2.6], spread: [-0.66, 0.38, 0.36], n: 17, delay: 0 },
];
const BONES = [108, 118, 96];

export function initWings() {
  const section = document.getElementById('seraph');
  const canvas = document.getElementById('wings-canvas');
  const ctx = canvas.getContext('2d');
  const unfurlEl = document.getElementById('unfurl-val');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, S = 1, cx = 0, cy = 0;
  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, lx: 0, ly: 0, inside: false };
  let lean = 0, visible = false, t = 0, last = performance.now();

  // ---- build blades & eyes (deterministic) ----
  const R = rng(7);
  const blades = [];
  const eyes = [];
  PAIRS.forEach((pair, pi) => {
    [1, -1].forEach((side) => {
      for (let k = 0; k < pair.n; k++) {
        const f = (k + 0.5) / pair.n;
        const style = R() < 0.22 ? 'outline' : 'solid';
        blades.push({
          pi, side, f,
          len: (46 + 150 * Math.pow(f, 1.35)) * pair.size * (0.82 + 0.36 * R()),
          w: (6 + 6 * R()) * pair.size,
          style: (f > 0.7 && R() < 0.3) ? 'red' : style,
          jitter: (R() - 0.5) * 0.22,
          phase: R() * Math.PI * 2,
          off: 0, vel: 0,
          det: false, x: 0, y: 0, a: 0, dx: 0, dy: 0, da: 0, timer: 0,
        });
      }
      eyes.push({ pi, side, at: 1, size: 13 * pair.size, blink: 0, next: 1 + R() * 5 });
    });
  });
  const coreEye = { size: 20, blink: 0, next: 2.5 };

  // ---- geometry ----
  function chain(pair, u) {
    const pts = [[pair.root[0] * S, pair.root[1] * S]];
    const angs = [];
    let a = 0;
    for (let i = 0; i < 3; i++) {
      const rel = lerp(pair.fold[i], pair.spread[i], u);
      a = i === 0 ? rel : a + rel;
      angs.push(a);
      const L = BONES[i] * pair.size * S;
      const p = pts[i];
      pts.push([p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]);
    }
    return { pts, angs };
  }
  function along(ch, pair, f) {
    const lens = BONES.map(b => b * pair.size * S);
    const total = lens[0] + lens[1] + lens[2];
    let d = f * total;
    for (let i = 0; i < 3; i++) {
      if (d <= lens[i] || i === 2) {
        const tt = clamp(d / lens[i], 0, 1);
        const p = ch.pts[i], q = ch.pts[i + 1];
        return { x: lerp(p[0], q[0], tt), y: lerp(p[1], q[1], tt), a: ch.angs[i] };
      }
      d -= lens[i];
    }
  }
  const bob = () => (reduce ? 0 : Math.sin(t * 0.9) * 8 * S);
  function toWorld(x, y, side) {
    const xm = x * side;
    const c = Math.cos(lean), s = Math.sin(lean);
    return [cx + xm * c - y * s, cy + bob() + xm * s + y * c];
  }
  const angWorld = (a, side) => (side === 1 ? a : Math.PI - a) + lean;

  // ---- drawing primitives ----
  function blade(x, y, a, len, w, style, alpha = 1) {
    const c = Math.cos(a), s = Math.sin(a);
    const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    const b1 = P(0, -w * 0.25), b2 = P(0, w * 0.25);
    const m1 = P(len * 0.32, -w), m2 = P(len * 0.62, w * 0.55);
    const tip = P(len, 0);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(b1[0], b1[1]);
    ctx.quadraticCurveTo(m1[0], m1[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(m2[0], m2[1], b2[0], b2[1]);
    ctx.closePath();
    if (style === 'outline') {
      ctx.fillStyle = PAPER; ctx.fill();
      ctx.lineWidth = 1.2 * dpr; ctx.strokeStyle = INK; ctx.stroke();
      const sp = P(len * 0.1, 0), ep = P(len * 0.8, 0);
      ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(ep[0], ep[1]); ctx.lineWidth = 0.7 * dpr; ctx.stroke();
    } else {
      ctx.fillStyle = style === 'red' ? RED : INK; ctx.fill();
    }
    // hairline past the tip, like a pen flick
    const h = P(len * 1.18, 0);
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(h[0], h[1]);
    ctx.lineWidth = 0.8 * dpr; ctx.strokeStyle = INK; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function eye(x, y, size, ang, blink) {
    const sz = size * S;
    const open = 1 - blink;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-sz, 0);
    ctx.quadraticCurveTo(0, -sz * 0.95 * open, sz, 0);
    ctx.quadraticCurveTo(0, sz * 0.95 * open, -sz, 0);
    ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = INK; ctx.stroke();
    if (open > 0.15) {
      ctx.save(); ctx.clip();
      // look toward the cursor (in eye-local space)
      const wx = mouse.inside ? mouse.x - x : 0, wy = mouse.inside ? mouse.y - y : 0;
      const ca = Math.cos(-ang), sa = Math.sin(-ang);
      let lx = wx * ca - wy * sa, ly = wx * sa + wy * ca;
      const d = Math.hypot(lx, ly) || 1;
      const reach = Math.min(1, d / (200 * S));
      lx = (lx / d) * sz * 0.45 * reach; ly = (ly / d) * sz * 0.3 * reach;
      ctx.beginPath(); ctx.arc(lx, ly, sz * 0.46, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, sz * 0.16, 0, Math.PI * 2); ctx.fillStyle = RED; ctx.fill();
      ctx.beginPath(); ctx.arc(lx - sz * 0.14, ly - sz * 0.14, sz * 0.08, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill();
      ctx.restore();
    }
    // lashes
    ctx.lineWidth = 1 * dpr; ctx.strokeStyle = INK;
    for (let i = -2; i <= 2; i++) {
      const px = i * sz * 0.38, py = -sz * 0.62 * open * (1 - Math.abs(i) * 0.15);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px * 1.25, py - sz * 0.35); ctx.stroke();
    }
    ctx.restore();
  }

  function haloRing(x, y) {
    const rx = 74 * S, ry = 19 * S;
    ctx.save(); ctx.translate(x, y);
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.12, ry * 1.25, 0, 0, Math.PI * 2); ctx.stroke();
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.3;
      const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      const nx = Math.cos(a), ny = Math.sin(a) * 2.2;
      const nl = Math.hypot(nx, ny);
      const L = (i % 3 === 0 ? 22 : 11) * S;
      const front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 1 : 0.45;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + nx / nl * L, py + ny / nl * L);
      ctx.lineWidth = (i % 3 === 0 ? 2 : 1.2) * dpr; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function body() {
    const top = toWorld(0, -150 * S, 1), bot = toWorld(0, 170 * S, 1);
    const l = toWorld(-20 * S, -10 * S, 1), r = toWorld(20 * S, -10 * S, 1);
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.quadraticCurveTo(r[0] + 6 * S, r[1] - 60 * S, r[0], r[1]);
    ctx.quadraticCurveTo(r[0] - 4 * S, r[1] + 90 * S, bot[0], bot[1]);
    ctx.quadraticCurveTo(l[0] + 4 * S, l[1] + 90 * S, l[0], l[1]);
    ctx.quadraticCurveTo(l[0] - 6 * S, l[1] - 60 * S, top[0], top[1]);
    ctx.fillStyle = INK; ctx.fill();
    // vertebrae
    ctx.strokeStyle = PAPER; ctx.lineWidth = 1.2 * dpr;
    for (let i = 0; i < 14; i++) {
      const yy = -120 * S + i * 20 * S;
      const wv = (14 - Math.abs(yy / S + 10) * 0.08) * S;
      const a = toWorld(-wv * 0.55, yy, 1), b = toWorld(wv * 0.55, yy, 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // thread down to infinity
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * dpr;
    ctx.beginPath(); ctx.moveTo(bot[0], bot[1]); ctx.lineTo(bot[0] + Math.sin(t * 0.7) * 6 * S, H); ctx.stroke();
  }

  function drafting() {
    const R1 = Math.min(W, H) * 0.42;
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(11,11,12,0.13)'; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.arc(0, 0, R1, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([3 * dpr, 7 * dpr]);
    ctx.beginPath(); ctx.arc(0, 0, R1 * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-R1 * 1.25, 0); ctx.lineTo(R1 * 1.25, 0); ctx.moveTo(0, -R1 * 1.2); ctx.lineTo(0, R1 * 1.2); ctx.stroke();
    ctx.rotate(t * 0.05);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const L = i % 6 === 0 ? 14 * dpr : 6 * dpr;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R1, Math.sin(a) * R1); ctx.lineTo(Math.cos(a) * (R1 + L), Math.sin(a) * (R1 + L)); ctx.stroke();
    }
    ctx.restore();
  }

  function label(px, py, tx, ty, text, alpha) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(11,11,12,0.6)'; ctx.fillStyle = '#4a4a4f'; ctx.lineWidth = 0.8 * dpr;
    ctx.beginPath(); ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.lineTo(tx + (tx > px ? 40 : -40) * dpr, ty); ctx.stroke();
    ctx.font = `${10 * dpr}px "Space Mono", monospace`;
    ctx.textAlign = tx > px ? 'left' : 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(text, tx + (tx > px ? 4 : -4) * dpr, ty - 3 * dpr);
    ctx.globalAlpha = 1;
  }

  // ---- interaction ----
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.round(r.width * dpr);
    H = canvas.height = Math.round(r.height * dpr);
    const narrow = r.width < 760;
    S = Math.min(W, H) / (narrow ? 820 : 900);
    if (narrow) S = Math.min(S, W / 760);
    cx = narrow ? W * 0.5 : W * 0.6;
    cy = narrow ? H * 0.4 : H * 0.48;
  }
  resize();
  window.addEventListener('resize', resize);

  section.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    mouse.vx = x - mouse.x; mouse.vy = y - mouse.y;
    mouse.x = x; mouse.y = y; mouse.inside = true;
  });
  section.addEventListener('pointerleave', () => { mouse.inside = false; });

  const placed = new Map();
  function molt(ox, oy) {
    blades.forEach((b) => {
      const p = placed.get(b);
      if (!p) return;
      b.det = true; b.x = p.x; b.y = p.y; b.a = p.a;
      const dx = p.x - ox, dy = p.y - oy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = (10 + Math.random() * 18) * S * (1 + 200 * S / (d + 60 * S));
      b.dx = (dx / d) * sp + (Math.random() - 0.5) * 6 * S;
      b.dy = (dy / d) * sp + (Math.random() - 0.5) * 6 * S - 4 * S;
      b.da = (Math.random() - 0.5) * 0.5;
      b.timer = 0;
    });
    audio.glitch(0.2); audio.chime(880, 0.08);
  }
  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    molt((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
  });

  new IntersectionObserver(([en]) => {
    const was = visible; visible = en.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(section);

  // ---- loop ----
  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt;

    const rect = section.getBoundingClientRect();
    const prog = clamp(-rect.top / (rect.height - innerHeight), 0, 1);
    const U = reduce ? 1 : ease((prog - 0.02) / 0.55);
    unfurlEl.textContent = 'UNFURL ' + String(Math.round(U * 100)).padStart(3, '0') + '%';

    const targetLean = mouse.inside ? clamp((mouse.x - cx) / W, -0.5, 0.5) * 0.18 : 0;
    lean += (targetLean - lean) * 0.04;
    mouse.vx *= 0.85; mouse.vy *= 0.85;

    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    drafting();

    const chains = PAIRS.map((p) => chain(p, ease(clamp((U - p.delay) / (1 - p.delay), 0, 1))));
    placed.clear();

    // wings, back to front
    PAIRS.forEach((pair, pi) => {
      const u = ease(clamp((U - pair.delay) / (1 - pair.delay), 0, 1));
      const ch = chains[pi];
      [1, -1].forEach((side) => {
        // bones
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2 * dpr * pair.size;
        ctx.beginPath();
        ch.pts.forEach((p, i) => { const w = toWorld(p[0], p[1], side); i ? ctx.lineTo(w[0], w[1]) : ctx.moveTo(w[0], w[1]); });
        ctx.stroke();

        blades.forEach((b) => {
          if (b.pi !== pi || b.side !== side) return;
          const at = along(ch, pair, b.f);
          const rest = lerp(0.12, lerp(1.05, 0.22, b.f), u) + b.jitter * u;
          // wind from cursor + breathing
          const wind = clamp((mouse.vx * side * 0.0005 + mouse.vy * 0.0003) / dpr, -0.03, 0.03);
          b.vel += (-b.off * 0.08) + wind * (0.4 + b.f);
          b.vel *= 0.86;
          b.off = clamp(b.off + b.vel, -0.3, 0.3);
          const breathe = reduce ? 0 : Math.sin(t * 1.4 + b.phase) * 0.035 * u;
          const la = at.a + rest + b.off + breathe;
          const w = toWorld(at.x, at.y, side);
          const wa = angWorld(la, side);
          placed.set(b, { x: w[0], y: w[1], a: wa });
          if (b.det) {
            b.timer += dt;
            if (b.timer < 0.85) {
              b.x += b.dx * dt * 60 * 0.5; b.y += b.dy * dt * 60 * 0.5; b.a += b.da;
              b.dx *= 0.93; b.dy = b.dy * 0.93 + 0.25 * S; b.da *= 0.95;
            } else {
              const k = 1 - Math.pow(0.0006, dt);
              b.x = lerp(b.x, w[0], k); b.y = lerp(b.y, w[1], k);
              let da = wa - b.a; da = Math.atan2(Math.sin(da), Math.cos(da));
              b.a += da * k;
              if (Math.hypot(b.x - w[0], b.y - w[1]) < 1.5 * dpr && Math.abs(da) < 0.02) b.det = false;
            }
            blade(b.x, b.y, b.a, b.len * S, b.w * S, b.style);
          } else {
            blade(w[0], w[1], wa, b.len * S, b.w * S, b.style);
          }
        });
      });
    });

    body();
    const hp = toWorld(0, -205 * S, 1);
    haloRing(hp[0], hp[1] + Math.sin(t * 1.3) * 4 * S);

    // eyes
    const blinkStep = (e) => {
      e.next -= dt;
      if (e.next <= 0) { e.blink = 1; e.next = 2 + Math.random() * 6; }
      e.blink = Math.max(0, e.blink - dt * 7);
    };
    eyes.forEach((e) => {
      blinkStep(e);
      const pair = PAIRS[e.pi];
      const p = chains[e.pi].pts[e.at];
      const w = toWorld(p[0], p[1], e.side);
      eye(w[0], w[1], e.size, lean, Math.sin(e.blink * Math.PI));
    });
    blinkStep(coreEye);
    const ce = toWorld(0, -60 * S, 1);
    eye(ce[0], ce[1], coreEye.size, lean, Math.sin(coreEye.blink * Math.PI));

    // annotations
    const la = clamp((U - 0.6) / 0.3, 0, 1);
    if (W > 900) {
      label(ce[0], ce[1], ce[0] - 230 * S, ce[1] - 40 * S, 'OCULUS 00 / CENTRAL', la);
      const tip = chains[2].pts[3]; const tw = toWorld(tip[0], tip[1], 1);
      label(tw[0], tw[1], tw[0] + 60 * S, tw[1] - 70 * S, 'PRIMARY BLADE 17', la);
      label(hp[0] + 74 * S, hp[1], hp[0] + 160 * S, hp[1] - 50 * S, 'HALO / THORNED', la);
      const mid = chains[0].pts[2]; const mw = toWorld(mid[0], mid[1], -1);
      label(mw[0], mw[1], mw[0] - 90 * S, mw[1] + 90 * S, 'LOWER PAIR, FOLDS LAST', la);
    }

    requestAnimationFrame(frame);
  }
}

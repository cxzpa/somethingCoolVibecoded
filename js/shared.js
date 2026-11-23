// Shared chrome for the structure menu and the rooms: HUD, cursor, sound toggle, glitch page transitions.
import { audio } from './audio.js';

export { audio };
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HUD = (crumb) => `
<header class="hud">
  <a class="hud-logo" href="index.html" aria-label="Angel Line, back to the structure">
    <svg viewBox="0 0 40 24" aria-hidden="true"><ellipse cx="20" cy="8" rx="14" ry="4.5"/><path d="M20 13v10M15 17h10"/></svg>
    <span>Angel&nbsp;Line</span>
  </a>
  <span class="hud-crumb">${crumb}</span>
  <div class="hud-right">
    <span class="hud-clock">00:00:00</span>
    <button class="hud-btn" data-sound aria-pressed="false"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="lbl">Sound off</span></button>
  </div>
</header>
<div id="cursor" aria-hidden="true"><div class="ring"></div><div class="dot"></div></div>
<div class="grain" aria-hidden="true"></div><div class="scan" aria-hidden="true"></div>
<div class="wipe is-in" aria-hidden="true">${'<i></i>'.repeat(12)}</div>`;

export function initShell({ crumb = '' } = {}) {
  document.body.insertAdjacentHTML('afterbegin', HUD(crumb));
  const wipe = document.querySelector('.wipe');
  requestAnimationFrame(() => requestAnimationFrame(() => wipe.classList.add('is-out')));

  // clock
  const clock = document.querySelector('.hud-clock');
  const tick = () => { clock.textContent = new Date().toTimeString().slice(0, 8); };
  tick(); setInterval(tick, 1000);

  // sound — remembered across rooms
  const btn = document.querySelector('[data-sound]');
  const lbl = btn.querySelector('.lbl');
  audio.onChange((on) => {
    btn.setAttribute('aria-pressed', String(on)); lbl.textContent = on ? 'Sound on' : 'Sound off';
    try { sessionStorage.setItem('al.sound', on ? '1' : '0'); } catch (e) { /* ignore */ }
  });
  btn.addEventListener('click', () => { audio.toggle(); audio.tick(); });
  let wantSound = false;
  try { wantSound = sessionStorage.getItem('al.sound') === '1'; } catch (e) { /* ignore */ }
  if (wantSound) {
    // browsers need a gesture before audio can start
    const resume = () => { audio.set(true); removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
    lbl.textContent = 'Sound: tap';
  }

  // page transition on internal links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^https?:/.test(href)) return;
    e.preventDefault();
    navigate(href);
  });

  cursor();
}

export function navigate(href) {
  const wipe = document.querySelector('.wipe');
  audio.glitch(0.25);
  if (reduceMotion || !wipe) { location.href = href; return; }
  wipe.classList.remove('is-in', 'is-out');
  wipe.classList.add('is-on');
  setTimeout(() => { location.href = href; }, 420);
}

function cursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const el = document.getElementById('cursor');
  const ring = el.querySelector('.ring'), dot = el.querySelector('.dot');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, forced = false;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  addEventListener('cursorhover', (e) => { forced = e.detail; el.classList.toggle('is-hover', forced); });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    el.classList.toggle('is-hover', forced || !!t.closest('a, button, [role="button"], [data-hover]'));
    el.classList.toggle('is-text', !!t.closest('input, textarea'));
  });
  (function loop() {
    rx += (x - rx) * 0.22; ry += (y - ry) * 0.22;
    dot.style.translate = `${x}px ${y}px`;
    ring.style.translate = `${rx}px ${ry}px`;
    requestAnimationFrame(loop);
  })();
}

/** WebGL availability check for the 3D rooms. */
export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Synthesized sound — no audio files. Everything is built from oscillators and noise.
let ctx = null, master = null, droneBus = null, enabled = false;
let noiseBuf = null;
const listeners = new Set();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  buildDrone();
  return ctx;
}

function buildDrone() {
  droneBus = ctx.createGain();
  droneBus.gain.value = 0.22;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  // a dark, slightly detuned cluster: A1, E2, A2, C3 (minor colour)
  [55, 82.4, 110.3, 130.8, 164.6].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'sawtooth' : 'triangle';
    o.frequency.value = f; o.detune.value = (i - 2) * 7;
    const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.18;
    o.connect(g).connect(lp); o.start();
  });
  // breath: filtered noise
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
  const ng = ctx.createGain(); ng.gain.value = 0.05;
  n.connect(bp).connect(ng).connect(droneBus); n.start();
  lp.connect(droneBus);
  droneBus.connect(master);
}

export const audio = {
  get on() { return enabled; },
  onChange(fn) { listeners.add(fn); },
  set(on) {
    if (on && !ensure()) return;
    enabled = on;
    if (ctx) {
      if (on && ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(on ? 0.55 : 0, t, on ? 0.6 : 0.15);
    }
    listeners.forEach(fn => fn(on));
  },
  toggle() { this.set(!enabled); },

  /** short UI tick */
  tick(pitch = 1) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1800 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(600 * pitch, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
  },

  /** digital glitch burst */
  glitch(dur = 0.18) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 12;
    f.frequency.setValueAtTime(400, t);
    for (let i = 0; i < 8; i++) f.frequency.setValueAtTime(300 + Math.random() * 5000, t + (i / 8) * dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(master); n.start(t, Math.random()); n.stop(t + dur + 0.02);
  },

  /** metallic bell, FM */
  chime(base = 660, vol = 0.18) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const car = ctx.createOscillator(); car.frequency.value = base;
    const mod = ctx.createOscillator(); mod.frequency.value = base * 3.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(base * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.2);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    car.connect(g).connect(master);
    car.start(t); mod.start(t); car.stop(t + 2.7); mod.stop(t + 2.7);
  },

  /** low heartbeat thump */
  thump(vol = 0.6) {
    if (!enabled) return;
    const t = ctx.currentTime;
    [0, 0.17].forEach((dt, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(90, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(vol * (i ? 0.6 : 1), t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
      o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.25);
    });
  },

  /** plug-in clunk + electric hum */
  plug(i = 0) {
    if (!enabled) return;
    this.thump(0.35);
    this.chime([220, 277, 330, 415][i % 4], 0.12);
  },

  /** rising choir swell while holding; returns a stop fn */
  swell(seconds = 1.6) {
    if (!enabled) return () => {};
    const t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.25, t + seconds);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + seconds);
    const oscs = [220, 277.2, 329.6, 440, 554.4].map((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = (i - 2) * 9;
      o.frequency.exponentialRampToValueAtTime(fr * 1.5, t + seconds);
      o.connect(f); o.start(t); return o;
    });
    f.connect(out).connect(master);
    return () => {
      const n = ctx.currentTime;
      out.gain.cancelScheduledValues(n);
      out.gain.setValueAtTime(out.gain.value, n);
      out.gain.exponentialRampToValueAtTime(0.0001, n + 0.25);
      oscs.forEach(o => o.stop(n + 0.3));
    };
  },
};

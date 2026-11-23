// The hero: a raymarched chrome crown of thorns, post-processed as Chrome / ASCII / Ink.
import { audio } from './audio.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const SCENE = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uRot;
uniform float uScroll;
uniform float uPulse;
varying vec2 vUv;

#define PI 3.14159265
const float R = 1.15;
float gMat;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash(float n){ return fract(sin(n*12.9898)*43758.5453); }

float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q)-t.y; }
float sdOcta(vec3 p, float s){ p = abs(p); return (p.x+p.y+p.z-s)*0.57735027; }

float spike(vec3 lp, vec3 dir, float L, float r){
  float h = clamp(dot(lp,dir), 0.0, L);
  return length(lp - dir*h) - r*(1.0 - h/L);
}

vec3 xform(vec3 p){
  p.y -= uScroll*0.9;
  p.yz = rot(1.12 + uRot.y*0.5)*p.yz;
  p.xy = rot(uRot.x*0.35)*p.xy;
  p.xz = rot(uTime*0.12 + uRot.x*0.6)*p.xz;
  return p;
}

float map(vec3 p0){
  vec3 p = xform(p0);
  gMat = 0.0;
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz)-R, p.y);

  // core band
  float d = length(q) - 0.048;

  // three twisted barbed strands wrapped around the band
  for(int i=0;i<3;i++){
    float ph = a*9.0 + float(i)*2.0944 - uTime*0.35;
    vec2 c = vec2(cos(ph), sin(ph))*0.082;
    d = min(d, (length(q-c) - 0.017)*0.8);
  }

  // thorns: one sector, two spikes each
  const float N = 26.0;
  float stp = 2.0*PI/N;
  float id = floor(a/stp + 0.5);
  float a0 = id*stp;
  vec3 lp = p;
  lp.xz = rot(a0)*lp.xz;
  lp.x -= R;
  float h1 = hash(id+3.1), h2 = hash(id+11.7), h3 = hash(id+23.3);
  float grow = 1.0 + uPulse*0.35;
  float phi1 = (h1-0.5)*2.2;
  vec3 d1 = normalize(vec3(cos(phi1), sin(phi1), (h2-0.5)*0.9));
  float s1 = spike(lp, d1, (0.2 + 0.34*h2)*grow, 0.034);
  float phi2 = (h3 > 0.5 ? 1.0 : -1.0)*(1.25 + h1*0.7);
  vec3 d2 = normalize(vec3(cos(phi2), sin(phi2), (h3-0.5)*1.2));
  float s2 = spike(lp, d2, (0.12 + 0.22*h3)*grow, 0.026);
  float s = min(s1, s2)*0.7;
  if(s < d){ d = s; gMat = (h2 > 0.82) ? 1.0 : 0.0; }

  // two thin orbit rings
  vec3 p2 = p; p2.xy = rot(0.6 + uTime*0.21)*p2.xy;
  float r1 = sdTorus(p2, vec2(1.62, 0.006));
  vec3 p3 = p; p3.yz = rot(-0.5 - uTime*0.17)*p3.yz;
  float r2 = sdTorus(p3, vec2(1.85, 0.004));
  float rr = min(r1, r2);
  if(rr < d){ d = rr; gMat = 0.0; }

  // floating core
  vec3 pc = p0; pc.y -= uScroll*0.9;
  pc.xz = rot(uTime*0.8)*pc.xz; pc.xy = rot(uTime*0.5)*pc.xy;
  float oc = sdOcta(pc, 0.16 + 0.03*sin(uTime*2.0) + uPulse*0.08);
  if(oc < d){ d = oc; gMat = 2.0; }
  return d;
}

vec3 calcNormal(vec3 p){
  const vec2 k = vec2(1.0,-1.0);
  const float e = 0.0012;
  return normalize(k.xyy*map(p+k.xyy*e) + k.yyx*map(p+k.yyx*e) + k.yxy*map(p+k.yxy*e) + k.xxx*map(p+k.xxx*e));
}

vec3 env(vec3 r){
  vec3 col = vec3(0.015, 0.015, 0.018);
  col += vec3(0.95)*smoothstep(0.55, 0.98, r.y);
  col += vec3(1.0)*smoothstep(0.03, 0.0, abs(r.y-0.16)-0.012)*0.95;
  col += vec3(0.8)*smoothstep(0.05, 0.0, abs(r.y+0.32)-0.018)*0.45;
  col += vec3(0.9)*smoothstep(0.04, 0.0, abs(r.x-0.62)-0.025)*step(-0.1, r.y)*0.55;
  col += vec3(1.0, 0.05, 0.07)*pow(max(dot(r, normalize(vec3(-1.0, 0.15, 0.35))), 0.0), 5.0)*1.7;
  col += vec3(0.55, 0.92, 0.95)*pow(max(dot(r, normalize(vec3(0.9, 0.35, -0.6))), 0.0), 9.0)*1.3;
  col += vec3(0.04)*smoothstep(0.0, -0.9, r.y);
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float zoom = uRes.x/uRes.y < 0.8 ? 1.25 : 1.6;
  vec3 ro = vec3(0.0, 0.05, 4.4);
  vec3 rd = normalize(vec3(uv, -zoom));

  float t = 0.0, d = 0.0, glow = 0.0;
  bool hit = false;
  for(int i=0;i<96;i++){
    vec3 p = ro + rd*t;
    d = map(p);
    glow += 0.012/(1.0 + d*d*300.0);
    if(d < 0.0009){ hit = true; break; }
    t += d;
    if(t > 9.0) break;
  }

  float r = length(uv);
  vec3 bg = mix(vec3(0.085, 0.085, 0.105), vec3(0.027, 0.027, 0.031), smoothstep(0.0, 0.85, r));
  vec3 col = bg;
  float alpha = 0.0;

  if(hit){
    vec3 p = ro + rd*t;
    float mat = gMat;
    vec3 n = calcNormal(p);
    vec3 rf = reflect(rd, n);
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    float ao = clamp(map(p + n*0.06)/0.06, 0.0, 1.0);
    ao = 0.45 + 0.55*ao;
    vec3 chrome = env(rf)*mix(0.6, 1.15, fres)*vec3(0.94, 0.96, 1.0);
    if(mat > 1.5){
      col = env(rf)*vec3(1.0, 0.25, 0.28)*0.9 + vec3(0.9, 0.02, 0.05)*0.35*(0.6+0.4*sin(uTime*3.0));
    } else if(mat > 0.5){
      float diff = max(dot(n, normalize(vec3(-0.4, 0.8, 0.5))), 0.0);
      col = vec3(0.45, 0.0, 0.02)*(0.25 + diff) + env(rf)*vec3(1.0, 0.35, 0.35)*0.55;
    } else {
      col = chrome;
    }
    col *= ao;
    alpha = 1.0;
  }
  col += vec3(0.85, 0.9, 1.0)*glow*0.28;
  col += vec3(1.0, 0.1, 0.12)*glow*uPulse*0.5;
  gl_FragColor = vec4(col, alpha);
}`;

const POST = `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform float uMode;
uniform float uGlitch;
uniform float uTime;
uniform float uCell;
uniform float uGlyphs;
uniform vec3 uShock;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(){
  vec2 uv = vUv;
  float age = uTime - uShock.z;
  if(age > 0.0 && age < 1.6){
    vec2 dd = uv - uShock.xy; dd.x *= uRes.x/uRes.y;
    float dist = length(dd);
    float w = smoothstep(0.07, 0.0, abs(dist - age*0.85))*(1.0 - age/1.6);
    vec2 dir = dd/(dist + 1e-4); dir.x *= uRes.y/uRes.x;
    uv -= dir*w*0.035;
  }
  if(uGlitch > 0.001){
    float row = floor(uv.y*36.0);
    float h = hash(vec2(row, floor(uTime*24.0)));
    uv.x += (h - 0.5)*0.18*uGlitch*step(0.55, h);
  }

  vec3 col;
  if(uMode < 0.5){
    float ca = 0.0015 + uGlitch*0.012;
    vec4 s = texture2D(uScene, uv);
    col = vec3(texture2D(uScene, uv + vec2(ca, 0.0)).r, s.g, texture2D(uScene, uv - vec2(ca, 0.0)).b);
    col += (hash(uv*uRes + uTime) - 0.5)*0.035;
  } else if(uMode < 1.5){
    vec2 px = uv*uRes;
    vec2 cs = vec2(uCell*0.6, uCell);
    vec2 cell = floor(px/cs);
    vec2 cuv = fract(px/cs);
    vec4 s = texture2D(uScene, (cell + 0.5)*cs/uRes);
    float l = clamp((luma(s.rgb) - 0.1)*1.7, 0.0, 1.0);
    l = max(l, s.a*0.3);
    float gi = floor(l*(uGlyphs - 1.0) + 0.5);
    float m = texture2D(uAtlas, vec2((gi + cuv.x)/uGlyphs, 1.0 - cuv.y)).r;
    float red = smoothstep(0.06, 0.3, s.r - s.g);
    vec3 tint = mix(vec3(0.78, 0.96, 0.97), vec3(1.0, 0.16, 0.2), red);
    col = tint*m*(0.45 + 0.75*l);
    col += vec3(0.0, 0.012, 0.016);
    col *= 0.9 + 0.1*sin(px.y*1.6);
  } else {
    vec2 tx = 1.2/uRes;
    float tl = luma(texture2D(uScene, uv + tx*vec2(-1.0, 1.0)).rgb);
    float tc = luma(texture2D(uScene, uv + tx*vec2(0.0, 1.0)).rgb);
    float tr = luma(texture2D(uScene, uv + tx*vec2(1.0, 1.0)).rgb);
    float ml = luma(texture2D(uScene, uv + tx*vec2(-1.0, 0.0)).rgb);
    float mr = luma(texture2D(uScene, uv + tx*vec2(1.0, 0.0)).rgb);
    float bl = luma(texture2D(uScene, uv + tx*vec2(-1.0, -1.0)).rgb);
    float bc = luma(texture2D(uScene, uv + tx*vec2(0.0, -1.0)).rgb);
    float br = luma(texture2D(uScene, uv + tx*vec2(1.0, -1.0)).rgb);
    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float e = length(vec2(gx, gy));
    vec4 s = texture2D(uScene, uv);
    float a = s.a;
    float l = luma(s.rgb);
    vec2 px = uv*uRes;
    vec3 paper = vec3(0.925, 0.921, 0.9) - (hash(floor(px*0.5)) - 0.5)*0.03;
    float ink = smoothstep(0.1, 0.32, e);
    float h1 = step(fract((px.x + px.y)/5.0), 0.28)*step(l, 0.42);
    float h2 = step(fract((px.x - px.y)/5.0), 0.28)*step(l, 0.2);
    float hatch = max(h1, h2)*a;
    float solid = step(l, 0.07)*a;
    float red = smoothstep(0.08, 0.3, s.r - s.g)*a;
    col = paper;
    col = mix(col, vec3(0.78, 0.07, 0.1), red*0.9);
    col = mix(col, vec3(0.03), clamp(max(max(ink, hatch*0.85), solid), 0.0, 1.0));
    float halo = smoothstep(0.02, 0.2, l)*(1.0 - a);
    col = mix(col, vec3(0.03), step(fract(px.y/3.0), 0.33)*halo*0.35*step(hash(floor(px/3.0)), 0.5));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const RAMP = " .'`^,:;-~+=*ix%#@";

function makeAtlas() {
  const gw = 30, gh = 50;
  const c = document.createElement('canvas');
  c.width = gw * RAMP.length; c.height = gh;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff';
  x.font = '700 40px "Space Mono", monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < RAMP.length; i++) x.fillText(RAMP[i], i * gw + gw / 2, gh / 2 + 2);
  return c;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

let api = { setMode() {}, pulse() {} };
export const halo = { setMode: (m) => api.setMode(m), pulse: () => api.pulse() };

export async function initHalo() {
  const section = document.getElementById('halo');
  const canvas = document.getElementById('halo-gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { section.classList.add('no-webgl'); return; }

  let scene, post;
  try { scene = program(gl, SCENE); post = program(gl, POST); }
  catch (e) { console.warn('[halo] shader error', e); section.classList.add('no-webgl'); return; }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  try { await document.fonts.load('700 40px "Space Mono"'); } catch (e) { /* fallback font is fine */ }
  const atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
  setTexParams(gl);

  const fbTex = gl.createTexture();
  const fb = gl.createFramebuffer();
  let W = 0, H = 0, FW = 0, FH = 0, dpr = 1;

  function setTexParams(g) {
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width * dpr));
    H = Math.max(2, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    // raymarch at reduced resolution; the post pass upsamples
    const scale = Math.min(0.62, 1100 / Math.max(W, H));
    FW = Math.max(2, Math.round(W * scale)); FH = Math.max(2, Math.round(H * scale));
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    setTexParams(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- state ----
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 0, glitch = 0, glitchT = -10, pulse = 0, pulseT = 0;
  let shock = [0.5, 0.5, -10];
  const rot = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;
  let visible = true;
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  window.addEventListener('pointermove', (e) => {
    rot.tx = (e.clientX / innerWidth - 0.5) * 2;
    rot.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    rot.tx = Math.max(-1, Math.min(1, e.gamma / 35));
    rot.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
  }, { passive: true });

  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    const r = canvas.getBoundingClientRect();
    shock = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, now()];
    api.pulse();
    audio.glitch(0.12);
  });

  const matNames = ['Mercury chrome', 'Phosphor ASCII', 'India ink'];
  const sigNames = ['Holy', 'Textual', 'Drawn'];
  const btns = [...section.querySelectorAll('.mode-switch button')];
  api.setMode = (m) => {
    m = Math.max(0, Math.min(2, m | 0));
    if (m === mode) return;
    mode = m; glitchT = now();
    btns.forEach((b, i) => b.setAttribute('aria-checked', String(i === m)));
    section.classList.toggle('is-ink', m === 2);
    section.classList.toggle('is-ascii', m === 1);
    document.getElementById('mat-val').textContent = matNames[m];
    document.getElementById('sig-val').textContent = sigNames[m];
    audio.glitch(0.25);
  };
  api.pulse = () => { pulse = 1; pulseT = now(); };
  btns.forEach((b, i) => b.addEventListener('click', () => api.setMode(i)));
  section.querySelector('.mode-switch').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (mode + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    api.setMode(next); btns[next].focus();
  });

  new IntersectionObserver(([en]) => {
    const was = visible; visible = en.isIntersecting;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(section);

  const uplink = document.getElementById('uplink');
  let lastUp = 0;

  function frame() {
    if (!visible) return;
    const t = reduce ? 4.0 : now();
    rot.x += (rot.tx - rot.x) * 0.05;
    rot.y += (rot.ty - rot.y) * 0.05;
    scroll = Math.min(1, Math.max(0, window.scrollY / innerHeight));
    glitch = Math.max(0, 1 - (now() - glitchT) / 0.55);
    glitch *= glitch;
    pulse = Math.max(0, 1 - (now() - pulseT) / 0.9);
    const pe = pulse * pulse;

    // pass 1: scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, FW, FH);
    gl.useProgram(scene.p);
    gl.uniform2f(scene.u.uRes, FW, FH);
    gl.uniform1f(scene.u.uTime, t);
    gl.uniform2f(scene.u.uRot, rot.x, rot.y);
    gl.uniform1f(scene.u.uScroll, scroll);
    gl.uniform1f(scene.u.uPulse, pe);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: post
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(post.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.uniform1i(post.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(post.u.uAtlas, 1);
    gl.uniform2f(post.u.uRes, W, H);
    gl.uniform1f(post.u.uMode, mode);
    gl.uniform1f(post.u.uGlitch, glitch);
    gl.uniform1f(post.u.uTime, now());
    gl.uniform1f(post.u.uCell, Math.round(13 * dpr));
    gl.uniform1f(post.u.uGlyphs, RAMP.length);
    gl.uniform3f(post.u.uShock, shock[0], shock[1], shock[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (t - lastUp > 0.4) { lastUp = t; uplink.textContent = (97 + Math.random() * 2.9).toFixed(1); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

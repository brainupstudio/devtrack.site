// DevTrack: the point cloud. Every point stands for a slice of tracked time.
// States (continuous s): 0 scattered on three "sheets", 2 one sphere, 3 sphere plus three orbits
// (one per platform), 4 parked behind the download block.
import * as THREE from '../vendor/three.min.js';

const R = 1.6;                       // sphere radius, world units
const RINGS = [
  { r: 1.95, tilt: [0.34, 0.0, 0.26], speed: 0.21, phase: 0.6 },
  { r: 2.2, tilt: [-0.3, 0.0, -0.4], speed: -0.16, phase: 2.4 },
  { r: 2.45, tilt: [0.62, 0.0, 0.1], speed: 0.12, phase: 4.3 },
];
// Where each sheet sits before gathering, and how it is turned.
const SHEETS = [
  // a triptych: three panes on one floor line, the side ones turned toward the middle
  { c: [-2.95, 0.1, -1.1], rot: [-0.1, 0.78, 0], kind: 'list' },
  { c: [0.0, 0.1, 0.55], rot: [-0.1, -0.1, 0], kind: 'grid' },
  { c: [2.95, 0.1, -1.1], rot: [-0.1, -0.78, 0], kind: 'cells' },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- targets -------------------------------------------------------------------------------

// Sphere, layer 1: parallels (one per day) cut into arcs (one per session).
function sphereArcs(rand, rings, spacing) {
  const out = [];
  for (let i = 0; i < rings; i++) {
    const lat = (-80 + (160 * (i + 0.5)) / rings) * (Math.PI / 180);
    const cr = Math.cos(lat), y = Math.sin(lat);
    const step = spacing / cr;
    let a = rand() * 6.28, end = a + Math.PI * 2;
    while (a < end) {
      const on = 0.12 + rand() * rand() * 1.5;
      const off = 0.05 + rand() * 0.42;
      const bright = 0.55 + rand() * 0.45;
      const stop = Math.min(a + on, end);
      for (let t = a; t < stop; t += step) out.push([cr * Math.cos(t), y, cr * Math.sin(t), bright]);
      a = stop + off;
    }
  }
  return out;
}

// Sphere, layer 2: an even, dim body under the arcs.
function sphereBody(n) {
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), t = g * i;
    out.push([r * Math.cos(t), y, r * Math.sin(t), 0.26]);
  }
  return out;
}

// The three sheets: 2D layouts that read as a work-item list, a week grid and a spreadsheet.
function sheetLayout(kind, rand) {
  const pts = [], P = 0.027;                     // dot pitch
  if (kind === 'list') {                         // work items: rows of different lengths, some indented
    for (let r = 0; r < 70; r++) {
      if (r % 6 === 5) continue;
      const len = 22 + Math.floor(rand() * 68), indent = rand() < 0.3 ? 5 : 0;
      for (let c = 0; c < len; c += 1.5) pts.push([(indent + c) * P - 1.2, 1.15 - r * 0.033, r === 26 ? 1 : 0]);
    }
  } else if (kind === 'grid') {                  // a week: seven day columns of stacked sessions
    for (let d = 0; d < 7; d++) {
      let y = 0;
      while (y < 78) {
        const h = 4 + Math.floor(rand() * 16);
        const mark = d === 3 && y > 24 && y < 44 && !sheetLayout.done ? (sheetLayout.done = 1) : 0;
        if (mark || rand() < 0.72) for (let k = 0; k < h && y + k < 78; k++) for (let w = 0; w < 10; w++) pts.push([d * 0.345 + w * P - 1.2, 1.15 - (y + k) * P, mark]);
        y += h + 2;
      }
    }
  } else {                                       // a spreadsheet: cells, with blocks that never got filled
    for (let r = 0; r < 60; r++) for (let c = 0; c < 84; c++) {
      if (c % 12 > 9 || r % 5 === 4) continue;
      const block = Math.floor(c / 12) * 13 + Math.floor(r / 5) * 7;
      if (((block * 2654435761) >>> 0) % 4 === 0) continue;
      pts.push([c * P - 1.13, 1.15 - r * 0.039, r >= 25 && r <= 28 && c >= 36 && c <= 45 ? 1 : 0]);
    }
  }
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  pts.sort((p, q) => (q[2] || 0) - (p[2] || 0));          // the marked entry is always fully drawn
  return pts;
}

function euler(v, [rx, ry, rz]) {
  let [x, y, z] = v, c, s, t;
  c = Math.cos(rx); s = Math.sin(rx); t = y * c - z * s; z = y * s + z * c; y = t;
  c = Math.cos(ry); s = Math.sin(ry); t = x * c + z * s; z = -x * s + z * c; x = t;
  c = Math.cos(rz); s = Math.sin(rz); t = x * c - y * s; y = x * s + y * c; x = t;
  return [x, y, z];
}

function build(light) {
  const rand = rng(44);
  const arcs = sphereArcs(rand, light ? 54 : 84, light ? 0.03 : 0.0205);
  // The running session: one continuous arc, the only accent on the sphere.
  { const lat = 0.2, cr = Math.cos(lat), y = Math.sin(lat), step = (light ? 0.03 : 0.0205) * 0.55;
    for (let k = 0; k <= 3; k++) for (let a = 0; a < 6.2832; a += step) { const yy = y + k * 0.0125; const c2 = Math.sqrt(1 - yy * yy); arcs.push([c2 * Math.cos(a), yy, c2 * Math.sin(a), 2 + (1 - a / 6.2832) * 0.99]); } }
  const body = sphereBody(light ? 1700 : 4200);
  const ringN = light ? 190 : 420;
  const sphere = arcs.concat(body);
  const n = sphere.length + ringN * RINGS.length;

  const aScatter = new Float32Array(n * 3), aSphere = new Float32Array(n * 3);
  const aMeta = new Float32Array(n * 4), aRing = new Float32Array(n * 2);

  const layouts = SHEETS.map((s) => sheetLayout(s.kind, rand));
  const used = [0, 0, 0];

  for (let i = 0; i < n; i++) {
    const seed = rand();
    let sp, kind = 0, bright, size;
    if (i < sphere.length) {
      sp = sphere[i]; bright = sp[3];
      size = i < arcs.length ? 1.0 + rand() * 0.55 : 0.8;
    } else {
      const k = Math.floor((i - sphere.length) / ringN);
      kind = k + 1;
      sp = body[Math.floor(rand() * body.length)];
      bright = 0.3; size = 0.95;
      // dashed orbit: angle in a few arcs, not uniform
      const j = (i - sphere.length) % ringN;                 // an even dotted orbit with one short gap
      aRing[i * 2] = (j / ringN) * 5.9;
      aRing[i * 2 + 1] = 0;
    }
    aSphere.set([sp[0] * R, sp[1] * R, sp[2] * R], i * 3);

    // scatter target: a cell on one of the sheets, or a stray between them
    let sc, order = seed;
    if (rand() < 0.0) {                                   // a few loose hours between the sheets
      sc = [(rand() - 0.5) * 8.5, (rand() - 0.5) * 2.4 + 0.2, (rand() - 0.5) * 3 - 0.6];
      bright = Math.min(bright, 0.5);
    } else {
      const k = i % 3, L = layouts[k], cell = L[used[k]++ % L.length];
      const lap = Math.floor((used[k] - 1) / L.length);      // more points than cells: the rest are loose hours
      if (lap) {                                             // not on any sheet: appears only while gathering
        sc = [sp[0] * R * 2.6 + (rand() - 0.5), sp[1] * R * 2.2, sp[2] * R * 2.6 - 1];
        aRing[i * 2 + 1] = -1;
      } else {
        const v = euler([cell[0], cell[1], 0], SHEETS[k].rot);
        if (cell[2] && kind === 0) aRing[i * 2] = 1;          // amber while it sits on the sheet
        sc = [v[0] + SHEETS[k].c[0], v[1] + SHEETS[k].c[1], v[2] + SHEETS[k].c[2]];
        order = (k + seed) / 3;
      }
    }
    aScatter.set(sc, i * 3);
    aMeta.set([order, kind, size, bright], i * 4);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(aSphere, 3));
  g.setAttribute('aScatter', new THREE.BufferAttribute(aScatter, 3));
  g.setAttribute('aMeta', new THREE.BufferAttribute(aMeta, 4));
  g.setAttribute('aRing', new THREE.BufferAttribute(aRing, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  return g;
}

// --- shaders -------------------------------------------------------------------------------

const COMMON = /* glsl */ `
uniform float uTime, uGather, uConvert, uScale, uSx, uSpin, uIntro, uPitch, uYaw;
uniform vec2 uOffset, uPointer;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0., -s,c,0., 0.,0.,1.);}
vec3 place(vec3 p){ float loose = 1. - smoothstep(0.1, 0.9, uGather);    // before gathering, a drag turns the whole triptych
  return ry(uPointer.x * .2 + sin(uYaw) * .55 * loose) * rx(uPointer.y * -.12 + uPitch * .5 * loose) * (p * uScale) + vec3(uOffset, 0.); }
vec3 onSphere(vec3 p){ return rz(-0.2) * rx(0.34 + uPitch) * ry(uSpin + uYaw) * p; }
`;

const VERT = /* glsl */ `
attribute vec3 aScatter; attribute vec4 aMeta; attribute vec2 aRing;
uniform float uPx, uRings; uniform vec3 uTilt[3]; uniform vec3 uRing[3];
varying float vAlpha; varying float vHot;
${COMMON}
void main(){
  float seed = aMeta.x, kind = aMeta.y;
  vec3 sc = aScatter; sc.x *= uSx;
  sc += 0.0025 * vec3(sin(uTime*.5+seed*40.), cos(uTime*.4+seed*31.), sin(uTime*.33+seed*17.));
  // on load the sheets drop into place, row by row
  float fall = 1. - smoothstep(0., 1., clamp(uIntro * 1.7 - (0.5 - sc.y * 0.22) * 0.7, 0., 1.));
  sc += fall * vec3(0., 1.4, -2.5);
  vec3 sp = onSphere(position);

  sc.x *= mix(1., 0.62, smoothstep(0.05, 0.6, uGather));     // the sheets close in before they dissolve
  float e = clamp(uGather * 2.7 - seed * 1.7, 0., 1.);
  e = e*e*e*(e*(e*6.-15.)+10.);
  // each point leaves its sheet along a curved lane and winds onto the sphere
  float arc = sin(e * 3.14159);
  vec3 ctrl = ry(1.5) * normalize(sp + vec3(.001)) * 2.7 + vec3(0., sc.y * .35, 0.);
  vec3 p = mix(mix(sc, ctrl, e), mix(ctrl, sp, e), e);
  p += arc * 0.05 * vec3(sin(seed*50. + sc.y*2.), cos(seed*23. + sc.x), sin(seed*71.));

  float c = 0.;
  if (kind > 0.5) {
    int k = int(kind - 0.5);
    vec3 rg = uRing[k];
    c = clamp(uConvert * 1.5 - seed * 0.5, 0., 1.); c = c*c*(3.-2.*c);
    float a = aRing.x + rg.z + uTime * rg.y;
    float rr = rg.x;
    vec3 t = uTilt[k];
    vec3 rp = rz(t.z) * rx(t.x) * vec3(cos(a) * rr, 0., sin(a) * rr);
    p = mix(p, rp, c);
    p += sin(c * 3.14159) * 0.25 * normalize(sp + 0.001);
  }
  vec4 mv = modelViewMatrix * vec4(place(p), 1.);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = mix(1.12, aMeta.z, e) * uPx * mix(1.2 * pow(8.9 / depth, 2.4), 9.0 / depth, e);
  float bright = aMeta.w;
  float hot = step(1.5, bright), tail = bright - 2.;
  vHot = max(hot * e, step(0.5, aRing.x) * step(kind, 0.5) * (1. - smoothstep(0., .1, e)));
  bright = min(bright, 1.);
  float lit = max(dot(normalize(sp), normalize(vec3(-.62, .58, .52))), 0.);
  float fillL = max(dot(normalize(sp), normalize(vec3(.7, -.55, .45))), 0.);
  float form = 0.17 + 2.1 * pow(lit, 1.7) + 0.4 * pow(fillL, 2.4);
  bright = min(bright * form, 1.);
  bright = mix(bright, 0.6 + 0.4 * smoothstep(0., .7, lit + 0.1), vHot);
  gl_PointSize *= mix(1., (0.72 + 1.05 * lit) * (0.6 + 0.4 * smoothstep(0., .35, abs(normalize(sp).z))), e) * mix(1., mix(2.1, 0.55 + 0.55 * smoothstep(0., 1., tail), hot), vHot);
  float far = smoothstep(11.4, 8.0, depth);
  float facing = abs(normalize(sp).z);
  vec3 nNow = normalize(p + vec3(1e-4));
  float litNow = max(dot(nNow, normalize(vec3(-.62, .58, .52))), 0.);
  float shadeNow = mix(1., (0.28 + 0.95 * pow(litNow, 1.2)) * mix(0.4, 1., smoothstep(-.25, .15, nNow.z)), smoothstep(0.12, 0.6, uGather));
  vAlpha = mix(max(0.42 + 0.58 * far, step(0.5, aRing.x) * step(kind, 0.5)) * shadeNow, bright * (0.12 + 0.88 * smoothstep(0.02, .42, facing)), e);
  vAlpha *= mix(1., smoothstep(0.1, 0.42, facing), vHot);
  vAlpha = mix(vAlpha, 0.5 * uRings, c);
  if (aRing.y < -.5) vAlpha *= max(smoothstep(0.02, 0.5, e), c);
  vAlpha *= mix(1. - fall, 1., e);
}`;

const FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor, uAccent; uniform float uDim;
varying float vAlpha; varying float vHot;
void main(){
  vec2 d = gl_PointCoord - .5; float r = length(d);
  float a = smoothstep(.5, .32, r) * vAlpha * uDim;
  if (a < .004) discard;
  gl_FragColor = vec4(mix(uColor, uAccent, vHot), a);
}`;

// The panes behind the three sheets: dark glass with a lit edge.
const PANE_V = /* glsl */ `
attribute vec2 aUv; varying vec2 vUv; varying float vDepth;
${COMMON}
void main(){
  vUv = aUv; vec3 p = position; p.x *= uSx;
  vec4 mv = modelViewMatrix * vec4(place(p), 1.);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PANE_F = /* glsl */ `
precision highp float;
uniform float uGather, uIntro;
varying vec2 vUv; varying float vDepth;
void main(){
  vec2 d2 = min(vUv, 1. - vUv);
  vec2 w = fwidth(vUv) * 1.2;
  float line = max(1. - smoothstep(0., w.x, d2.x), 1. - smoothstep(0., w.y, d2.y));
  float key = smoothstep(1.5, 0., distance(vec2(vUv.x, min(vUv.y, 1.)), vec2(0., 1.)));   // light from the upper left
  float near = smoothstep(11.4, 8.0, vDepth);
  vec2 d3 = abs(d2 - 0.012);
  float bevel = max(1. - smoothstep(0., w.x, d3.x), 1. - smoothstep(0., w.y, d3.y)) * step(0.011, min(d2.x, d2.y));
  float refl = step(vUv.y, -0.001);                                         // quads below the floor line mirror the pane
  float a = (0.03 + 0.2 * key * key) * (0.4 + 0.6 * near) + line * (0.16 + 0.6 * key) * (0.35 + 0.65 * near) + bevel * (0.03 + 0.14 * key) * near;
  float diag = vUv.x * .8 + vUv.y;
  float sheen = exp(-pow((diag - 1.28) / .16, 2.)) * .075 + exp(-pow((diag - .92) / .05, 2.)) * .03;
  float inside = step(0., min(d2.x, d2.y)) * step(vUv.y, 1.) * step(0., vUv.y);
  a += sheen * inside * (0.4 + 0.6 * near);
  a += inside * line * (vUv.y > .5 ? .22 : -.07) * near;
  a = mix(a, 0., refl);
  float top = step(1.5, vUv.y) * step(vUv.y, 2.5), sideF = step(2.5, vUv.y);
  a = mix(a, (0.72 - 0.3 * vUv.x) * (0.35 + 0.65 * near), top);            // the top face catches the key light
  a = mix(a, 0.13 * (0.35 + 0.65 * near), sideF);
  float fade = (1. - smoothstep(0.0, 0.07, uGather)) * smoothstep(0.55, 1., uIntro);
  float solid = 0.9 * step(vUv.y, 3.5) * (1. - refl);                       // faces, top and sides
  float fa = 1. - (1. - a) * (1. - solid);
  vec3 col = (vec3(.86, .89, .96) * a + vec3(.03, .031, .035) * solid * (1. - a)) / max(fa, 1e-4);
  gl_FragColor = vec4(col, fa * fade);
}`;

// The field behind everything: small white points at three depths. They drift, shift with the
// pointer and the scroll (far ones less), and move aside where the pointer is.
const STAR_V = /* glsl */ `
attribute vec3 aStar;                      // seed, size, brightness
uniform float uTime, uPx, uScroll;
uniform vec2 uPointer;
varying float vA;
void main(){
  float seed = aStar.x;
  vec3 p = position;
  float layer = p.z > -3.2 ? 1. : (p.z > -6. ? .45 : .16);     // near, middle, far: each moves by its own amount
  p.y = mod(p.y + uScroll * 2.2 * layer + 7., 14.) - 7.;
  p.x += sin(uTime * .05 + seed * 30.) * .1 - uPointer.x * .95 * layer;
  p.y += cos(uTime * .04 + seed * 17.) * .08 + uPointer.y * .6 * layer;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  gl_PointSize = aStar.y * uPx * (0.75 + 0.75 * layer);
  float tw = 0.8 + 0.2 * sin(uTime * (0.5 + seed) + seed * 50.);
  vA = aStar.z * tw * (0.5 + 0.5 * layer);
}`;
const STAR_F = /* glsl */ `
precision mediump float;
uniform float uStars; varying float vA;
void main(){
  float r = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .25, r) * vA * uStars;
  if (a < .004) discard;
  gl_FragColor = vec4(.945, .945, .93, a);
}`;

// The dark glass body: hides the far side and gives the sphere a lit rim.
const GLASS_V = /* glsl */ `
varying vec3 vN; varying vec3 vV;
${COMMON}
void main(){
  vec4 mv = modelViewMatrix * vec4(place(position), 1.);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const GLASS_F = /* glsl */ `
precision mediump float;
uniform vec3 uBg; uniform float uWhole, uDim;
varying vec3 vN; varying vec3 vV;
void main(){
  float f = 1. - max(dot(normalize(vN), normalize(vV)), 0.);
  float rim = pow(f, 2.6);
  float edge = pow(f, 9.);
  float key = max(dot(normalize(vN), normalize(vec3(-.62, .58, .52))), 0.);
  float side = 0.25 + 0.75 * smoothstep(-.35, .7, dot(normalize(vN), normalize(vec3(-.8, .6, 0.))));
  float fill = smoothstep(.2, 1., dot(normalize(vN), normalize(vec3(.75, -.6, .1))));
  float spec = pow(max(dot(normalize(vN), normalize(vec3(-.62, .58, .52) + normalize(vV))), 0.), 22.);
  vec3 col = uBg * 0.42 + vec3(.80, .84, .92) * (rim * .38 * side + edge * 1.0 * side) * uDim + vec3(.40, .46, .56) * (edge * 1.0 + rim * .22) * fill * uDim
    + vec3(.21, .218, .24) * pow(key, 2.1) * uDim + vec3(.06) * spec * uDim;
  gl_FragColor = vec4(col, uWhole);
}`;

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

export function createScene(canvas, { reduced = false, light = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0, 9);

  const uniforms = {
    uTime: { value: 0 }, uGather: { value: 0 }, uConvert: { value: 0 }, uScale: { value: 1 }, uSx: { value: 1 },
    uSpin: { value: 0 }, uIntro: { value: 1 }, uPointer: { value: new THREE.Vector2() }, uOffset: { value: new THREE.Vector2() }, uPx: { value: 1 }, uDim: { value: 1 },
    // plain vectors, not THREE.Color: these shaders write straight to the screen, and Color would convert the hex to linear (amber came out orange)
    uColor: { value: new THREE.Vector3(0.945, 0.945, 0.933) }, uAccent: { value: new THREE.Vector3(0.961, 0.647, 0.141) }, uRings: { value: 1 }, uScroll: { value: 0 }, uStars: { value: 1 }, uPitch: { value: 0 }, uYaw: { value: 0 },
    uBg: { value: new THREE.Vector3(0.043, 0.043, 0.047) }, uWhole: { value: 0 },
    uRing: { value: RINGS.map((r) => new THREE.Vector3(r.r, r.speed, r.phase)) },
    uTilt: { value: RINGS.map((r) => new THREE.Vector3(...r.tilt)) },
  };
  const points = new THREE.Points(build(light), new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
  }));
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 96, 64), new THREE.ShaderMaterial({
    uniforms, vertexShader: GLASS_V, fragmentShader: GLASS_F, transparent: true, depthWrite: true,
  }));
  glass.renderOrder = 0; points.renderOrder = 1;
  const panes = new THREE.BufferGeometry();
  { const pos = [], uv = [], idx = [];
    SHEETS.forEach((sh, k) => {
      const q = [[-1.33, -1.32], [1.45, -1.32], [1.45, 1.28], [-1.33, 1.28]];
      q.forEach(([x, y], j) => { const v = euler([x, y, -0.02], sh.rot); pos.push(v[0] + sh.c[0], v[1] + sh.c[1], v[2] + sh.c[2]); uv.push(j === 1 || j === 2 ? 1 : 0, j > 1 ? 1 : 0); });
      idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    let o2 = 12;
    SHEETS.forEach((sh) => {                                                 // thickness: top face (v=2) and left face (v=3)
      const T = 0.085, faces = [
        [[-1.33, 1.28, 0], [1.45, 1.28, 0], [1.45, 1.28, -T], [-1.33, 1.28, -T], 2],
        [[-1.33, -1.32, 0], [-1.33, 1.28, 0], [-1.33, 1.28, -T], [-1.33, -1.32, -T], 3],
        [[1.45, -1.32, 0], [1.45, 1.28, 0], [1.45, 1.28, -T], [1.45, -1.32, -T], 3],
      ];
      faces.forEach(([a, b, c, d, v]) => {
        [a, b, c, d].forEach(([x, y, z], j) => { const p3 = euler([x, y, z - 0.02], sh.rot); pos.push(p3[0] + sh.c[0], p3[1] + sh.c[1], p3[2] + sh.c[2]); uv.push(j === 1 || j === 2 ? 1 : 0, v); });
        idx.push(o2, o2 + 1, o2 + 2, o2, o2 + 2, o2 + 3); o2 += 4;
      });
    });
    SHEETS.forEach((sh, k) => {                                              // reflections on the floor
      const q = [[-1.33, -1.34, 0], [1.45, -1.34, 0], [1.45, -2.5, -0.42], [-1.33, -2.5, -0.42]];
      q.forEach(([x, y, v], j) => { const p3 = euler([x, y, -0.02], sh.rot); pos.push(p3[0] + sh.c[0], p3[1] + sh.c[1], p3[2] + sh.c[2]); uv.push(j === 1 || j === 2 ? 1 : 0, v - 0.002); });
      const o = 48 + k * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    panes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    panes.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    panes.setIndex(idx); panes.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30); }
  const pane = new THREE.Mesh(panes, new THREE.ShaderMaterial({ uniforms, vertexShader: PANE_V, fragmentShader: PANE_F, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  pane.renderOrder = 0;
  const starN = light ? 700 : 2000, sg = new THREE.BufferGeometry(), sr = rng(7);
  { const pos = new Float32Array(starN * 3), st = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const tier = sr();                                       // most are fine and far, a few are near
      pos.set([(sr() - 0.5) * 24, (sr() - 0.5) * 14, tier < 0.6 ? -8 : tier < 0.9 ? -5 : -2], i * 3);
      st.set([sr(), 0.95 + Math.pow(sr(), 3) * 0.95, 0.5 + sr() * 0.5], i * 3);
    }
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aStar', new THREE.BufferAttribute(st, 3));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40); }
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms, vertexShader: STAR_V, fragmentShader: STAR_F, transparent: true, depthWrite: false, depthTest: false }));
  stars.renderOrder = -1;
  scene.add(stars, glass, pane, points);

  let w = 1, h = 1, narrow = false, s = 0, time = 0, aside = 0;

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, light ? 1.75 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    narrow = w / h < 1.05;
    uniforms.uPx.value = dpr * Math.max(1.25, Math.min(2.4, h / 520)) * (narrow ? 0.72 : 1);
  }

  // Offsets and scale per state, in world units. Desktop moves the object aside for the copy.
  function layout(st) {
    const halfW = Math.tan((16 * Math.PI) / 180) * 9 * camera.aspect;
    const fit = Math.min(1, halfW / 5.9);
    let x, y, sc;
    if (narrow) {
      const k = Math.min(1, halfW / 1.85);
      x = 0; y = mix(1.0, 1.05, sm(0, 2, st)); sc = mix(k * 0.8, k * 0.9, sm(0.2, 1.8, st));
      sc = mix(sc, k * 0.62, sm(2.2, 3, st)); y = mix(y, 1.2, sm(2.2, 3, st));
      y = mix(y, 3.1, sm(3.2, 4, st));
    } else {
      const side = halfW * 0.33;
      x = mix(0, side, sm(0.1, 1.1, st)); x = mix(x, 0, sm(2.25, 3, st)); x = mix(x, halfW * 0.56, sm(3.2, 4, st));
      y = mix(0.74, -0.2, sm(0.1, 1.1, st)); y = mix(y, 0.5, sm(2.25, 3, st)); y = mix(y, -0.3, sm(3.2, 4, st));
      sc = mix(fit, 1.12, sm(0.3, 1.6, st)); sc = mix(sc, 0.82, sm(2.25, 3, st)); sc = mix(sc, 0.72, sm(3.2, 4, st));
    }
    // while the app window is on screen the sphere waits behind its upper right corner
    if (narrow) { y = mix(y, 3.4, aside); sc = mix(sc, sc * 0.6, aside); }
    else { x = mix(x, halfW * 0.5, aside); y = mix(y, 0.62, aside); sc = mix(sc, 0.86, aside); }
    return { x, y, sc, fit };
  }

  const v = new THREE.Vector3();
  function toScreen(p, L) {
    v.set(p[0] * L.sc + L.x, p[1] * L.sc + L.y, p[2] * L.sc).project(camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, z: p[2] };
  }

  function render() {
    const L = layout(s);
    uniforms.uTime.value = time;
    uniforms.uSpin.value = time * 0.085;
    uniforms.uGather.value = sm(0.1, 1.6, s);
    uniforms.uConvert.value = sm(2.2, 3, s);
    uniforms.uWhole.value = sm(0.95, 1.5, s);
    uniforms.uScale.value = L.sc;
    uniforms.uSx.value = narrow ? 0.4 : 1;
    uniforms.uOffset.value.set(L.x, L.y);
    uniforms.uDim.value = mix(1, narrow ? 0.4 : 1, sm(3.3, 4, s)) * mix(1, 0.6, aside);
    glass.visible = uniforms.uWhole.value > 0.01;
    pane.visible = uniforms.uGather.value < 0.23;
    uniforms.uRings.value = 1 - sm(3.35, 3.9, s);
    renderer.render(scene, camera);

    // anchors for the DOM labels
    const sheets = SHEETS.map((sh, i) => {
      const p = [sh.c[0] * uniforms.uSx.value, sh.c[1] - 1.32, sh.c[2]];
      return toScreen(p, L);
    });
    const rings = RINGS.map((r) => {
      const a = r.phase + time * r.speed, cx = Math.cos(a) * r.r, cz = Math.sin(a) * r.r;
      let p = [cx, 0, cz];
      // same order as the shader: rx then rz
      let c = Math.cos(r.tilt[0]), sn = Math.sin(r.tilt[0]);
      p = [p[0], p[1] * c - p[2] * sn, p[1] * sn + p[2] * c];
      c = Math.cos(r.tilt[2]); sn = Math.sin(r.tilt[2]);
      p = [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
      return toScreen(p, L);
    });
    return { sheets, rings, centre: toScreen([0, 0, 0], L), radius: (toScreen([R, 0, 0], L).x - toScreen([0, 0, 0], L).x) };
  }

  resize();
  return {
    resize,
    frame(state, t, intro = 1, px = 0, py = 0, scroll = 0, yaw = 0, pitch = 0, asideNow = 0) {
      s = state; aside = asideNow; time = reduced ? 20 : t;
      uniforms.uIntro.value = reduced ? 1 : intro;
      uniforms.uPointer.value.set(reduced ? 0 : px, reduced ? 0 : py);
      uniforms.uScroll.value = scroll;
      uniforms.uStars.value = reduced ? 1 : intro;
      uniforms.uYaw.value = yaw; uniforms.uPitch.value = pitch;
      return render();
    },
    dispose() { renderer.dispose(); },
  };
}

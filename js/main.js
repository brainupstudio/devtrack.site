import { STRINGS } from './i18n.js';
import { RELEASE, INSTALL, downloadUrl, notesUrl } from './config.js';
import { createAppDemo } from './appdemo.js';

const qs = new URLSearchParams(location.search);
const still = qs.has('still');                 // deterministic frames for screenshots
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- language ----------
let lang = 'it';
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } }
function pickLang() {
  const q = qs.get('lang'); if (q in STRINGS) return q;
  const s = store('lang'); if (s in STRINGS) return s;
  return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
}
const t = (k, vars = {}) => (STRINGS[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
function applyLang(next) {
  lang = next; root.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.title = t('meta.title');
  $('meta[name="description"]').content = t('meta.desc');
  paintDownload();
  appDemo?.relabel();
}

// ---------- operating system ----------
function detectOS() {
  const q = qs.get('os'); if (q) return q === 'none' ? null : q;
  const p = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(ua) || (p.includes('mac') && navigator.maxTouchPoints > 1)) return null;
  if (p.includes('mac')) return 'mac';
  if (p.includes('win')) return 'win';
  if (p.includes('linux') || ua.includes('x11')) return 'linux';
  return null;
}
const os = detectOS();
function paintDownload() {
  const label = $('#hero-cta-label'), meta = $('#hero-cta-meta'), cta = $('#hero-cta');
  if (os) {
    label.textContent = t('hero.cta', { os: t(`dl.${os}`) });
    meta.textContent = `${RELEASE.version} · ${t(`dl.${os}.file`)}`;
    cta.href = downloadUrl(os);
  } else {
    label.textContent = t('hero.ctaAny'); meta.textContent = RELEASE.version; cta.href = '#download';
  }
  $('.mobile-note').hidden = !!os;
  $('#foot-version').textContent = RELEASE.version;
  $('#dl-version').textContent = t('dl.version', { v: RELEASE.version }) + '.';
}
function setupDownload() {
  $$('[data-dl]').forEach((a) => { a.href = downloadUrl(a.dataset.dl); });
  $('#foot-notes').href = notesUrl();
  $$('[data-file]').forEach((c) => { c.textContent = RELEASE.files[c.dataset.file]; });
  // the terminal install: the command, and a button that copies it
  $$('[data-cmd]').forEach((c) => { c.textContent = INSTALL[c.dataset.cmd]; });
  $$('.cli .copy-btn').forEach((b) => b.addEventListener('click', async () => {
    const cmd = $('[data-cmd]', b.parentNode).textContent;
    try { await navigator.clipboard.writeText(cmd); } catch { return; }
    b.textContent = t('dl.copied');
    b.classList.add('done');
    clearTimeout(b.resetTimer);
    b.resetTimer = setTimeout(() => { b.textContent = t('dl.copy'); b.classList.toggle('done', false); }, 1600);
  }));
  if (!os) return;
  const li = $(`.os-list li[data-os="${os}"]`);
  li.classList.add('me'); $('.yours', li).hidden = false; $('details', li).open = true;
  li.parentNode.prepend(li);
}

// ---------- fixed-position digits ----------
function setDigits(el, str, instant) {
  if (el.dataset.v === str) return;
  el.dataset.v = str; el.setAttribute('role', 'img'); el.setAttribute('aria-label', str);
  const chars = [...str];
  while (el.children.length < chars.length) { const s = document.createElement('span'); s.setAttribute('aria-hidden', 'true'); el.append(s); }
  while (el.children.length > chars.length) el.lastChild.remove();
  chars.forEach((c, i) => {
    const s = el.children[i];
    s.classList.toggle('sep', /[:.]/.test(c));
    if (s.textContent === c) return;
    if (instant || reduced || !s.textContent) { s.textContent = c; return; }
    s.classList.add('out');
    setTimeout(() => { s.textContent = c; s.classList.remove('out'); }, 200 + i * 28);
  });
}
const D = Object.fromEntries($$('[data-digits]').map((el) => { const k = el.dataset.digits; el.textContent = ''; return [k, el]; }));

// The conversion, exactly as the app does it: round to 15 minutes, then format per platform.
const EXAMPLES = [44, 83, 200, 127];
const hm = (m, sep) => `${Math.floor(m / 60)}${sep}${String(m % 60).padStart(2, '0')}`;
function showExample(i, instant) {
  const real = EXAMPLES[i % EXAMPLES.length], r = Math.round(real / 15) * 15;
  setDigits(D.real, hm(real, ':'), instant); setDigits(D.round, hm(r, ':'), instant);
  const dec = (r / 60).toFixed(2), dot = hm(r, '.'), min = String(r);
  ['f0', 'f1', 'f2'].forEach((k) => setDigits(D[k], hm(real, ':'), instant));
  setDigits(D.r0, dec, instant); setDigits(D.m0, dec, instant);
  setDigits(D.r1, dot, instant); setDigits(D.m1, dot, instant);
  setDigits(D.r2, min, instant); setDigits(D.m2, min, instant);
}
function showTimer(sec, instant) {
  const s = Math.floor(sec), p = (n) => String(n).padStart(2, '0');
  setDigits(D.timer, `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`, true);   // a running clock ticks, it does not fade
}

// ---------- scroll state ----------
const panels = $$('.panel');
let centres = [];
function measure() {
  const y0 = scrollY;
  centres = panels.map((p) => { const r = p.getBoundingClientRect(); return r.top + y0 + (r.height - innerHeight) / 2; });
  centres[0] = 0;
  const max = root.scrollHeight - innerHeight;
  centres[centres.length - 1] = Math.min(panels.at(-1).getBoundingClientRect().top + y0, max);
  const r = appPanel.getBoundingClientRect();
  appBox = { top: r.top + y0, span: Math.max(1, r.height - innerHeight) };
  snaps = centres.slice(0, APP).concat(APP_STOPS.map((q) => appBox.top + appBox.span * q), centres.slice(APP + 1));
  window.__snaps = snaps;                          // read by the interaction tests
  // the room the sphere and its three value cards get in the conversion section: under the nav, above the copy
  const conv = panels[4], copy = $('.copy', conv), card = ringTags[0]?.firstElementChild;
  if (sceneApi && copy && card) sceneApi.setRoom({
    top: $('.nav').getBoundingClientRect().bottom + 12,
    bottom: copy.offsetTop - 28,
    card: card.offsetHeight / 2 + 6, cardW: card.offsetWidth + 16, pad: parseFloat(getComputedStyle(conv).paddingLeft) || 24,
  });
}
let sceneApi = null;                             // the 3D scene, once it is built
const APP = 3;                                   // index of the app section among the panels
const APP_STOPS = [0.05, 0.28, 0.51, 0.72, 0.93];   // one stop per step of the app window, inside the step's range in paintApp
const appPanel = panels[APP];
let appBox = { top: 0, span: 1 }, snaps = [], appDemo = null;
// page state -> scene state: the sphere holds its "whole" state while the app section is on
const toScene = (p) => (p <= 2 ? p : p <= 3 ? 2 : p - 1);
function stateAt(y) {
  for (let i = 0; i < centres.length - 1; i++) {
    if (y <= centres[i + 1]) return i + Math.max(0, (y - centres[i]) / Math.max(1, centres[i + 1] - centres[i]));
  }
  return centres.length - 1;
}
let scrollToEased = (y) => scrollTo(0, y);
function goTo(i) { scrollToEased(i === APP ? snaps[APP] : centres[i]); }

const steps = $$('.steps button');
steps.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.panelIndex)));
function paintSteps(p) {
  const cur = p > 4.5 ? -1 : p > 3.5 ? 3 : p > 2.5 ? 2 : p > 0.5 ? 1 : 0;
  steps.forEach((b, i) => (i === cur ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));

}

// ---------- labels that live in the scene ----------
const sheetTags = $$('.tag.sheet'), ringTags = $$('.tag.ring'), leaders = $$('.leader');
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
function paintLabels(a, s) {
  const so = 1 - sm(0.02, 0.13, s);
  const base = Math.max(...a.sheets.map((p) => p.y));     // one baseline for the three totals
  sheetTags.forEach((el, i) => {
    el.style.opacity = so.toFixed(3);
    el.style.transform = `translate(${a.sheets[i].x.toFixed(1)}px, ${base.toFixed(1)}px)`;
  });
  const ro = sm(2.7, 2.98, s) * (1 - sm(3.2, 3.5, s));
  // the three values sit at fixed places around the sphere, each tied to its surface by a hairline
  ringTags.forEach((el, i) => {
    const [ux, uy] = SLOTS[i], r = a.radius;
    const sx = a.centre.x + ux * r * 1.02, sy = a.centre.y + uy * r * 1.02;      // on the surface
    const dy = uy ? Math.sign(uy) * Math.max(Math.abs(uy) * r * 1.5, el.firstElementChild.offsetHeight / 2 + 8) : 0;   // two cards on one side never overlap
    const cx = a.centre.x + ux * r * 1.5, cy = a.centre.y + dy;                  // where the card starts
    el.style.opacity = ro.toFixed(3);
    el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(${ux < 0 ? '-100%' : '0'}, -50%)`;
    const ln = leaders[i];
    ln.style.opacity = ro.toFixed(3);
    ln.style.width = `${(r * 0.48).toFixed(1)}px`;
    ln.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${Math.atan2(uy, ux).toFixed(4)}rad)`;
  });
}
const SLOTS = [[-1, 0], [0.9, -0.436], [0.9, 0.436]];
// in the download state one amber thread runs from the sphere to the card of the visitor's system
const thread = $('.leader.thread');
function paintThread(a, s) {
  const card = $('.os-list li.me .btn'), o = sm(3.75, 4, s);
  if (!card || o < 0.01 || innerWidth < 1100) { thread.style.opacity = 0; return; }
  const r = card.getBoundingClientRect(), tx = r.right + 14, ty = r.top + r.height / 2;
  const dx = tx - a.centre.x, dy = ty - a.centre.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const sx = a.centre.x + ux * a.radius * 1.02, sy = a.centre.y + uy * a.radius * 1.02;
  thread.style.opacity = o.toFixed(3);
  thread.style.width = `${Math.max(0, d - a.radius * 1.02).toFixed(1)}px`;
  thread.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${Math.atan2(uy, ux).toFixed(4)}rad)`;
}

// ---------- boot ----------
async function boot() {
  applyLang(pickLang());
  setupDownload();
  showExample(0, true); showTimer(44 * 60, true);
  $$('.lang button').forEach((b) => b.addEventListener('click', () => { store('lang', b.dataset.lang); applyLang(b.dataset.lang); measure(); }));

  if (still) { root.classList.add('still'); }
  root.style.scrollBehavior = 'auto';            // scrolling is eased in script, below

  let scene = null;
  const canvas = $('#scene');
  const lightScene = innerWidth < 860 || (navigator.hardwareConcurrency || 8) <= 4;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    const { createScene } = await import('./scene.js');
    scene = sceneApi = createScene(canvas, { reduced, light: lightScene });
  } catch (err) {
    root.classList.add('no-webgl');
  }

  measure();
  addEventListener('resize', () => { measure(); scene?.resize(); });
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  if (still) {
    await document.fonts.ready; measure();
    const target = parseFloat(qs.get('s') || '0'), i = Math.floor(target), f = target - i;
    scrollTo(0, qs.has('q') ? appBox.top + appBox.span * parseFloat(qs.get('q')) : centres[i] + ((centres[i + 1] ?? centres[i]) - centres[i]) * f);
  }

  // ---------- scrolling ----------
  // One wheel gesture moves one section and stops there: the tail of a Magic Mouse or trackpad swipe
  // is ignored until a new, deliberate push. Inside the download block the scroll is free (eased).
  // Keys, touch and the scrollbar stay native.
  const ease = !still && !reduced;
  let scTarget = scrollY, scCur = scrollY, scRun = false;
  const tween = { on: false, from: 0, to: 0, t0: 0, dur: 0 };
  let cooling = false, lastAbs = 0, lastWheel = 0, acc = 0;
  const maxScroll = () => root.scrollHeight - innerHeight;
  const clampY = (y) => Math.max(0, Math.min(maxScroll(), y));
  const nearest = () => snaps.reduce((best, c, i) => (Math.abs(c - scrollY) < Math.abs(snaps[best] - scrollY) ? i : best), 0);
  const glide = (y) => {
    tween.on = true; tween.from = scrollY; tween.to = clampY(y); tween.t0 = performance.now(); scRun = false;
    tween.dur = Math.max(750, Math.min(1350, 560 + Math.abs(tween.to - tween.from) * 0.5));
  };
  scrollToEased = (y) => { if (ease) glide(y); else scrollTo(0, y); };
  if (ease) {
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? innerHeight : 1);
      if (!d) return;
      const now = performance.now(), a = Math.abs(d), gap = now - lastWheel, last = snaps.at(-1);
      lastWheel = now;
      if (tween.on) { lastAbs = a; return; }                                     // moving: the gesture is spent
      if (cooling) {                                                             // stopped: wait for a new push
        if (gap > 170 || (a > lastAbs * 1.8 && a > 16)) cooling = false; else { lastAbs = a; return; }
      }
      lastAbs = a;
      if (scrollY > last + 1 || (scrollY >= last - 1 && d > 0)) {                // free inside the download block
        let y = clampY((scRun ? scTarget : scrollY) + d);
        if (y <= last) { y = last; cooling = true; }                             // coming back up, stop at its top
        if (!scRun) scCur = scrollY;
        scTarget = y; scRun = true;
        return;
      }
      if (gap > 220) acc = 0;
      acc += d;
      if (Math.abs(acc) < 36) return;
      const i = nearest(), off = snaps[i] - scrollY, dir = Math.sign(acc);
      acc = 0;
      const j = Math.abs(off) > 4 && Math.sign(off) === dir ? i : Math.max(0, Math.min(snaps.length - 1, i + dir));
      if (Math.abs(snaps[j] - scrollY) > 1) glide(snaps[j]);
      cooling = true;
    }, { passive: false });
    addEventListener('scroll', () => { if (!scRun && !tween.on) scTarget = scCur = scrollY; }, { passive: true });
    addEventListener('keydown', () => { scRun = false; tween.on = false; });
    addEventListener('touchstart', () => { scRun = false; tween.on = false; }, { passive: true });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
    e.preventDefault();
    scrollToEased(el.id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY);
    history.replaceState(null, '', a.getAttribute('href'));
  });

  // ---------- pointer: parallax, and dragging the object ----------
  let pg = stateAt(scrollY), s = toScene(pg), example = 0, lastSwap = 0, px = 0, py = 0, tx = 0, ty = 0;
  const drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0, vy: 0, vp: 0 };
  let anchors = null;
  const interactive = 'a, button, summary, details, input, select, textarea, label';
  const overObject = (e) => {
    if (!anchors || !scene || e.target.closest(interactive) || e.target.closest('.appwin, .os-list, .tag.ring, .example')) return false;
    return s < 3.6;                                    // anywhere on the stage, in every state before the download block
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
    if (drag.on) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      drag.vy = dx * 0.0062; drag.vp = dy * 0.0045;
      drag.yaw += drag.vy; drag.pitch = Math.max(-0.75, Math.min(0.75, drag.pitch + drag.vp));
    } else root.classList.toggle('can-grab', overObject(e));
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' || reduced || !overObject(e)) return;
    e.preventDefault();                                  // no text selection while turning the object
    getSelection()?.removeAllRanges();
    drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.vy = drag.vp = 0;
    root.classList.add('dragging');
  });
  const endDrag = () => { if (drag.on) { drag.on = false; root.classList.remove('dragging'); } };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag); addEventListener('blur', endDrag);
  addEventListener('mousedown', (e) => { if (e.button === 0 && !reduced && overObject(e)) e.preventDefault(); });   // Safari starts a selection on mousedown
  document.addEventListener('selectstart', (e) => { if (drag.on) e.preventDefault(); });
  if (still && qs.has('yaw')) { drag.yaw = parseFloat(qs.get('yaw')); drag.pitch = parseFloat(qs.get('pitch') || '0'); }

  // ---------- copy moves with the scroll: each pinned block drifts and fades around its own state ----------
  const blocks = panels.slice(0, 5).map((p) => $('.copy, .hero-copy', p));
  const appWin = $('.appwin'), phaseItems = $$('.phases li');
  const demo = createAppDemo(appWin, { t, instant: still || reduced });
  appDemo = demo;
  addEventListener('resize', () => demo.fit());
  if (document.fonts?.ready) document.fonts.ready.then(() => demo.fit());
  function paintApp() {
    const q = (scrollY - appBox.top) / appBox.span;                       // below 0 while it arrives, above 1 while it leaves
    const vin = sm(-0.22, -0.02, q) * (1 - sm(1.02, 1.22, q));
    // keep these bounds and APP_STOPS together: every step needs a stop inside its own range
    const stepNow = q < 0.16 ? 1 : q < 0.4 ? 2 : q < 0.62 ? 3 : q < 0.82 ? 4 : 5;
    const active = vin > 0.55 ? stepNow : (q >= 1 ? 5 : 0);                // nothing plays until the window is in
    if (appWin._in !== vin) { appWin._in = vin; appPanel.style.setProperty('--in', vin.toFixed(3)); appPanel.style.visibility = vin < 0.02 ? 'hidden' : 'visible'; }
    if (appWin._ph !== stepNow) { appWin._ph = stepNow; phaseItems.forEach((li, i) => li.classList.toggle('on', i + 1 === stepNow)); }
    if (appWin._act !== active) { appWin._act = active; demo.setStep(active, { mid: still && qs.has('m') }); }
    return still || reduced ? (q > -0.3 && q < 1.3 ? 1 : 0) : sm(-0.36, -0.08, q) * (1 - sm(1.08, 1.36, q));     // how far the sphere steps aside
  }
  function paintCopy(sNow, intro) {
    blocks.forEach((el, i) => {
      if (i === APP) return;
      const local = sNow - i, away = Math.abs(local);
      const from = i === 0 ? 0.03 : 0.1, to = i === 0 ? 0.135 : 0.225;
      let o = 1 - Math.min(1, Math.max(0, (away - from) / (to - from))), y = -local * 150;
      o = o * o * (3 - 2 * o);
      if (i === 0) o *= Math.min(1, intro * 2.2);
      if (reduced || still) { o = 1; y = 0; }
      if (el._o !== o) { el._o = o; el.style.setProperty('--o', o.toFixed(3)); el.style.visibility = o < 0.01 ? 'hidden' : 'visible'; }
      if (el._y !== y) { el._y = y; el.style.setProperty('--y', y.toFixed(1) + 'px'); }
    });
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 });
  if (still) panels.at(-1).classList.add('in'); else io.observe(panels.at(-1));

  // the timer can be paused and resumed, as in the app
  const timerBtn = $('.timer'), timer = { run: true, acc: 44 * 60, last: performance.now() };
  timerBtn.addEventListener('click', () => {
    timer.run = !timer.run; timer.last = performance.now();
    timerBtn.classList.toggle('paused', !timer.run); timerBtn.setAttribute('aria-pressed', String(!timer.run));
    const lab = $('.live > span', timerBtn); lab.dataset.i18n = timer.run ? 's2.task' : 's2.paused'; lab.textContent = t(lab.dataset.i18n);
  });
  // a click on a value card, or on the example, moves to the next example
  const nextExample = () => { lastSwap = performance.now(); showExample(++example); };
  $$('.tag.ring, .example').forEach((el) => el.addEventListener('click', nextExample));
  let lastY = scrollY;

  const t0 = performance.now(), fixedT = still ? parseFloat(qs.get('t') || '12') : null;
  function tick(now) {
    const time = fixedT ?? (now - t0) / 1000 + 8;
    if (tween.on) {                                   // leave gently, arrive firmly
      const k = Math.min(1, (performance.now() - tween.t0) / tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, tween.from + (tween.to - tween.from) * e);
      if (k >= 1) { tween.on = false; cooling = true; lastWheel = performance.now(); }
    } else if (scRun) {
      scCur += (scTarget - scCur) * 0.12;
      if (Math.abs(scTarget - scCur) < 0.4) { scCur = scTarget; scRun = false; }
      scrollTo(0, scCur);
    }
    const target = stateAt(scrollY);
    pg = still || reduced ? target : pg + (target - pg) * 0.075;
    if (Math.abs(target - pg) < 0.0004) pg = target;
    s = toScene(pg);
    paintSteps(target);
    // the wordmark is large at the top and settles into the nav as the page scrolls
    const big = 1 - sm(0, innerHeight * 0.32, scrollY);
    if (big !== tick.big) { tick.big = big; root.style.setProperty('--big', big.toFixed(3)); }
    px += (tx - px) * 0.045; py += (ty - py) * 0.045;
    const intro = still ? 1 : Math.min(1, (now - t0) / 2200);
    if (!still && !reduced) { drag.yaw += (scrollY - lastY) * 0.0011; } lastY = scrollY;      // scrolling gives the sphere a push
    if (!drag.on) {                                      // let go: keep turning, slow down, level out
      drag.yaw += drag.vy; drag.vy *= 0.95;
      drag.pitch += drag.vp; drag.vp *= 0.9; drag.pitch *= 0.985;
      drag.pitch = Math.max(-0.75, Math.min(0.75, drag.pitch));
    }
    paintCopy(pg, intro);
    const aside = paintApp();
    if (scene) {
      anchors = scene.frame(s, time, intro, still ? 0 : px, still ? 0 : py, scrollY / innerHeight, drag.yaw, drag.pitch, aside);
      paintLabels(anchors, s); paintThread(anchors, s);
    }
    if (!still && !reduced) {
      if (timer.run) { timer.acc += (now - timer.last) / 1000; } timer.last = now; showTimer(timer.acc);
      if (s > 2.6 && s < 3.5 && now - lastSwap > 3400) { lastSwap = now; showExample(++example); }
    }
    root.classList.add('ready');
    requestAnimationFrame(tick);
    if (still) { tick.n = (tick.n || 0) + 1; if (tick.n > 6) root.dataset.shot = '1'; }
  }
  requestAnimationFrame(tick);
}
boot();

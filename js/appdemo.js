// The "In azione" window: four steps, each one a real gesture in the app.
// A step plays once when it becomes active and ends in its final state; going back restores the
// final state of the earlier step. With reduced motion every step shows its final state at once.

const TYPED = 'log';
const SESSION = 44 * 60 + 11;                 // 0:44:11
const BEFORE = 327, AFTER = 371;              // day total in minutes: 5 h 27 min -> 6 h 11 min
const DESIGN = { wide: [1120, 800], narrow: [440, 600] };

const hms = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
const hmin = (m) => `${Math.floor(m / 60)} h ${String(Math.round(m) % 60).padStart(2, '0')} min`;

export function createAppDemo(win, { t, instant = false }) {
  const stage = win.parentElement;
  const q = (s) => win.querySelector(s);
  const el = {
    typed: q('.aw-typed'), clock: q('.aw-clock'), total: q('.aw-total'), count: q('.aw-count'),
    open: q('.aw-opencount'), plan: q('.aw-plan'), sel: q('.aw-selcount'), imp: q('.aw-import'), cursor: q('.aw-cursor'),
    checks: [...win.querySelectorAll('.aw-chk[data-chk]')],
  };
  let token = 0, step = 0, narrow = false, k = 1, tickFrom = 0, ticking = false, clockSecs = 0, raf = 0;

  // ---------- one function paints any state ----------
  const state = {};
  function paint(s) {
    Object.assign(state, s);
    win.dataset.page = state.page;
    win.classList.toggle('is-focus', !!state.focus);
    win.classList.toggle('has-text', !!state.text);
    win.classList.toggle('is-suggest', !!state.suggest);
    win.classList.toggle('is-hl', !!state.hl);
    win.classList.toggle('has-proj', !!state.proj);
    win.classList.toggle('is-run', !!state.run);
    win.classList.toggle('has-row', !!state.row);
    win.classList.toggle('is-dialog', !!state.dialog);
    win.classList.toggle('show-cursor', !!state.cursor);
    win.dataset.checks = state.checks;
    win.dataset.imp = state.imp;
    el.typed.textContent = state.text === 'full' ? t('aw.a0') : state.text || '';
    el.total.textContent = hmin(state.total);
    el.count.textContent = state.row ? 5 : 4;
    el.open.textContent = 2 + state.imp;
    el.plan.textContent = hmin((8 + [0, 6, 22, 26][state.imp]) * 60);
    el.checks.forEach((c, i) => c.classList.toggle('on', i < state.checks));
    el.sel.textContent = state.checks ? t(state.checks === 1 ? 'aw.sel1' : 'aw.seln', { n: state.checks }) : '';
    el.imp.textContent = state.checks ? t('aw.importn', { n: state.checks }) : t('aw.import0');
    if (!ticking) setClock(state.clock);
  }
  function setClock(s) { clockSecs = s; el.clock.textContent = hms(s); }

  // final state of every step (0 = before the first one)
  const BASE = { page: 'today', focus: false, text: '', suggest: false, hl: false, proj: false, run: false, row: false, dialog: false, cursor: false, checks: 0, imp: 0, total: BEFORE, clock: 0 };
  const END = [
    BASE,
    { ...BASE, text: 'full', proj: true },
    { ...BASE, text: 'full', proj: true, run: true },
    { ...BASE, row: true, total: AFTER },
    { ...BASE, row: true, total: AFTER, page: 'work', imp: 3 },
  ];
  // a state in the middle of a step, for stills and for people who do not get the motion
  const MID = { 1: { ...BASE, focus: true, text: TYPED, suggest: true, hl: true, cursor: true }, 4: { ...END[3], page: 'work', dialog: true, checks: 3, cursor: true } };

  // ---------- small animation helpers ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function stopClock() { ticking = false; cancelAnimationFrame(raf); }
  function runClock(from) {
    stopClock(); ticking = true; tickFrom = performance.now() - from * 1000;
    const loop = () => { if (!ticking) return; setClock((performance.now() - tickFrom) / 1000); raf = requestAnimationFrame(loop); };
    loop();
  }
  function tween(from, to, ms, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const f = (now) => { const x = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - x, 3); fn(from + (to - from) * e); if (x < 1) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
  }
  function point(key, dx = 0, dy = 0) {
    const target = q(`[data-cur="${key}"]`); if (!target) return;
    const a = win.getBoundingClientRect(), b = target.getBoundingClientRect();
    const x = (b.left + b.width / 2 - a.left) / k + dx, y = (b.top + b.height / 2 - a.top) / k + dy;
    el.cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  async function click(key, live, dx = 0, dy = 0) {
    point(key, dx, dy); await wait(470); if (!live()) return false;
    const target = q(`[data-cur="${key}"]`); target.classList.add('press');
    await wait(150); target.classList.remove('press');
    return live();
  }

  // ---------- the four gestures ----------
  const PLAY = {
    async 1(live) {
      paint({ ...END[0], cursor: true }); await wait(250); if (!live()) return;
      if (!(await click('field', live, -60))) return;
      paint({ focus: true });
      for (let i = 1; i <= TYPED.length; i++) { await wait(150); if (!live()) return; paint({ text: TYPED.slice(0, i) }); }
      await wait(160); if (!live()) return;
      paint({ suggest: true });
      await wait(420); if (!live()) return;
      point('sug0', -40); await wait(430); if (!live()) return;
      paint({ hl: true });
      await wait(420); if (!live()) return;
      if (!(await click('sug0', live, -40))) return;
      paint({ ...END[1], cursor: true });
      await wait(700); if (live()) paint({ cursor: false });
    },
    async 2(live) {
      paint({ ...END[1], cursor: true }); await wait(250); if (!live()) return;
      if (!(await click('start', live))) return;
      paint({ ...END[2], cursor: true }); runClock(0);
      await wait(900); if (live()) paint({ cursor: false });
    },
    async 3(live) {
      paint({ ...END[2], cursor: true });
      const from = ticking ? clockSecs : 0; stopClock(); ticking = true;      // time passes: the clock runs up to the real duration
      await tween(from, SESSION, 900, setClock); if (!live()) return;
      runClock(SESSION);
      if (!(await click('stop', live))) return;
      stopClock();
      paint({ ...END[3], total: BEFORE, cursor: true, clock: 0 });           // the row comes in, then the total climbs
      await wait(260); if (!live()) return;
      await tween(BEFORE, AFTER, 800, (m) => { el.total.textContent = hmin(m); }); if (!live()) return;
      paint({ ...END[3], cursor: true });
      await wait(500); if (live()) paint({ cursor: false });
    },
    async 4(live) {
      paint({ ...END[3], cursor: true }); await wait(250); if (!live()) return;
      if (!narrow) { if (!(await click('navwork', live, -40))) return; }
      paint({ page: 'work' }); await wait(520); if (!live()) return;
      if (!(await click('add', live))) return;
      paint({ dialog: true }); await wait(520); if (!live()) return;
      for (let i = 0; i < 3; i++) { point(`chk${i}`, narrow ? -150 : -340); await wait(430); if (!live()) return; paint({ checks: i + 1 }); await wait(140); }
      await wait(260); if (!live()) return;
      if (!(await click('import', live))) return;
      paint({ dialog: false }); await wait(300); if (!live()) return;
      for (let i = 1; i <= 3; i++) { paint({ imp: i }); await wait(190); if (!live()) return; }
      paint({ ...END[4], cursor: true });
      await wait(500); if (live()) paint({ cursor: false });
    },
  };

  // ---------- public ----------
  function setStep(n, { mid = false } = {}) {
    if (n === step && !mid) return;
    const forward = n > step; step = n;
    const my = ++token, live = () => my === token;
    win.setAttribute('aria-label', t(`app.alt${Math.max(1, n)}`));
    if (mid && MID[n]) { stopClock(); paint(MID[n]); requestAnimationFrame(() => point(n === 1 ? 'sug0' : 'import')); return; }
    if (instant || !forward || n === 0) {
      stopClock(); paint(END[n]);
      if (n === 2 && !instant) runClock(0);
      return;
    }
    PLAY[n](live);
  }
  function fit() {
    narrow = innerWidth < 900;
    win.classList.toggle('narrow', narrow);
    const [w, h] = DESIGN[narrow ? 'narrow' : 'wide'];
    k = Math.min(stage.clientWidth / w, stage.clientHeight / h, narrow ? 1.1 : 1.25) * (narrow ? 1 : 0.9);     // on wide screens the window leaves air around itself
    win.style.setProperty('--k', k.toFixed(4));
  }
  paint(BASE); fit();
  return { setStep, fit, relabel() { paint({}); win.setAttribute('aria-label', t(`app.alt${Math.max(1, step)}`)); } };
}

/* Hexagon Lab · bench: stage, inspector, tour. Motion follows plans/001–005. */
(function () {
  'use strict';
  const H = window.HEX;
  const $ = (sel) => document.querySelector(sel);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { spec: { ...H.PRESETS[0].spec }, cw: 'signal', paintCw: H.COLORWAYS.signal, guides: false, preset: 'master' };
  H.state = state;

  const stage = $('#stage'), stageSvg = $('#stage-svg'), stageFade = $('#stage-fade'), stageGuides = $('#stage-guides');
  const presetsHost = $('#presets'), badge = $('#preset-badge');
  const inputs = {}, outputs = {};
  const STAGE = { size: 720, fit: 0.8, cap: 0.25 };

  // ---------- inspector ----------
  const dialHTML = (d) =>
    `<div class="dial"><div class="dial-head"><label class="label" for="d-${d.key}">${d.label}</label><output class="mono" id="o-${d.key}" for="d-${d.key}"></output></div>` +
    `<input class="slider" type="range" id="d-${d.key}" min="${d.min}" max="${d.max}" step="${d.step}"></div>`;
  const choiceHTML = (c) =>
    `<div class="dial choice" role="radiogroup" aria-labelledby="l-${c.key}"><div class="dial-head"><span class="label" id="l-${c.key}">${c.label}</span></div><div class="toggle-group">` +
    c.options.map(([v, l]) => `<label class="toggle"><input type="radio" name="c-${c.key}" id="c-${c.key}-${v}" value="${v}"><span>${l}</span></label>`).join('') +
    `</div></div>`;

  for (const grp of ['echo', 'fade', 'front']) {
    $(`#g-${grp} .dials`).innerHTML =
      H.DIALS.filter((d) => d.group === grp).map(dialHTML).join('') +
      H.CHOICES.filter((c) => c.group === grp).map(choiceHTML).join('');
  }
  for (const d of H.DIALS) {
    const el = (inputs[d.key] = $(`#d-${d.key}`));
    outputs[d.key] = $(`#o-${d.key}`);
    el.addEventListener('input', () => { userEdit(); state.spec[d.key] = +el.value; state.preset = null; paint(); });
  }
  for (const c of H.CHOICES) {
    const numeric = typeof c.options[0][0] === 'number';
    document.querySelectorAll(`input[name="c-${c.key}"]`).forEach((el) =>
      el.addEventListener('change', () => { userEdit(); state.spec[c.key] = numeric ? +el.value : el.value; state.preset = null; paint(); }));
  }

  function syncControls() {
    const s = state.spec;
    for (const d of H.DIALS) {
      const el = inputs[d.key], v = s[d.key];
      if (document.activeElement !== el || tour.on || anim) el.value = v;
      el.style.setProperty('--fill', `${((v - d.min) / (d.max - d.min)) * 100}%`);
      outputs[d.key].textContent = d.fmt(v);
    }
    for (const c of H.CHOICES) {
      const v = c.key === 'count' ? Math.round(s.count) : s[c.key];
      const el = document.getElementById(`c-${c.key}-${v}`);
      if (el && !el.checked) el.checked = true;
    }
  }

  // ---------- presets + colors ----------
  function drawPresets() {
    const cw = H.COLORWAYS[state.cw];
    presetsHost.innerHTML = H.PRESETS.map((p) =>
      `<button type="button" class="preset" data-id="${p.id}" aria-pressed="${p.id === state.preset}">` +
      H.render(p.spec, cw, { size: 120, fit: 0.82, cap: 0.22, ground: true, radius: 0.16, attrs: 'aria-hidden="true"' }) +
      `<span>${p.name}</span></button>`).join('');
  }
  presetsHost.addEventListener('click', (ev) => {
    const b = ev.target.closest('.preset');
    if (!b) return;
    const p = H.PRESETS.find((x) => x.id === b.dataset.id);
    H.load(p.spec, p.id);
  });

  $('#swatches').innerHTML = Object.entries(H.COLORWAYS).map(([key, c]) =>
    `<label class="swatch"><input type="radio" name="cw" id="cw-${key}" value="${key}"${key === state.cw ? ' checked' : ''}>` +
    `<span><i style="--g:${c.ground};--m:${c.front}" aria-hidden="true"></i>${c.name}</span></label>`).join('');
  document.querySelectorAll('input[name="cw"]').forEach((el) => el.addEventListener('change', () => setColorway(el.value)));

  // ---------- paint ----------
  function paintGuides() {
    stageGuides.innerHTML = H.render(state.spec, state.paintCw, { ...STAGE, guides: true, guidesOnly: true, attrs: 'aria-hidden="true"' });
  }
  function paint() {
    const cw = state.paintCw;
    stage.style.setProperty('--stage-ground', cw.ground);
    stageSvg.innerHTML = H.render(state.spec, cw, { ...STAGE, attrs: 'role="img" aria-label="Mark"' });
    if (state.guides) paintGuides();
    syncControls();
    const p = H.PRESETS.find((x) => x.id === state.preset);
    badge.textContent = p ? p.name : 'Custom';
    presetsHost.querySelectorAll('.preset').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.preset)));
    H.bus.dispatchEvent(new Event('spec'));
  }

  // Reduced motion: no geometry travels; the old mark fades out over the new one (plans/003).
  function crossfade(apply) {
    stageFade.innerHTML = stageSvg.innerHTML;
    apply();
    paint();
    const a = stageFade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: H.DUR.fade, easing: 'ease', fill: 'forwards' });
    a.onfinish = () => { stageFade.innerHTML = ''; a.cancel(); };
  }

  // Retargets from wherever the mark is, so rapid clicks never restart (plans/002).
  let anim = 0;
  function animateTo(target, ms = H.DUR.morph) {
    cancelAnimationFrame(anim);
    anim = 0;
    if (reduced) { crossfade(() => { state.spec = { ...target }; }); return; }
    const from = { ...state.spec }, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      state.spec = t < 1 ? H.lerpSpec(from, target, H.EASE.inOut(t)) : { ...target };
      anim = t < 1 ? requestAnimationFrame(step) : 0;
      paint();
    };
    anim = requestAnimationFrame(step);
  }

  let cwAnim = 0;
  function setColorway(key) {
    const from = state.paintCw, to = H.COLORWAYS[key];
    state.cw = key;
    drawPresets();
    H.bus.dispatchEvent(new Event('colorway'));
    cancelAnimationFrame(cwAnim);
    if (reduced) { crossfade(() => { state.paintCw = to; }); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / H.DUR.color);
      state.paintCw = t < 1 ? H.mixColorway(from, to, H.EASE.out(t)) : to;
      cwAnim = t < 1 ? requestAnimationFrame(step) : 0;
      paint();
    };
    cwAnim = requestAnimationFrame(step);
  }

  function interrupt() { autoPaused = false; stopTour(); cancelAnimationFrame(anim); anim = 0; }
  function userEdit() { interrupt(); state.spec = H.settle(state.spec); }
  H.load = (spec, presetId = null) => { interrupt(); state.preset = presetId; animateTo(spec); };

  // ---------- tour through the eight Figma ideas ----------
  const HOLD = reduced ? 2400 : 1500, MORPH = reduced ? 0 : H.DUR.tour, SEG = HOLD + MORPH;
  const tour = { on: false, raf: 0, t0: 0, from: 0, cur: 0, last: null };
  const tourBtn = $('#tour-btn'), tourLabel = $('#tour-label'), tourStep = $('#tour-step');
  let autoPaused = false;

  function setTourLabel(p, i) {
    tourLabel.textContent = p.name;
    tourStep.textContent = `${i + 1}/${H.PRESETS.length}`;
  }
  function tourFrame(now) {
    tour.raf = requestAnimationFrame(tourFrame);
    const el = now - tour.t0;
    if (el < 0) return; // still easing into the first stop
    const n = H.PRESETS.length, k = Math.floor(el / SEG), p = el % SEG;
    const ia = (tour.from + k) % n, ib = (ia + 1) % n;
    const a = H.PRESETS[ia], b = H.PRESETS[ib];
    if (p < HOLD) {
      if (tour.last === k) return;
      tour.last = k; tour.cur = ia;
      setTourLabel(a, ia);
      const apply = () => { state.spec = { ...a.spec }; state.preset = a.id; };
      if (reduced && k > 0) crossfade(apply); else { apply(); paint(); }
      return;
    }
    tour.last = null; tour.cur = ib;
    setTourLabel(b, ib);
    state.spec = H.lerpSpec(a.spec, b.spec, H.EASE.inOut((p - HOLD) / MORPH));
    state.preset = null;
    paint();
  }
  function startTour() {
    if (tour.on) return;
    let i = H.PRESETS.findIndex((p) => p.id === state.preset);
    if (i < 0) i = tour.cur;
    tour.on = true; tour.from = i; tour.last = null; tour.t0 = performance.now();
    if (state.preset !== H.PRESETS[i].id) { animateTo(H.PRESETS[i].spec); tour.t0 += H.DUR.morph + 50; }
    tourBtn.dataset.on = 'true';
    tourBtn.setAttribute('aria-pressed', 'true');
    tour.raf = requestAnimationFrame(tourFrame);
  }
  function stopTour() {
    if (!tour.on) return;
    tour.on = false;
    cancelAnimationFrame(tour.raf);
    tourBtn.dataset.on = 'false';
    tourBtn.setAttribute('aria-pressed', 'false');
    tourLabel.textContent = 'Tour';
    tourStep.textContent = '';
  }
  tourBtn.addEventListener('click', () => {
    const wasOn = tour.on;
    interrupt();
    if (!wasOn) startTour();
  });
  new IntersectionObserver((entries) => {
    const visible = entries[entries.length - 1].isIntersecting;
    if (!visible && tour.on) { stopTour(); autoPaused = true; }
    else if (visible && autoPaused) { autoPaused = false; startTour(); }
  }, { threshold: 0.2 }).observe(stage);

  // ---------- actions ----------
  const guidesBtn = $('#guides');
  guidesBtn.addEventListener('click', () => {
    state.guides = !state.guides;
    guidesBtn.setAttribute('aria-checked', String(state.guides));
    if (state.guides) paintGuides();
    stageGuides.classList.toggle('on', state.guides);
  });
  $('#shuffle').addEventListener('click', () => H.load(H.random()));
  $('#reset').addEventListener('click', () => H.load(H.PRESETS[0].spec, 'master'));

  const toast = $('#toast'), toastText = $('#toast-text');
  let toastTimer = 0;
  H.toast = (msg) => {
    toastText.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  };

  const dialog = $('#code-dialog'), codeText = $('#code-text'), copyBtn = $('#copy');
  let copyTimer = 0;
  function showCode(svg) {
    codeText.value = svg;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    codeText.focus();
    codeText.select();
  }
  $('#code-close').addEventListener('click', () => dialog.close());
  copyBtn.addEventListener('click', () => {
    const svg = H.render(H.settle(state.spec), H.COLORWAYS[state.cw], { size: 1024, fit: 0.8, cap: 0.25, attrs: 'width="1024" height="1024"' });
    const done = () => {
      copyBtn.dataset.on = 'true';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyBtn.dataset.on = 'false'; }, 1500);
      H.toast('SVG copied');
    };
    try { navigator.clipboard.writeText(svg).then(done, () => showCode(svg)); } catch (err) { showCode(svg); }
  });

  // ---------- theme ----------
  const root = document.documentElement, themeBtn = $('#theme');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches);
  const syncTheme = () => { themeBtn.dataset.on = String(isDark()); };
  try { const t = localStorage.getItem('hexlab-theme'); if (t === 'dark' || t === 'light') root.dataset.theme = t; } catch (err) { /* storage unavailable */ }
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('hexlab-theme', root.dataset.theme); } catch (err) { /* storage unavailable */ }
    syncTheme();
  });
  darkQuery.addEventListener('change', syncTheme);
  syncTheme();

  // ---------- start ----------
  $('#brand-mark').innerHTML = H.render(H.PRESETS[0].spec, H.COLORWAYS.signal, { size: 64, fit: 0.8, cap: 0.279, ground: true, radius: 0.24, attrs: 'aria-hidden="true"' });
  drawPresets();
  paint();
  if (!reduced) setTimeout(() => { if (state.preset === 'master' && !anim && !tour.on) startTour(); }, 1400);
})();

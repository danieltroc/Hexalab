/* Hexagon Lab · tabs: variations, motion loops, applications. Offscreen views do no per-frame work (plans/004). */
(function () {
  'use strict';
  const H = window.HEX;
  const $ = (sel) => document.querySelector(sel);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cw = () => H.COLORWAYS[H.state.cw];

  function watch(el, onShow) {
    const w = { visible: false };
    new IntersectionObserver((entries) => {
      const v = entries[entries.length - 1].isIntersecting;
      const was = w.visible;
      w.visible = v;
      if (v && !was && onShow) onShow();
    }, { rootMargin: '200px' }).observe(el);
    return w;
  }

  // ---------- tabs ----------
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const fieldTools = $('#field-tools');
  function selectTab(tab, focus) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    fieldTools.hidden = tab.id !== 'tab-variations';
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (ev) => {
      const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  // ---------- variations ----------
  const e = Math.floor(H.settingsLog);
  $('#count').innerHTML = `${Math.pow(10, H.settingsLog - e).toFixed(1)}&thinsp;×&thinsp;10<sup>${e}</sup>`;

  const N = 48;
  const grid = $('#field-grid');
  let specs = [];
  function drawField(fresh) {
    const c = cw();
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    grid.style.setProperty('--tile', c.ground);
    grid.classList.remove('fresh');
    grid.innerHTML = specs.map((s, i) =>
      `<button type="button" class="tile" data-i="${i}" style="--r:${Math.floor(i / cols)};--c:${i % cols}" aria-label="Variation ${i + 1}">` +
      H.render(s, c, { size: 240, fit: 0.78, cap: 0.22, attrs: 'aria-hidden="true"' }) + `</button>`).join('');
    if (fresh && !reduced) { void grid.offsetWidth; grid.classList.add('fresh'); }
    else if (fresh) grid.classList.add('fresh');
  }
  function regenerate(fresh) { specs = Array.from({ length: N }, () => H.random()); drawField(fresh); }
  $('#reshuffle').addEventListener('click', () => regenerate(true));

  // Put a tile on the bench; if the bench is off screen, morph once the scroll lands so the change is seen.
  grid.addEventListener('click', (ev) => {
    const t = ev.target.closest('.tile');
    if (!t) return;
    const spec = specs[+t.dataset.i];
    const bench = document.getElementById('bench');
    const top = document.getElementById('stage').getBoundingClientRect().top;
    if (top > -200 && top < window.innerHeight * 0.5) { H.load(spec); return; }
    if (reduced) { bench.scrollIntoView({ block: 'start' }); H.load(spec); return; }
    let done = false;
    const go = () => { if (!done) { done = true; H.load(spec); } };
    window.addEventListener('scrollend', go, { once: true });
    setTimeout(go, 700);
    bench.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- motion ----------
  const wave = (p) => (1 - Math.cos(2 * Math.PI * p)) / 2;
  const MOTIONS = [
    { id: 'reveal', name: 'Reveal', use: 'Intro', period: 3200, f: (b, p) => {
      const t = p < 0.4 ? H.EASE.out(p / 0.4) : p < 0.8 ? 1 : 1 - H.EASE.inOut((p - 0.8) / 0.2);
      return { ...b, dist: b.dist * t, sweep: b.sweep * t, strength: b.strength * t, scale: 1 + (b.scale - 1) * t };
    } },
    { id: 'orbit', name: 'Orbit', use: 'Loading', period: 2400, f: (b, p) => ({ ...b, angle: (b.angle + 360 * p) % 360, light: (b.light + 360 * p) % 360 }) },
    { id: 'breathe', name: 'Breathe', use: 'Idle', period: 3000, f: (b, p) => {
      const w = wave(p);
      return { ...b, scale: b.scale * (1 + 0.16 * w), dist: b.dist + 0.18 * w, strength: b.strength * (0.55 + 0.45 * w) };
    } },
    { id: 'streak', name: 'Streak', use: 'Progress', period: 1800, f: (b, p) => {
      const w = Math.sin(Math.PI * p);
      return { ...b, sweep: b.sweep + 1.4 * w, stretch: b.stretch + 0.25 * w };
    } },
  ];
  const loopsHost = $('#loops');
  loopsHost.innerHTML = MOTIONS.map((m) =>
    `<div class="card loop"><div class="loop-tile" id="m-${m.id}"></div><div class="loop-foot"><b>${m.name}</b><span class="muted mono">${m.use}</span></div></div>`).join('');
  const loops = MOTIONS.map((m) => ({ m, el: document.getElementById('m-' + m.id), frame: null, key: '', framedAt: -1e9 }));

  function drawLoops(now) {
    const base = H.state.spec, c = cw();
    const key = JSON.stringify(base);
    loopsHost.style.setProperty('--tile', c.ground);
    for (const l of loops) {
      // Frame the whole loop so the mark doesn't drift; re-frame at most every 200 ms while the bench morphs.
      if (l.key !== key && (!l.frame || now - l.framedAt >= 200)) {
        let bb = null;
        for (let i = 0; i < 12; i++) bb = H.bounds(l.m.f(base, i / 12), bb);
        l.frame = bb; l.key = key; l.framedAt = now;
      }
      const p = reduced ? 0.3 : (now % l.m.period) / l.m.period;
      l.el.innerHTML = H.render(l.m.f(base, p), c, { size: 260, fit: 0.84, cap: 0.2, frame: l.frame, attrs: 'aria-hidden="true"' });
    }
  }
  let loopRaf = 0;
  const loopsView = watch(loopsHost, () => {
    cancelAnimationFrame(loopRaf);
    const tick = (now) => { drawLoops(now); if (loopsView.visible && !reduced) loopRaf = requestAnimationFrame(tick); };
    loopRaf = requestAnimationFrame(tick);
  });

  // ---------- in use ----------
  const wordInput = $('#wordmark');
  function drawWords() {
    const w = wordInput.value.trim() || 'hexalabs';
    document.querySelectorAll('.wordmark').forEach((el) => { el.textContent = w; });
    $('#avatar-handle').textContent = '@' + w.toLowerCase().replace(/\s+/g, '');
  }
  wordInput.addEventListener('input', drawWords);

  function drawUses() {
    const s = H.state.spec, c = cw();
    const icon = (px) => H.render(s, c, { size: 256, fit: 0.74, cap: 0.279, ground: true, radius: 0.2237, attrs: `width="${px}" height="${px}" aria-hidden="true"` });
    const cell = (px) => `<div class="app-icon">${icon(px)}<span class="muted mono">${px}</span></div>`;
    $('#icons').innerHTML = [144, 96, 64].map(cell).join('') + `<div class="icon-pair">${cell(32)}${cell(16)}</div>`;
    const fav = H.render(s, c, { size: 64, fit: 0.86, cap: 0.32, ground: true, radius: 0.22, attrs: 'aria-hidden="true"' });
    document.querySelectorAll('.fav:not(.fav-blank)').forEach((el) => { el.innerHTML = fav; });
    const tight = (way) => H.render(s, H.COLORWAYS[way], { size: 200, fit: 0.98, cap: 0.5, attrs: 'aria-hidden="true"' });
    $('#lk-dark').innerHTML = tight('ember');
    $('#lk-light').innerHTML = tight('paper');
    const avatar = (px) => H.render(s, c, { size: 256, fit: 0.66, cap: 0.24, ground: true, radius: 0.5, attrs: `width="${px}" height="${px}" aria-hidden="true"` });
    $('#avatar-big').innerHTML = avatar(112);
    $('#avatar-small').innerHTML = avatar(40);
    usesDirty = false;
  }
  let usesDirty = true, usesQueued = false;
  const usesView = watch(document.querySelector('.uses'), () => { if (usesDirty) drawUses(); });

  // ---------- follow the bench ----------
  H.bus.addEventListener('spec', () => {
    usesDirty = true;
    if (usesView.visible && !usesQueued) {
      usesQueued = true;
      requestAnimationFrame(() => { usesQueued = false; drawUses(); });
    }
    if (reduced && loopsView.visible) drawLoops(performance.now());
  });
  H.bus.addEventListener('colorway', () => { drawField(false); usesDirty = true; if (usesView.visible) drawUses(); });

  regenerate(false);
  drawWords();
})();

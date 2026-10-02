/* Hexagon Lab · mark engine
   A mark is one front hexagon (circumradius R = 1) plus 1–4 echoes.
   Angles are degrees: 0° = right, 90° = up. Rounded hexagons are an inset hexagon
   grown by a disc of the corner radius, which matches Figma's corner rounding on the
   source polygons (0.225R in the master glyph, frame 1:344). */
(function () {
  'use strict';
  const RAD = Math.PI / 180;
  const SQ3 = Math.sqrt(3);
  const ARC = 8; // segments per rounded corner

  const unit = (deg) => [Math.cos(deg * RAD), -Math.sin(deg * RAD)]; // screen space, y down
  const f2 = (v) => Math.round(v * 100) / 100;

  // CSS-equivalent cubic-bezier easing (UnitBezier solver, as in WebKit).
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    const solve = (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = sx(t) - x;
        if (Math.abs(err) < 1e-6) return t;
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1;
      t = x;
      while (hi - lo > 1e-7) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-6) return t;
        if (x > v) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return t;
    };
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
  }
  // Motion tokens shared by every JS morph (mirrors --ease-out / --ease-in-out in lab.css).
  const EASE = { out: bezier(0.23, 1, 0.32, 1), inOut: bezier(0.77, 0, 0.175, 1) };
  const DUR = { morph: 300, tour: 900, color: 200, fade: 150 };

  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function mixHex(a, b, t) {
    if (t <= 0 || a === b) return a;
    if (t >= 1) return b;
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function mixColorway(a, b, t) {
    return {
      name: t < 0.5 ? a.name : b.name,
      ground: mixHex(a.ground, b.ground, t), front: mixHex(a.front, b.front, t),
      grad: [mixHex(a.grad[0], b.grad[0], t), mixHex(a.grad[1], b.grad[1], t)],
      echo: mixHex(a.echo, b.echo, t), over: mixHex(a.over, b.over, t), guide: t < 0.5 ? a.guide : b.guide,
    };
  }

  function roundedHex(cx, cy, R, rot, corner) {
    const r = Math.min(corner, 0.8) * R;
    const Ri = R - (2 * r) / SQ3;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = 90 + rot + 60 * i;
      const [vx, vy] = unit(a);
      if (r < 1e-6) { pts.push([cx + vx * R, cy + vy * R]); continue; }
      const px = cx + vx * Ri, py = cy + vy * Ri;
      for (let s = 0; s <= ARC; s++) {
        const [nx, ny] = unit(a - 30 + (60 * s) / ARC);
        pts.push([px + nx * r, py + ny * r]);
      }
    }
    return pts;
  }

  function sharpHex(cx, cy, R, rot) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const [vx, vy] = unit(90 + rot + 60 * i);
      pts.push([cx + vx * R, cy + vy * R]);
    }
    return pts;
  }

  function hull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) {
      while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    lo.pop(); up.pop();
    return lo.concat(up);
  }

  // A body is a hexagon optionally swept along (sx, sy): the hull of its start and end positions.
  const swept = (b) => Math.hypot(b.sx, b.sy) > 1e-4;
  function outline(b, corner) {
    const a = roundedHex(b.x, b.y, b.R, b.rot, corner);
    return swept(b) ? hull(a.concat(roundedHex(b.x + b.sx, b.y + b.sy, b.R, b.rot, corner))) : a;
  }

  function build(s) {
    const u = unit(s.angle);
    const fb = { x: 0, y: 0, R: 1, rot: s.rot, sx: -u[0] * s.stretch, sy: -u[1] * s.stretch };
    const front = { body: fb, pts: outline(fb, s.corner) };
    const echoes = [];
    const count = Math.max(1, s.count); // fractional while morphing: the last echo fades in or out
    for (let n = 1; n <= Math.ceil(count - 1e-6); n++) {
      const d = s.dist * n;
      const b = { x: u[0] * d, y: u[1] * d, R: Math.pow(s.scale, n), rot: s.rot + s.twist, sx: u[0] * s.sweep, sy: u[1] * s.sweep };
      const presence = Math.min(1, Math.max(0, count - n + 1));
      echoes.push({ n, body: b, pts: outline(b, s.corner), alpha: s.strength * Math.pow(0.6, n - 1) * presence });
    }
    return { front, echoes };
  }

  function grow(bb, pts) {
    for (const [x, y] of pts) {
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x;
      if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y;
    }
    return bb;
  }
  const emptyBox = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

  function bounds(spec, into) {
    const g = build(spec);
    const bb = into || emptyBox();
    grow(bb, g.front.pts);
    for (const e of g.echoes) grow(bb, e.pts);
    return bb;
  }

  function arrow(a, b, S) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < S / 60) return '';
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const h = S / 48;
    const w1 = [b[0] - h * Math.cos(ang - 0.45), b[1] - h * Math.sin(ang - 0.45)];
    const w2 = [b[0] - h * Math.cos(ang + 0.45), b[1] - h * Math.sin(ang + 0.45)];
    return `<path d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}M${f2(w1[0])} ${f2(w1[1])}L${f2(b[0])} ${f2(b[1])}L${f2(w2[0])} ${f2(w2[1])}"/>`;
  }

  let uid = 0;

  /* opt: size (viewBox px), fit (max share of the box), cap (front R as share of the box),
     frame (fixed bbox in mark units), ground, radius (ground corner share), guides, attrs */
  function render(spec, cw, opt = {}) {
    const S = opt.size || 512;
    const g = build(spec);
    const bb = opt.frame || grow(g.echoes.reduce((b, e) => grow(b, e.pts), emptyBox()), g.front.pts);
    const k = Math.min((opt.cap ?? 0.25) * S, ((opt.fit ?? 0.8) * S) / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0));
    const ox = S / 2 - ((bb.x0 + bb.x1) / 2) * k;
    const oy = S / 2 - ((bb.y0 + bb.y1) / 2) * k;
    const P = (x, y) => [ox + x * k, oy + y * k];
    const d = (pts) => 'M' + pts.map(([x, y]) => f2(ox + x * k) + ' ' + f2(oy + y * k)).join('L') + 'Z';
    const id = 'hx' + (++uid);
    let defs = '', back = '', over = '';

    // Discrete choices arrive as 0–1 mixes while morphing, so nothing flips mid-motion.
    const fm = spec.fillMix ?? (spec.fill === 'grad' ? 1 : 0);
    const lm = spec.layerMix ?? (spec.layer === 'over' ? 1 : 0);

    let frontFill = cw.front;
    if (fm > 0.001) {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of g.front.pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      defs += `<linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(oy + y0 * k)}" x2="0" y2="${f2(oy + y1 * k)}"><stop stop-color="${mixHex(cw.front, cw.grad[0], fm)}"/><stop offset="1" stop-color="${mixHex(cw.front, cw.grad[1], fm)}"/></linearGradient>`;
      frontFill = `url(#${id}f)`;
    }

    // Each echo fades along the light direction: solid at its far edge, clear after `fade` of its span.
    const L = unit(spec.light);
    const axes = [];
    const echoPath = (e, A, B, tag, col, alpha) => {
      if (alpha <= 0.001) return '';
      defs += `<linearGradient id="${id}e${e.n}${tag}" gradientUnits="userSpaceOnUse" x1="${f2(A[0])}" y1="${f2(A[1])}" x2="${f2(B[0])}" y2="${f2(B[1])}"><stop stop-color="${col}" stop-opacity="${f2(alpha)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
      return `<path d="${d(e.pts)}" fill="url(#${id}e${e.n}${tag})"/>`;
    };
    for (const e of g.echoes) {
      let pmax = -Infinity, pmin = Infinity;
      for (const [x, y] of e.pts) { const p = x * L[0] + y * L[1]; if (p > pmax) pmax = p; if (p < pmin) pmin = p; }
      const qx = e.body.x + e.body.sx / 2, qy = e.body.y + e.body.sy / 2;
      const qc = qx * L[0] + qy * L[1];
      const pe = pmax - spec.fade * (pmax - pmin);
      const A = P(qx + L[0] * (pmax - qc), qy + L[1] * (pmax - qc));
      const B = P(qx + L[0] * (pe - qc), qy + L[1] * (pe - qc));
      axes.push([A, B]);
      back = echoPath(e, A, B, 'b', cw.echo, e.alpha * (1 - lm)) + back; // furthest echo drawn first
      over += echoPath(e, A, B, 'o', cw.over, e.alpha * lm);
    }

    const ground = opt.ground ? `<rect width="${S}" height="${S}" rx="${f2((opt.radius || 0) * S)}" fill="${cw.ground}"/>` : '';
    const front = `<path d="${d(g.front.pts)}" fill="${frontFill}"/>`;

    let guides = '';
    if (opt.guides) {
      const poly = (pts) => 'M' + pts.map((p) => P(p[0], p[1]).map(f2).join(' ')).join('L') + 'Z';
      const dash = `${f2(S / 110)} ${f2(S / 150)}`;
      const bodies = [g.front.body, ...g.echoes.map((e) => e.body)];
      guides += `<g fill="none" stroke="${cw.guide}" stroke-width="${f2(S / 420)}" stroke-linecap="round">`;
      for (const b of bodies) {
        guides += `<path d="${poly(sharpHex(b.x, b.y, b.R, b.rot))}" stroke-dasharray="${dash}"/>`;
        if (swept(b)) guides += `<path d="${poly(sharpHex(b.x + b.sx, b.y + b.sy, b.R, b.rot))}" stroke-dasharray="${dash}" opacity=".55"/>`;
      }
      const e1 = g.echoes[0].body;
      guides += arrow(P(0, 0), P(e1.x, e1.y), S);
      guides += `<g opacity=".7">${arrow(axes[0][1], axes[0][0], S)}</g></g>`;
      for (const b of bodies) {
        const [x, y] = P(b.x, b.y);
        guides += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(S / 200)}" fill="${cw.guide}"/>`;
      }
      const fs = f2(S / 44);
      const txt = (x, y, s) => `<text x="${f2(x)}" y="${f2(y)}" font-family="Space Mono, ui-monospace, monospace" font-size="${fs}" fill="${cw.guide}">${s}</text>`;
      const [mx, my] = P(e1.x / 2, e1.y / 2);
      guides += txt(mx + S / 50, my - S / 50, `${spec.dist.toFixed(2)}R @ ${Math.round(spec.angle)}°`);
      const [ax, ay] = axes[0][0];
      guides += txt(ax + S / 60, ay + S / 26, `fade ${Math.round(spec.fade * 100)}%`);
    }

    const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" ${opt.attrs || ''}>`;
    if (opt.guidesOnly) return `${open}${guides}</svg>`; // construction overlay layer
    return `${open}${defs ? `<defs>${defs}</defs>` : ''}${ground}${back}${front}${over}${guides}</svg>`;
  }

  // ---------- data ----------

  // Master glyph, normalised from Figma frame 1:344: echo offset 0.58R at 30°, same size, fading toward the front.
  const BASE = { angle: 30, dist: 0.58, scale: 1, sweep: 0, twist: 0, count: 1, layer: 'back', light: 30, fade: 0.72, strength: 1, rot: 0, corner: 0.225, stretch: 0, fill: 'solid' };

  // The eight shape ideas on Figma frame 1:347, measured and normalised to the front hexagon.
  const PRESETS = [
    { id: 'master', name: 'Master', spec: { ...BASE } },
    { id: 'shift', name: 'Shift', spec: { ...BASE, angle: 0, dist: 0.32, fill: 'grad' } },
    { id: 'halo', name: 'Halo', spec: { ...BASE, dist: 0, scale: 1.24, fill: 'grad' } },
    { id: 'prism', name: 'Prism', spec: { ...BASE, dist: 0.34, scale: 1.44, stretch: 0.55, fill: 'grad' } },
    { id: 'drop', name: 'Drop', spec: { ...BASE, angle: 270, dist: 0.71, scale: 0.79, layer: 'over', light: 90, fade: 1, fill: 'grad' } },
    { id: 'peek', name: 'Peek', spec: { ...BASE, dist: 0.65, scale: 0.69, layer: 'over', light: 210, fade: 1, fill: 'grad' } },
    { id: 'rise', name: 'Rise', spec: { ...BASE, angle: 90, dist: 0.8, scale: 0.79, layer: 'over', light: 90, fade: 1, fill: 'grad' } },
    { id: 'trail', name: 'Trail', spec: { ...BASE, angle: 210, dist: 0.71, scale: 0.79, sweep: 1.38, layer: 'over', light: 30, fade: 1, fill: 'grad' } },
  ];

  const COLORWAYS = {
    signal: { name: 'Signal', ground: '#F16D00', front: '#FFFFFF', grad: ['#FFFFFF', '#FFE6CF'], echo: '#FFFFFF', over: '#FFB47A', guide: 'rgba(25,25,25,.6)' },
    ember: { name: 'Ember', ground: '#191919', front: '#F16D00', grad: ['#FFA600', '#F16D00'], echo: '#F16D00', over: '#F16D00', guide: 'rgba(255,255,255,.6)' },
    mono: { name: 'Mono', ground: '#191919', front: '#FFFFFF', grad: ['#FFFFFF', '#CFC9C3'], echo: '#FFFFFF', over: '#8E8780', guide: 'rgba(241,109,0,.95)' },
    paper: { name: 'Paper', ground: '#FFFFFF', front: '#F16D00', grad: ['#FFA600', '#F16D00'], echo: '#F16D00', over: '#B85300', guide: 'rgba(25,25,25,.6)' },
    ink: { name: 'Ink', ground: '#FFFFFF', front: '#191919', grad: ['#4A4643', '#191919'], echo: '#191919', over: '#6E6964', guide: 'rgba(241,109,0,.95)' },
  };

  const deg = (v) => `${Math.round(v)}°`;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const DIALS = [
    { key: 'angle', group: 'echo', label: 'Direction', min: 0, max: 355, step: 5, fmt: deg },
    { key: 'dist', group: 'echo', label: 'Distance', min: 0, max: 1.6, step: 0.01, fmt: (v) => `${v.toFixed(2)}R` },
    { key: 'scale', group: 'echo', label: 'Size', min: 0.4, max: 1.6, step: 0.01, fmt: (v) => `×${v.toFixed(2)}` },
    { key: 'sweep', group: 'echo', label: 'Trail', min: 0, max: 3, step: 0.01, fmt: (v) => `${v.toFixed(2)}R` },
    { key: 'twist', group: 'echo', label: 'Twist', min: 0, max: 60, step: 1, fmt: deg },
    { key: 'light', group: 'fade', label: 'Direction', min: 0, max: 355, step: 5, fmt: deg },
    { key: 'fade', group: 'fade', label: 'Length', min: 0.2, max: 1.2, step: 0.01, fmt: pct },
    { key: 'strength', group: 'fade', label: 'Opacity', min: 0.1, max: 1, step: 0.01, fmt: pct },
    { key: 'rot', group: 'front', label: 'Rotation', min: 0, max: 60, step: 1, fmt: deg },
    { key: 'corner', group: 'front', label: 'Corners', min: 0, max: 0.6, step: 0.005, fmt: (v) => `${v.toFixed(3)}R` },
    { key: 'stretch', group: 'front', label: 'Stretch', min: 0, max: 1.5, step: 0.01, fmt: (v) => `${v.toFixed(2)}R` },
  ];
  const CHOICES = [
    { key: 'count', group: 'echo', label: 'Count', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4']] },
    { key: 'layer', group: 'echo', label: 'Layer', options: [['back', 'Behind'], ['over', 'Above']] },
    { key: 'fill', group: 'front', label: 'Fill', options: [['solid', 'Solid'], ['grad', 'Gradient']] },
  ];

  // log10 of the number of distinct dial settings at the slider step sizes.
  let settingsLog = 0;
  for (const d of DIALS) settingsLog += Math.log10(Math.round((d.max - d.min) / d.step) + 1);
  for (const c of CHOICES) settingsLog += Math.log10(c.options.length);

  // A random mark inside the brand rules: directions on the hexagon's 30° grid,
  // the master corner radius most of the time, one echo most of the time.
  function random(rnd = Math.random) {
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
    const angle = pick([0, 30, 30, 30, 60, 90, 90, 120, 150, 180, 210, 210, 240, 270, 270, 300, 330]);
    const trail = rnd() < 0.25;
    const over = rnd() < 0.35;
    const s = {
      angle,
      dist: trail ? between(0.3, 0.8) : between(0.12, 0.9),
      scale: between(0.62, 1.4),
      sweep: trail ? between(0.5, 2) : 0,
      twist: rnd() < 0.85 ? 0 : 30,
      count: pick([1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4]),
      layer: over ? 'over' : 'back',
      light: over ? pick([angle, angle + 180, 90]) % 360 : pick([angle, angle, 30, 90]) % 360,
      fade: between(0.55, 1.05),
      strength: 1,
      rot: rnd() < 0.8 ? 0 : 30,
      corner: rnd() < 0.6 ? 0.225 : Math.round(between(0.08, 0.42) * 200) / 200,
      stretch: !trail && rnd() < 0.15 ? between(0.3, 0.8) : 0,
      fill: rnd() < 0.6 ? 'grad' : 'solid',
    };
    if (s.layer === 'back' && s.dist + s.scale < 1.2) s.scale = Math.round((1.25 - s.dist) * 100) / 100;
    return s;
  }

  function lerpSpec(a, b, t) {
    const out = {};
    for (const key in b) {
      if (key === 'fillMix' || key === 'layerMix') continue;
      if (typeof b[key] !== 'number') { out[key] = t < 0.5 ? a[key] : b[key]; continue; } // labels only
      if (key === 'angle' || key === 'light') {
        const delta = ((((b[key] - a[key]) % 360) + 540) % 360) - 180;
        out[key] = (a[key] + delta * t + 360) % 360;
      } else out[key] = a[key] + (b[key] - a[key]) * t;
    }
    const mix = (s, k, on) => s[k + 'Mix'] ?? (s[k] === on ? 1 : 0);
    const fa = mix(a, 'fill', 'grad'), fb = mix(b, 'fill', 'grad');
    const la = mix(a, 'layer', 'over'), lb = mix(b, 'layer', 'over');
    out.fillMix = fa + (fb - fa) * t;
    out.layerMix = la + (lb - la) * t;
    return out;
  }

  // Snap an interrupted morph back to values the controls can show.
  function settle(s) {
    const o = { ...s };
    if ('fillMix' in o) { o.fill = o.fillMix >= 0.5 ? 'grad' : 'solid'; delete o.fillMix; }
    if ('layerMix' in o) { o.layer = o.layerMix >= 0.5 ? 'over' : 'back'; delete o.layerMix; }
    o.count = Math.max(1, Math.round(o.count));
    return o;
  }

  window.HEX = { render, build, bounds, unit, EASE, DUR, mixColorway, lerpSpec, settle, random, BASE, PRESETS, COLORWAYS, DIALS, CHOICES, settingsLog, bus: new EventTarget() };
})();

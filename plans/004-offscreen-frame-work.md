# 004 — Stop per-frame work for sections nobody can see

- **Status**: DONE (applied in the shadcn rebuild, 2026-10-02)
- **Commit**: n/a (not a git repository; snapshot 2026-10-02)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (`hexagon-lab/extras.js`), ~30 lines

## Problem

Every frame of a morph or tour dispatches `spec`, and the listener redraws nine "In use" SVGs whether or not that section is on screen:

```js
/* hexagon-lab/extras.js:110 — current */
H.bus.addEventListener('spec', () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawUses();
```

The motion loops also re-frame themselves whenever the bench spec changes. That costs 12 geometry builds per loop, 48 per frame while the tour is morphing:

```js
/* hexagon-lab/extras.js:62 — current */
const key = JSON.stringify(base);
...
for (let i = 0; i < 12; i++) bb = H.bounds(l.m.f(base, i / 12), bb);
```

This is main-thread work that competes with the hero morph. On a slower laptop the bench drops frames during the exact moment the client is watching.

## Target

- A `watch(el)` helper (IntersectionObserver, `rootMargin: '200px'`) that keeps a `visible` flag per section.
- "In use": on `spec`, set `usesDirty = true`. Redraw in the next animation frame only if the section is visible. When it scrolls into view and is dirty, redraw once.
- Loops: when the base spec changes, refresh the framing at most every 200 ms (`performance.now() − lastFrameAt >= 200`) and always on the first frame after a change ends. Keep animating with the last framing in between.
- Variation field and preset chips redraw only on colorway change (current behaviour, keep it).

## Repo conventions to follow

- The `loopsVisible` IntersectionObserver at `extras.js:80–83` is the exemplar. Generalise it into `watch()` and reuse it for `#use`.

## Steps

1. `extras.js`: add `watch(el, onShow)`, which returns an object `{ visible }` and calls `onShow` when the element enters the viewport.
2. Replace the `spec` listener body: set `usesDirty = true`, and if `uses.visible`, schedule `drawUses()` in the next frame and clear the flag.
3. `watch(document.getElementById('use'), () => usesDirty && drawUses())`.
4. In `drawLoops`, gate the re-framing on a 200 ms throttle as described.

## Boundaries

- Do NOT change what is drawn, only when.
- Do NOT touch `bench.js` (the stage must keep painting every frame).

## Verification

- **Mechanical**: in the console, count `drawUses` calls during one tour cycle with "In use" off screen. Expected: 0.
- **Feel check**: in the Performance panel, record 5 s of the tour with the bench in view. Scripting per frame drops compared with the old build, and no long tasks over 50 ms appear. Scroll to "In use" during the tour: the icons already show the current mark.
- **Done when**: offscreen sections do no per-frame rendering.

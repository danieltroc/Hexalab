# 003 — Reduced motion: drop movement, keep fades

- **Status**: DONE (applied in the shadcn rebuild, 2026-10-02)
- **Commit**: n/a (not a git repository; snapshot 2026-10-02)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files (`hexagon-lab/lab.css`, `hexagon-lab/bench.js`, `hexagon-lab/extras.js`), ~30 lines

## Problem

With `prefers-reduced-motion: reduce`, the stylesheet removes every transition and animation, including color and opacity feedback (switch state, toast fade, focus rings):

```css
/* hexagon-lab/lab.css:258 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

In JS the morph jumps straight to the target, with no transition at all:

```js
/* hexagon-lab/bench.js:101 — current */
if (reduced) { state.spec = { ...target }; paint(); return; }
```

Reduced motion means fewer and gentler animations, not none. A 150 ms crossfade still tells the user that the mark changed.

## Target

- CSS: under reduced motion, remove only movement. Transforms on press, hover, toasts and tile entrances become `transform: none`, and their transitions keep `opacity`, `color`, `background-color`, `border-color` and `box-shadow`.
- The tile entrance becomes opacity-only: `@keyframes tile-in { from { opacity: 0 } }`, 150 ms `ease`, no stagger.
- JS morph under reduced motion: no geometry interpolation. Swap the spec and crossfade the stage. Stack the old SVG over the new one and fade it from opacity 1 to 0 over 150 ms `ease`, then remove it.
- The tour never auto-starts. The play button still works and steps through the presets with crossfades only, with a 2400 ms hold.
- Motion loops render a single static frame (current behaviour, keep it).
- The smooth `scrollIntoView` stays `'auto'` (current behaviour, keep it).

## Repo conventions to follow

- `reduced` is already read once at the top of `bench.js:6` and `extras.js:6`. Reuse it.
- Stage markup: `#stage > #stage-svg`. Add the crossfade layer as a sibling `div.stage-fade` with the same absolute inset.

## Steps

1. `lab.css`: replace the blanket rule with targeted rules: `.btn:active, .tile:hover, .toast { transform: none }`, plus the reduced `tile-in` keyframe.
2. `bench.js`: add `crossfade(svgString)`. It copies the current stage SVG into `.stage-fade`, sets the new SVG on `#stage-svg`, then runs `animate([{opacity:1},{opacity:0}], {duration:150, easing:'ease'})` on `.stage-fade` and clears it on finish. Use it in the `reduced` branch of `animateTo`.
3. `bench.js`: when `reduced`, the tour hold is 2400 ms and the morph is `crossfade` (no interpolation).

## Boundaries

- Do NOT change the default (non-reduced) behaviour.
- Do NOT remove focus-ring transitions.
- Do NOT add dependencies. WAAPI `element.animate` is enough.

## Verification

- **Feel check**: in DevTools, open Rendering and emulate `prefers-reduced-motion: reduce`, then reload.
  - Clicking a preset crossfades the mark in about 0.15 s. No shape travels.
  - The switch still changes color smoothly. The toast fades without sliding.
  - Draw new variations: tiles fade in together, with no scale and no stagger.
- **Done when**: no rule under the reduced-motion query sets `transition: none` on everything, and every morph path has a reduced branch.

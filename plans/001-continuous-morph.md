# 001 — Interpolate layer, fill and echo count instead of flipping them mid-morph

- **Status**: DONE (applied in the shadcn rebuild, 2026-10-02)
- **Commit**: n/a (not a git repository; snapshot 2026-10-02)
- **Severity**: HIGH
- **Category**: Missed opportunities / Cohesion (state that teleports inside a transition)
- **Estimated scope**: 2 files (`hexagon-lab/hex.js`, `hexagon-lab/bench.js`), ~40 lines

## Problem

Every morph (the auto tour, preset clicks, tile clicks, shuffle) runs through `lerpSpec`, which interpolates numbers but flips the three discrete fields at the halfway point:

```js
/* hexagon-lab/hex.js:262 — current */
if (typeof b[key] !== 'number') { out[key] = t < 0.5 ? a[key] : b[key]; continue; }
/* hexagon-lab/hex.js:268 — current */
out.count = t < 0.5 ? a.count : b.count;
```

So mid-motion the echo jumps from behind the front to on top (Prism → Drop), the front pops from solid to gradient (Master → Shift), and extra echoes appear from nothing. Five of the eight tour transitions show a one-frame pop in the middle of an otherwise smooth morph. The tour is the first thing a client sees.

## Target

Three continuous mixes that the renderer understands, with no flip:

- `fillMix` in [0, 1]: 0 = solid, 1 = gradient. Front gradient stops are `mix(cw.front, cw.grad[i], fillMix)`.
- `layerMix` in [0, 1]: 0 = behind, 1 = on top. Each echo is drawn twice: behind the front with alpha × (1 − layerMix) in `cw.echo`, and on top with alpha × layerMix in `cw.over`. Skip a copy whose alpha is 0.
- `count` becomes fractional: echo `n` gets alpha × clamp(count − n + 1, 0, 1), so 1 → 2 fades the second echo in.

The UI keeps its discrete values (`fill: 'solid' | 'grad'`, `layer: 'back' | 'over'`, integer `count`). A spec without the mix fields renders exactly as today.

## Repo conventions to follow

- Geometry and rendering live in `hexagon-lab/hex.js` (`build`, `render`, `lerpSpec`); keep everything in that IIFE and export through `window.HEX`.
- Colors are hex strings in `COLORWAYS`. Add a small `mixHex(a, b, t)` helper next to `f2` (`hex.js:14`).

## Steps

1. `hex.js` `lerpSpec`: before the loop, derive `fa = a.fillMix ?? (a.fill === 'grad' ? 1 : 0)`, `fb` likewise from `b`, the same for `layerMix` from `layer === 'over'`. Write `out.fillMix = fa + (fb − fa) × t` and `out.layerMix = la + (lb − la) × t`. Keep `out.fill` and `out.layer` = `t < 0.5 ? a : b` (labels only). Replace the `out.count` line with a linear `out.count = a.count + (b.count − a.count) × t`.
2. `hex.js` `build`: loop `n` from 1 to `Math.ceil(s.count − 1e-6)`; multiply each echo's alpha by `Math.min(1, Math.max(0, s.count − n + 1))`.
3. `hex.js` `render`: resolve `fm = spec.fillMix ?? (spec.fill === 'grad' ? 1 : 0)` and `lm = spec.layerMix ?? (spec.layer === 'over' ? 1 : 0)`. Always emit the front gradient with stops `mixHex(cw.front, cw.grad[0], fm)` and `mixHex(cw.front, cw.grad[1], fm)`. For every echo emit a back path (alpha × (1 − lm), color `cw.echo`) when > 0.001 and an over path (alpha × lm, color `cw.over`) when > 0.001, each with its own gradient id.
4. `bench.js` `syncControls`: radio state reads `Math.round(count)`; `fill` and `layer` keep reading the label fields.

## Boundaries

- Do NOT change geometry (`roundedHex`, `hull`, `outline`) or preset values.
- Do NOT change easing or durations (plan 002 owns those).
- If `lerpSpec` no longer matches the excerpt above, STOP and report.

## Verification

- **Mechanical**: `node -e` smoke test: render every preset pair at t = 0, 0.25, 0.5, 0.75, 1 with no exceptions and no `NaN` in the output.
- **Feel check**: let the tour run through Prism → Drop and Master → Shift.
  - The echo dissolves from behind to on top. Nothing pops at the midpoint.
  - The front warms into the gradient instead of switching.
  - Set the tour morph to 5 seconds temporarily and scrub frame by frame. No frame shows a jump.
- **Done when**: no field in `lerpSpec` uses a `t < 0.5` switch for anything that reaches the renderer.

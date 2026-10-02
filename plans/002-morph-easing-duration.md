# 002 — Shorten user-triggered morphs and move every JS morph onto shared curves

- **Status**: DONE (applied in the shadcn rebuild, 2026-10-02)
- **Commit**: n/a (not a git repository; snapshot 2026-10-02)
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 3 files (`hexagon-lab/hex.js`, `hexagon-lab/bench.js`, `hexagon-lab/extras.js`), ~35 lines

## Problem

Clicking a preset, a variation tile, Shuffle or Back to master morphs the mark over 700 ms on a weak symmetric cubic:

```js
/* hexagon-lab/hex.js:13 — current */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* hexagon-lab/bench.js:99 — current */
function animateTo(target, ms = 700) {
```

700 ms is more than twice the 300 ms UI budget. These actions are hit tens of times per session, so the bench feels slow to answer. The passive tour (`bench.js:115`, `HOLD = 1500, MORPH = 900`) and the reveal loop (`extras.js:42`) reuse the same weak curve.

## Target

- Shared JS easing tokens built with a real cubic-bezier solver, exported on `HEX.EASE`:
  - `EASE.inOut = bezier(0.77, 0, 0.175, 1)` for on-screen morphs (strong ease-in-out)
  - `EASE.out = bezier(0.23, 1, 0.32, 1)` for entrances, the colorway fade and anything that appears
- Shared durations on `HEX.DUR`: `morph: 300` (user-triggered), `tour: 900` (passive tour morph, explanatory), `color: 200` (colorway change).
- `animateTo(target, ms = HEX.DUR.morph)` uses `EASE.inOut`.
- The tour morph uses `EASE.inOut` over `HEX.DUR.tour`. The 1500 ms hold stays.
- The reveal loop uses `EASE.out` for the echo coming out and `EASE.inOut` for the return.
- `animateTo` stays interruptible: it already starts from the current interpolated spec (`const from = { ...state.spec }`). Keep that.

## Repo conventions to follow

- Engine helpers live in `hexagon-lab/hex.js` and are exported through `window.HEX` (`hex.js:272`).
- Solver: the standard UnitBezier (Newton–Raphson with a bisection fallback, epsilon 1e-6), as used by WebKit. Write it once in `hex.js` as `bezier(x1, y1, x2, y2)`, returning `t => y`.

## Steps

1. `hex.js`: add `bezier(...)`, `EASE` and `DUR`. Replace `ease` with `EASE.inOut` and export `EASE` and `DUR`. Keep exporting `ease` as an alias of `EASE.inOut` until every caller is moved.
2. `bench.js:99`: default `ms` becomes `H.DUR.morph`, and the curve becomes `H.EASE.inOut`.
3. `bench.js:115` and `bench.js:134`: `MORPH = H.DUR.tour`, curve `H.EASE.inOut`.
4. `bench.js:145`: the pre-roll into the first tour stop uses `animateTo(spec, H.DUR.morph)` with `tour.t0 += H.DUR.morph + 50`.
5. `extras.js:42`: outgoing phase `H.EASE.out(p / 0.4)`, return phase `1 − H.EASE.inOut((p − 0.8) / 0.2)`.

## Boundaries

- Do NOT change loop periods (`extras.js:41–50`). They are ambient demos, not UI responses.
- Do NOT change the tour hold length.
- Do NOT touch CSS (plan 005 owns CSS motion tokens).

## Verification

- **Mechanical**: `bezier(0.77,0,0.175,1)` returns 0 at 0, 1 at 1 and ≈0.596 at 0.5 (the curve is not symmetric). `bezier(0.23,1,0.32,1)` returns ≈0.68 at 0.2.
- **Feel check**:
  - Click four presets quickly in a row. Each click retargets from wherever the mark is, with no restart from the old preset. Each morph lands in about 0.3 s.
  - The tour still reads as a slow, explanatory morph.
  - In DevTools, throttle the CPU 4×. The morph still lands, and dropped frames shorten it instead of stretching it, because it is time-based.
- **Done when**: no JS morph uses the old `ease` function and no user-triggered morph is longer than 300 ms.
